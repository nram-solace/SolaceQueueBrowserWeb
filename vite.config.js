import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createProxyMiddleware } from 'http-proxy-middleware';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    {
      name: 'semp-proxy',
      configureServer(server) {
        server.middlewares.use('/api/semp-proxy', (req, res, next) => {
          try {
            // Extract target URL from X-Semp-Target header
            const targetHeader = req.headers['x-semp-target'];
            if (!targetHeader) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing X-Semp-Target header' }));
              return;
            }

            const targetUrl = new URL(targetHeader);
            const target = `${targetUrl.protocol}//${targetUrl.host}`;
            // Get the path from the request URL (after /api/semp-proxy)
            const path = req.url.replace(/^\/api\/semp-proxy/, '') || '/';

            // Create proxy middleware for this specific request
            const proxy = createProxyMiddleware({
              target,
              changeOrigin: true,
              secure: true,
              pathRewrite: () => path, // Rewrite to the extracted path
              onProxyReq: (proxyReq, originalReq) => {
                // Forward all headers except host-related ones and the target header
                Object.keys(originalReq.headers).forEach(key => {
                  const lowerKey = key.toLowerCase();
                  if (!['host', 'x-semp-target', 'connection'].includes(lowerKey)) {
                    proxyReq.setHeader(key, originalReq.headers[key]);
                  }
                });
              },
              onProxyRes: (proxyRes, req, res) => {
                // Add CORS headers to the response
                proxyRes.headers['access-control-allow-origin'] = '*';
                proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
                proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Semp-Target';
              },
              onError: (err, req, res) => {
                console.error('❌ Proxy error:', err.message);
                if (!res.headersSent) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
                }
              }
            });

            proxy(req, res, next);
          } catch (err) {
            console.error('❌ Proxy setup error:', err);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy setup failed: ' + err.message }));
            }
          }
        });
      }
    }
  ],
  base: './',

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  define: {
    'import.meta.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),    
  }
}));
