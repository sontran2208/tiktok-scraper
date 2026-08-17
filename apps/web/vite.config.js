import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, '../..', 'VITE_');

    return {
        plugins: [react()],
        server: {
            port: 5173,
            allowedHosts: ['maritime-naturist-safehouse.ngrok-free.dev'],
        },
        define: {
            'import.meta.env.VITE_API_URL': JSON.stringify(
                (_b = env.VITE_API_URL) !== null && _b !== void 0
                    ? _b
                    : 'http://localhost:3000'
            )
        }
    };
});