import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/queryClient';
import { Toaster } from './components/Toast';
import { registerSW } from 'virtual:pwa-register';
import { flushQueue } from './lib/offlineQueue';
import './styles/global.css';

// M25/M26 — Đăng ký service worker (chỉ hoạt động ở bản build; dev đã tắt).
// Tự cập nhật khi có phiên bản mới, không chặn thao tác người dùng.
registerSW({ immediate: true });

// M26 — Khi khôi phục kết nối, tự đẩy hàng đợi thay đổi ngoại tuyến lên máy chủ.
window.addEventListener('online', () => {
  flushQueue().catch(() => undefined);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
