import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: ['maritime-naturist-safehouse.ngrok-free.dev'],
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL ?? '/api'),
    },
  };
});
