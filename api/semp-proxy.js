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
      return res.status(400).json({ 
        error: 'Missing X-Semp-Target header',
        meta: {
          error: {
            description: 'Missing X-Semp-Target header',
            status: 'FAILURE'
          }
        }
      });
    }

    // Extract path from req.url
    // req.url will be like: /api/semp-proxy/SEMP/v2/monitor/...?select=...
    // Remove /api/semp-proxy prefix and any query params Vercel might add
    let urlPath = req.url;
    
    // Remove /api/semp-proxy prefix
    if (urlPath.startsWith('/api/semp-proxy')) {
      urlPath = urlPath.replace(/^\/api\/semp-proxy/, '') || '/';
    }
    
    // Split path and query string
    const [path, queryPart] = urlPath.split('?');
    
    // Clean the path - ensure it starts with /
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    
    // Parse and clean query string - remove any Vercel-added params
    let queryString = '';
    if (queryPart) {
      const queryParams = new URLSearchParams(queryPart);
      // Remove any Vercel-specific query params that might interfere
      queryParams.delete('path');
      queryParams.delete('_vercel');
      
      const cleanQuery = queryParams.toString();
      if (cleanQuery) {
        queryString = '?' + cleanQuery;
      }
    }
    
    const fullPath = cleanPath + queryString;
    const targetUrl = `${targetHeader}${fullPath}`;

    console.log(`🔄 Proxying SEMP request: ${req.method} ${fullPath}`);
    console.log(`   Target: ${targetUrl}`);
    console.log(`   Has Auth: ${!!req.headers.authorization}`);

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

    // Make the request to the broker with timeout
    // Note: Vercel free tier has 10s function timeout, Pro has 60s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    let brokerResponse;
    try {
      brokerResponse = await fetch(targetUrl, {
        method: req.method,
        headers: brokerHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Enhanced error handling for different failure types
      let errorMessage = fetchError.message || 'Unknown fetch error';
      let errorDetails = '';
      
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Request timeout - broker did not respond within 8 seconds';
        errorDetails = 'The broker may be slow to respond or unreachable. Check broker connectivity. Consider Vercel Pro plan for longer timeouts.';
      } else if (fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to broker: ${errorMessage}`;
        errorDetails = 'DNS resolution failed or connection refused. Verify broker hostname and port.';
      } else if (fetchError.code === 'CERT_HAS_EXPIRED' || fetchError.message.includes('certificate')) {
        errorMessage = 'SSL certificate error';
        errorDetails = 'Broker SSL certificate validation failed. This may indicate a self-signed certificate or expired cert.';
      } else if (errorMessage.includes('fetch failed')) {
        errorDetails = 'Network error occurred. This could be due to firewall rules, DNS issues, or broker unreachability from Vercel servers.';
      }
      
      console.error('❌ Proxy fetch error:', {
        message: errorMessage,
        code: fetchError.code,
        name: fetchError.name,
        targetUrl,
        details: errorDetails
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ 
        error: 'Proxy error',
        message: errorMessage,
        details: errorDetails,
        meta: {
          error: {
            description: `Proxy error: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`,
            status: 'FAILURE',
            code: fetchError.code || 'FETCH_ERROR'
          }
        }
      });
    }

    // Get response data
    const contentType = brokerResponse.headers.get('content-type') || '';
    let responseData;
    
    try {
      if (contentType.includes('application/json')) {
        responseData = await brokerResponse.json();
      } else {
        const text = await brokerResponse.text();
        responseData = text || { meta: { error: { description: 'Empty response', status: 'FAILURE' } } };
      }
    } catch (parseError) {
      console.error('❌ Failed to parse broker response:', parseError);
      responseData = {
        meta: {
          error: {
            description: `Failed to parse broker response: ${parseError.message}`,
            status: 'FAILURE'
          }
        }
      };
    }

    // Set CORS headers for the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Semp-Target');

    // Forward status and data
    console.log(`✅ Proxy response: ${brokerResponse.status}`);
    return res.status(brokerResponse.status).json(responseData);

  } catch (error) {
    console.error('❌ Proxy error (unhandled):', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Proxy error',
      message: error.message || 'Unknown error',
      meta: {
        error: {
          description: `Proxy error: ${error.message || 'Unknown error'}`,
          status: 'FAILURE'
        }
      }
    });
  }
}
