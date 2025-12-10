/**
 * Vercel Serverless Function to proxy SEMP requests
 * Catch-all handler for /api/semp-proxy/*
 * This bypasses CORS restrictions by making server-side requests
 */

export default async function handler(req, res) {
  // Log request for debugging
  console.log('🔍 Proxy handler called:', {
    method: req.method,
    url: req.url,
    query: req.query
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

    // Extract path from req.url
    // req.url will be like: /api/semp-proxy/SEMP/v2/monitor/...?select=...
    // Remove /api/semp-proxy prefix
    let path = req.url;
    if (path.startsWith('/api/semp-proxy')) {
      path = path.replace(/^\/api\/semp-proxy/, '') || '/';
    }
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Construct full target URL (path already includes query string)
    const targetUrl = `${targetHeader}${path}`;

    console.log(`🔄 Proxying SEMP request: ${req.method} ${path} -> ${targetUrl}`);

    // Prepare headers for the broker request
    const brokerHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Forward Authorization header if present
    if (req.headers.authorization) {
      brokerHeaders['Authorization'] = req.headers.authorization;
    }

    // Forward other relevant headers
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

