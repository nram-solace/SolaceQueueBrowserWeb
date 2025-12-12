#!/usr/bin/env node
/**
 * Standalone proxy server for Solace Queue Browser Web
 * Serves static files and proxies SEMP API requests
 * 
 * Usage: node proxy-server.js [--port 3000]
 */

import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readFileSync, existsSync, statSync } from 'fs';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, 'dist');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveStaticFile(filePath, res) {
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const mimeType = getMimeType(filePath);
  res.writeHead(200, { 'Content-Type': mimeType });
  createReadStream(filePath).pipe(res);
}

async function proxyRequest(req, res) {
  console.log('📥 Proxy request received:', {
    method: req.method,
    url: req.url,
    headers: {
      'x-semp-target': req.headers['x-semp-target'],
      'authorization': req.headers['authorization'] ? '***' : undefined
    }
  });
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Semp-Target',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  try {
    // Extract target URL from header
    const targetHeader = req.headers['x-semp-target'];
    if (!targetHeader) {
      console.error('❌ Missing X-Semp-Target header');
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Missing X-Semp-Target header',
        meta: {
          error: {
            description: 'Missing X-Semp-Target header',
            status: 'FAILURE'
          }
        }
      }));
      return;
    }

    // Extract path from request URL
    let urlPath = req.url;
    if (urlPath.startsWith('/api/semp-proxy')) {
      urlPath = urlPath.replace(/^\/api\/semp-proxy/, '') || '/';
    }

    const [path, queryPart] = urlPath.split('?');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    
    let queryString = '';
    if (queryPart) {
      queryString = '?' + queryPart;
    }

    const targetUrl = `${targetHeader}${cleanPath}${queryString}`;
    console.log('🔗 Proxying request:', {
      method: req.method,
      targetHeader,
      path: cleanPath,
      queryString,
      targetUrl
    });
    
    let url;
    try {
      url = new URL(targetUrl);
    } catch (urlError) {
      console.error('❌ Invalid URL construction:', {
        targetHeader,
        cleanPath,
        queryString,
        targetUrl,
        error: urlError.message || urlError.toString()
      });
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Invalid URL',
        message: urlError.message || urlError.toString(),
        meta: {
          error: {
            description: `Invalid URL: ${urlError.message || urlError.toString()}`,
            status: 'FAILURE'
          }
        }
      }));
      return;
    }

    // Prepare headers for broker request
    const brokerHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (req.headers.authorization) {
      brokerHeaders['Authorization'] = req.headers.authorization;
    }

    // Read request body if present
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data || null));
      });
    }

    // Make request to broker
    const httpModule = url.protocol === 'https:' ? https : http;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Request timeout after 30 seconds:', targetUrl);
      controller.abort();
    }, 30000); // 30 second timeout

    const brokerReq = httpModule.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers: brokerHeaders,
      signal: controller.signal,
    }, (brokerRes) => {
      clearTimeout(timeoutId);

      // Collect response data
      let responseData = '';
      brokerRes.on('data', chunk => { responseData += chunk; });
      
      brokerRes.on('error', (streamError) => {
        console.error('❌ Broker response stream error:', {
          message: streamError.message || streamError.toString(),
          code: streamError.code,
          targetUrl
        });
        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            error: 'Proxy error',
            message: streamError.message || streamError.toString() || 'Stream error',
            meta: {
              error: {
                description: `Broker response error: ${streamError.message || streamError.toString()}`,
                status: 'FAILURE'
              }
            }
          }));
        }
      });
      
      brokerRes.on('end', () => {
        // Check if response has already been sent (due to error)
        if (res.headersSent) {
          return;
        }
        
        // Set CORS headers
        res.writeHead(brokerRes.statusCode, {
          'Content-Type': brokerRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Semp-Target',
        });
        res.end(responseData);
      });
    });

    brokerReq.on('error', (error) => {
      clearTimeout(timeoutId);
      
      // Safety check - error might be undefined or null
      if (!error) {
        console.error('❌ Proxy request error: error object is null/undefined');
        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            error: 'Proxy error',
            message: 'Unknown error (error object was null)',
            code: 'NULL_ERROR',
            meta: {
              error: {
                description: 'Proxy error: Unknown error (error object was null)',
                status: 'FAILURE'
              }
            }
          }));
        }
        return;
      }
      
      // Extract error information with multiple fallbacks
      let errorMsg = 'Unknown error';
      let errorCode = 'UNKNOWN';
      let errorName = 'Error';
      const isAbortError = error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
      
      try {
        if (isAbortError) {
          errorMsg = 'Request timeout after 30 seconds';
          errorCode = 'TIMEOUT';
          errorName = 'AbortError';
        } else {
          errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
          errorCode = error?.code || error?.name || 'UNKNOWN';
          errorName = error?.name || 'Error';
        }
      } catch (e) {
        console.error('❌ Error extracting error info:', e);
        errorMsg = 'Error object could not be processed';
      }
      
      console.error('❌ Proxy request error:', {
        message: errorMsg,
        code: errorCode,
        name: errorName,
        isAbortError,
        targetUrl,
        stack: error?.stack,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorKeys: error ? Object.keys(error) : [],
        fullError: error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : 'null'
      });
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.error('⚠️ Response already sent, cannot send error response');
        return;
      }
      
      try {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          error: 'Proxy error',
          message: errorMsg,
          code: errorCode,
          meta: {
            error: {
              description: `Proxy error: ${errorMsg} (${errorCode})`,
              status: 'FAILURE'
            }
          }
        }));
      } catch (writeError) {
        console.error('❌ Failed to write error response:', writeError);
      }
    });

    if (body) {
      brokerReq.write(body);
    }
    brokerReq.end();

  } catch (error) {
    // Try multiple ways to extract error information
    let errorMsg = 'Unknown error';
    let errorCode = 'UNKNOWN';
    let errorName = 'Error';
    
    try {
      errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
      errorCode = error?.code || error?.name || 'UNKNOWN';
      errorName = error?.name || 'Error';
    } catch (e) {
      // If we can't extract error info, log the raw error
      console.error('❌ Cannot extract error info, raw error:', error);
      errorMsg = 'Error object could not be stringified';
    }
    
    console.error('❌ Proxy error (unhandled):', {
      message: errorMsg,
      code: errorCode,
      name: errorName,
      stack: error?.stack,
      type: typeof error,
      constructor: error?.constructor?.name,
      keys: error ? Object.keys(error) : [],
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    // Check if response has already been sent
    if (res.headersSent) {
      console.error('⚠️ Response already sent, cannot send error response');
      return;
    }
    
    try {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: errorMsg,
        code: errorCode,
        meta: {
          error: {
            description: `Proxy error: ${errorMsg} (${errorCode})`,
            status: 'FAILURE'
          }
        }
      }));
    } catch (writeError) {
      console.error('❌ Failed to write error response:', writeError);
    }
  }
}

const server = http.createServer((req, res) => {
  // Handle proxy requests
  if (req.url.startsWith('/api/semp-proxy')) {
    proxyRequest(req, res);
    return;
  }

  // Handle static file requests
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = join(DIST_DIR, filePath);

  // Security: prevent directory traversal
  const resolvedPath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!resolvedPath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStaticFile(resolvedPath, res);
});

server.listen(PORT, () => {
  console.log(`🚀 Solace Queue Browser Web`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Serving files from: ${DIST_DIR}`);
  console.log(`   Proxy endpoint: /api/semp-proxy`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
