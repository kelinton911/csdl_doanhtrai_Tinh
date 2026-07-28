import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend tự nhảy cổng từ 3000 (thường 3004 trên máy DEV này). Đổi qua env nếu cần.
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3004';

// Proxy /api → backend để tránh cấu hình CORS và gom cấu hình cổng về một nơi.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backendOrigin, changeOrigin: true },
    },
  },
});
