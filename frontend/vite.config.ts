import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyErrorHandler = (proxy: any) => {
  proxy.on('error', (_err: any, _req: any, res: any) => {
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Service Unavailable',
          message:
            'EduPredict backend server is offline or unreachable on http://127.0.0.1:5000. Please ensure the Flask backend is running.',
          status_code: 503,
        })
      );
    }
  });
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: proxyErrorHandler,
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: proxyErrorHandler,
      },
      '/health': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: proxyErrorHandler,
      },
    },
  },
});
