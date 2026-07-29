import { defineConfig } from '@playwright/test';

// E2E cho 5 luồng nghiệp vụ chủ đạo (Frontend §7). Backend phải đang chạy (BACKEND_ORIGIN).
// Trình duyệt: mặc định Google Chrome hệ thống (host); trong container e2e đặt
// PW_CHANNEL=chromium để dùng Chromium bundled (đã chạy `playwright install`).
const PORT = 5190;
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3000';
const rawChannel = process.env.PW_CHANNEL ?? 'chrome';
// 'chromium' hoặc rỗng → dùng Chromium bundled (bỏ channel); còn lại giữ nguyên channel.
const channel = rawChannel === 'chromium' || rawChannel === '' ? undefined : rawChannel;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...(channel ? { channel } : {}),
    headless: true,
    actionTimeout: 15_000,
    trace: 'off',
  },
  webServer: {
    command: `BACKEND_ORIGIN=${BACKEND} npx vite --port ${PORT} --strictPort --host`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
