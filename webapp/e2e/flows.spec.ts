import { test, expect } from '@playwright/test';
import { login } from './helpers';

// 5 luồng nghiệp vụ chủ đạo (Frontend §7). Chạy tuần tự (workers=1).
// Backend chạy dữ liệu giả lập; mỗi luồng dùng mã/định danh duy nhất để tái chạy được.
const uniq = () => Date.now().toString().slice(-6);

test.describe.serial('5 luồng nghiệp vụ', () => {
  test('Luồng A — cấp xã lập phiếu kiểm kê → nhập số liệu → gửi duyệt', async ({ page }) => {
    await login(page, 'hckt');
    await page.goto('/inspection');
    await page.getByRole('button', { name: 'Tạo phiếu' }).click();
    await expect(page.getByText('Tạo phiếu kiểm kê')).toBeVisible();
    await page.locator('label:has-text("Doanh trại") + select').selectOption({ index: 1 });
    await page.getByRole('button', { name: /Tạo .* nhập số liệu/ }).click();
    await page.waitForURL('**/inspection/sheet/**', { timeout: 20_000 });

    // Bước 1 → Nhập số liệu
    await page.getByRole('button', { name: /Tiếp/ }).click();
    await page.getByRole('button', { name: 'Thêm dòng' }).click();
    await page.getByPlaceholder('Tên vật chất/công trình').fill('Gạo E2E');
    const nums = page.locator('input[type=number]');
    await nums.nth(0).fill('1000');
    await nums.nth(1).fill('950');
    await page.getByRole('button', { name: /Tiếp/ }).click(); // → Rà soát
    await expect(page.getByText('Rà soát chênh lệch', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Tiếp/ }).click(); // → Xác nhận
    await page.getByRole('button', { name: /Gửi duyệt/ }).click();
    await page.waitForURL('**/inspection', { timeout: 20_000 });
    await expect(page.getByText('Kiểm kê vật chất')).toBeVisible();
  });

  test('Luồng B — tỉnh kiểm duyệt phiếu → phê duyệt', async ({ page }) => {
    await login(page, 'kiemduyet');
    await page.goto('/inspection');
    // Tab Kiểm duyệt (nút tab đầu tiên có nhãn này)
    await page.getByRole('button', { name: 'Kiểm duyệt', exact: true }).first().click();
    // Nếu có phiếu chờ duyệt → mở và phê duyệt
    const openBtn = page.getByRole('button', { name: 'Kiểm duyệt', exact: false }).nth(1);
    if (await openBtn.count()) {
      await openBtn.click();
      await expect(page.getByText('Kiểm duyệt phiếu kiểm kê')).toBeVisible();
      await page.getByRole('button', { name: 'Phê duyệt' }).click();
      // Modal đóng lại sau khi duyệt
      await expect(page.getByText('Kiểm duyệt phiếu kiểm kê')).toBeHidden({ timeout: 15_000 });
    } else {
      await expect(page.getByText(/Không có phiếu chờ duyệt|Kiểm kê vật chất/)).toBeVisible();
    }
  });

  test('Luồng C — chỉ huy: dashboard → cảnh báo → xuất báo cáo', async ({ page }) => {
    await login(page, 'chihuy');
    await expect(page.getByText('Tổng số doanh trại')).toBeVisible();
    // Drill-down: trung tâm cảnh báo
    await page.goto('/alerts');
    await expect(page.getByText('Cảnh báo & xử lý')).toBeVisible();
    // Xuất báo cáo
    await page.goto('/reports');
    await page.getByText('Tổng hợp doanh trại').click();
    await page.getByRole('button', { name: /Tạo .* xuất báo cáo/ }).click();
    await expect(page.getByText('Hoàn tất').first()).toBeVisible({ timeout: 20_000 });
  });

  test('Luồng D — lập tình huống → chạy tính toán → chốt phương án', async ({ page }) => {
    await login(page, 'chihuy');
    await page.goto('/scenarios');
    await page.getByRole('button', { name: /Chạy tính toán/ }).click();
    await expect(page.getByText('Khả năng tiếp nhận')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Lưu thành phương án/ }).click();
    const chot = page.getByRole('button', { name: /Chốt phương án/ }).first();
    await expect(chot).toBeVisible({ timeout: 15_000 });
    await chot.click();
    await expect(page.getByText('Đã duyệt').first()).toBeVisible({ timeout: 15_000 });
  });

  test('Luồng E — ghi hư hỏng → lập yêu cầu sửa chữa', async ({ page }) => {
    await login(page, 'hckt');
    await page.goto('/maintenance');
    const code = `SC-E2E-${uniq()}`;
    await page.getByRole('button', { name: 'Lập yêu cầu' }).click();
    await expect(page.getByRole('heading', { name: 'Lập yêu cầu sửa chữa' })).toBeVisible();
    await page.getByPlaceholder('SC-2026-001').fill(code);
    await page.getByPlaceholder('Sửa chữa…').fill('Sửa mái kho (E2E)');
    await page.locator('label:has-text("Doanh trại") + select').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText(code)).toBeVisible({ timeout: 15_000 });
  });
});
