/**
 * Vercel Serverless Function to proxy SEMP requests
 * This bypasses CORS restrictions by making server-side requests
 * Dynamic route [...path] captures all paths after /api/semp-proxy/
 */

export default async function handler(req, res) {
  // Log request for debugging
  console.log('🔍 Proxy handler called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: Object.keys(req.headers)
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Semp-Target');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  try {
    // Extract target URL from header
    const targetHeader = req.headers['x-semp-target'];
    if (!targetHeader) {
      console.error('❌ Missing X-Semp-Target header');
      return res.status(400).json({ error: 'Missing X-Semp-Target header' });
    }

    // Get the path from Vercel's dynamic route parameter
    // The [...path] captures everything after /api/semp-proxy/
    const pathSegments = req.query.path || [];
    let path = '/';
    
    if (Array.isArray(pathSegments) && pathSegments.length > 0) {
      path = '/' + pathSegments.join('/');
    } else if (pathSegments && typeof pathSegments === 'string') {
      path = '/' + pathSegments;
    }
    
    // Get query string from original request
    // req.url in Vercel includes the full path with query string
    const queryString = req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '';
    const fullPath = path + queryString;
    
    // Construct full target URL
    const targetUrl = `${targetHeader}${fullPath}`;

    console.log(`🔄 Proxying SEMP request: ${req.method} ${fullPath} -> ${targetUrl}`);

    // Prepare headers for the broker request
    const brokerHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Forward Authorization header if present
    if (req.headers.authorization) {
      brokerHeaders['Authorization'] = req.headers.authorization;
    }

    // Forward other relevant headers (excluding host-related and our custom headers)
    const headersToForward = ['X-Requested-With', 'User-Agent'];
    headersToForward.forEach(header => {
      if (req.headers[header.toLowerCase()]) {
        brokerHeaders[header] = req.headers[header.toLowerCase()];
      }
    });

    // Make the request to the broker
    const brokerResponse = await fetch(targetUrl, {
      method: req.method,
      headers: brokerHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Get response data
    const contentType = brokerResponse.headers.get('content-type') || '';
    let responseData;
    
    if (contentType.includes('application/json')) {
      responseData = await brokerResponse.json();
    } else {
      responseData = await brokerResponse.text();
    }

    // Set CORS headers for the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Semp-Target');

    // Forward status and data
    res.status(brokerResponse.status).json(responseData);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      meta: {
        error: {
          description: `Proxy error: ${error.message}`,
          status: 'FAILURE'
        }
      }
    });
  }
}

