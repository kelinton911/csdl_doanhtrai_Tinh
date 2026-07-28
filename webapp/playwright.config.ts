import { defineConfig } from '@playwright/test';

// E2E cho 5 luồng nghiệp vụ chủ đạo (Frontend §7). Dùng Google Chrome hệ thống (channel),
// không tải trình duyệt riêng. Backend phải đang chạy (đọc cổng qua BACKEND_ORIGIN).
const PORT = 5190;
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3000';

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
    channel: 'chrome',
    headless: true,
    actionTimeout: 15_000,
    trace: 'off',
  },
  webServer: {
    command: `BACKEND_ORIGIN=${BACKEND} npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
