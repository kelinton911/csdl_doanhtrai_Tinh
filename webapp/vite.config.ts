import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend tự nhảy cổng từ 3000 (thường 3004 trên máy DEV này). Đổi qua env nếu cần.
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3004';

// Proxy /api → backend để tránh cấu hình CORS và gom cấu hình cổng về một nơi.
const apiProxy = { '/api': { target: backendOrigin, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  // Tránh nạp React trùng lặp (react-chartjs-2 báo lỗi useRef null nếu không dedupe).
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'chart.js', 'react-chartjs-2'] },
  build: {
    // PROD nội bộ: không phát hành source map (giảm lộ mã nguồn + kích thước).
    sourcemap: false,
    // Tách thư viện nặng khỏi bundle chính để tải nhanh và cache tốt hơn.
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // host để container publish được ra ngoài (0.0.0.0). Vô hại khi chạy local.
    host: true,
    proxy: apiProxy,
  },
  // `vite preview` phục vụ bản build tĩnh (dùng cho container webapp của app-stack).
  // Cần proxy riêng vì preview KHÔNG dùng server.proxy.
  preview: {
    port: 5173,
    host: true,
    proxy: apiProxy,
  },
});
