import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = process.env.BACKEND_ORIGIN || env.BACKEND_ORIGIN || 'http://localhost:3001';
  const apiProxy = { '/api': { target: backendOrigin, changeOrigin: true } };

  return {
    plugins: [
      react(),
      // M25/M26 — PWA hiện trường: cài đặt được, chạy ngoại tuyến, cache tile bản đồ
      // để khu vực đã xem còn dùng được khi mất mạng. KHÔNG cache /api (tránh dữ liệu/401 cũ).
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        // Tắt SW ở dev để không ảnh hưởng HMR và e2e (Playwright chạy `vite`).
        devOptions: { enabled: false },
        manifest: {
          name: 'CSDL Doanh trại cấp tỉnh',
          short_name: 'CSDL DT',
          description: 'Khảo sát hiện trường & khai báo hồ sơ doanh trại cấp xã (ngoại tuyến)',
          lang: 'vi',
          dir: 'ltr',
          theme_color: '#0f766e',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          runtimeCaching: [
            {
              // Cache tile bản đồ (mọi nhà cung cấp) để bản đồ ngoại tuyến theo khu đã xem.
              urlPattern: ({ url }) =>
                /(\/vt\/|tile\.openstreetmap|arcgisonline|\/styles\/|\/\d+\/\d+\/\d+\.png)/.test(url.href),
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles',
                expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
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
  };
});

