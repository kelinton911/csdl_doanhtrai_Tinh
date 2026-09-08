import { test, expect } from '@playwright/test';
import { login } from './helpers';

// DT-12 — Dashboard chỉ huy & hỗ trợ quyết định (Quyển XII). Chuỗi nghiệm thu qua webapp:
// tính KPI (semantic + freshness + lineage) → semantic explorer → drill-down KPI về nguồn (khớp tổng) →
// quét cảnh báo vượt ngưỡng (lifecycle) → refresh Data Mart (freshness) → what-if cách ly → ghi quyết định.
// Yêu cầu đã chạy: npm run seed:dashboard-dt12 (7 KPI + alert_rule + nguồn demo HC=180…GAP=10).
test.describe.serial('DT-12 — Dashboard chỉ huy: KPI semantic + lineage + cảnh báo + what-if', () => {
  test('KPI + freshness → drill-down khớp nguồn → cảnh báo → data mart → what-if → quyết định', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dt12/command');
    await expect(page.getByRole('heading', { name: 'Dashboard chỉ huy & hỗ trợ quyết định' })).toBeVisible();

    // SCR-01 — tính toàn bộ KPI (as_of_time + lineage + freshness)
    await page.getByRole('button', { name: /Tính tất cả KPI/ }).click();
    await expect(page.getByText('Hiện có (HC)').first()).toBeVisible({ timeout: 15_000 });
    // Thẻ KPI có badge độ tươi (FRESH/STALE) — chứng minh metric có freshness
    await expect(page.getByText(/lineage: \d+ nguồn/).first()).toBeVisible({ timeout: 15_000 });

    // SCR-04 — semantic explorer hiển thị đủ semantic phân biệt (GAP)
    await expect(page.getByText('Thiếu hụt (GAP)').first()).toBeVisible();

    // SCR-03 — drill-down KPI HC → dòng snapshot nguồn, khớp tổng
    await page.getByText('Hiện có (HC)').first().click();
    await expect(page.getByText('KHỚP')).toBeVisible({ timeout: 15_000 });

    // SCR-05 — quét cảnh báo vượt ngưỡng (GAP demo=10 ≥ critical 8 ⇒ Nghiêm trọng), lifecycle tiếp nhận
    const alertsPanel = page.locator('.panel', { hasText: 'Cảnh báo (OPEN' });
    await alertsPanel.getByRole('button', { name: 'Quét cảnh báo' }).click();
    await expect(alertsPanel.getByText('Nghiêm trọng').first()).toBeVisible({ timeout: 15_000 });
    await alertsPanel.getByRole('button', { name: 'Tiếp nhận' }).first().click();
    await expect(alertsPanel.getByText('Đã tiếp nhận').first()).toBeVisible({ timeout: 15_000 });

    // SCR-08 — refresh Data Mart (qua outbox) → độ tươi FRESH
    const dmPanel = page.locator('.panel', { hasText: 'Độ tươi dữ liệu & nguồn' });
    await dmPanel.getByRole('button', { name: 'Refresh' }).first().click();
    await expect(dmPanel.getByText('Mới').first()).toBeVisible({ timeout: 15_000 });

    // SCR-06/07 — what-if cách ly → chấm điểm → ghi quyết định
    const whatIfPanel = page.locator('.panel', { hasText: 'What-if & hỗ trợ quyết định' });
    await whatIfPanel.getByRole('button', { name: 'Mở phiên what-if' }).click();
    await expect(whatIfPanel.getByRole('button', { name: 'Chấm điểm phương án' })).toBeVisible({ timeout: 15_000 });
    await whatIfPanel.getByRole('button', { name: 'Chấm điểm phương án' }).click();
    await expect(whatIfPanel.getByText(/Xếp hạng phương án/)).toBeVisible({ timeout: 15_000 });
    await whatIfPanel.getByRole('button', { name: 'Ghi quyết định' }).click();
    await expect(whatIfPanel.getByText(/Đã ghi quyết định/)).toBeVisible({ timeout: 15_000 });
  });
});
