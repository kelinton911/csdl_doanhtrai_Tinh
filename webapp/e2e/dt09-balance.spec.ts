import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { login } from './helpers';

// DT-09 — Nguồn địa bàn (Quyển IX). Luồng tự chứa (không phụ thuộc seed): khai báo nguồn theo
// xã/điểm → khai báo vật chất → xác minh (UNVERIFIED→VERIFIED) → đánh giá huy động. Kiểm chứng
// vòng đời tin cậy hiển thị đúng và màn Cân đối bảo đảm sẵn sàng.
test.describe.serial('DT-09 — nguồn địa bàn & cân đối', () => {
  test('khai báo → xác minh → đánh giá huy động + màn cân đối', async ({ page }) => {
    const material = randomUUID();
    const adminUnit = randomUUID();
    const sourceName = `Nguồn E2E ${Date.now().toString().slice(-6)}`;

    await login(page, 'admin');

    // 1) Khai báo nguồn theo xã/điểm (SCR-DT09-01).
    await page.goto('/dt09/sources');
    await expect(page.getByRole('heading', { name: 'Nguồn địa bàn' })).toBeVisible();
    await page.getByPlaceholder('Tên nguồn').fill(sourceName);
    await page.getByPlaceholder('admin_unit_id (xã/điểm)').fill(adminUnit);
    await page.getByRole('button', { name: 'Khai báo nguồn' }).click();

    // Chuyển sang tab Hồ sơ nguồn — tên nguồn hiển thị.
    await expect(page.getByText(sourceName).first()).toBeVisible({ timeout: 15_000 });

    // 2) Khai báo vật chất (SCR-DT09-02).
    await page.getByPlaceholder('material_catalog_id').fill(material);
    await page.getByPlaceholder('Số lượng khai báo').fill('100');
    await page.getByRole('button', { name: 'Thêm vật chất' }).click();

    // Thẻ vật chất xuất hiện — trạng thái ban đầu Chưa xác minh.
    await expect(page.getByText('Chưa xác minh').first()).toBeVisible({ timeout: 15_000 });

    // 3) Xác minh VERIFIED (BR-DT09-001/002).
    await page.getByPlaceholder('verified_qty').fill('100');
    await page.getByPlaceholder('Hết hạn (YYYY-MM-DD)').fill('2027-12-31');
    await page.getByRole('button', { name: 'Xác minh' }).click();
    await expect(page.getByText('Đã xác minh').first()).toBeVisible({ timeout: 15_000 });

    // 4) Đánh giá huy động ≤ verified (BR-DT09-003).
    await page.getByPlaceholder('mobilizable_qty').fill('60');
    await page.getByPlaceholder('lead_time (ngày)').fill('3');
    await page.getByRole('button', { name: 'Đánh giá huy động' }).click();
    await expect(page.getByText(/huy động 60/).first()).toBeVisible({ timeout: 15_000 });

    // 5) Màn cân đối bảo đảm sẵn sàng (SCR-DT09-04).
    await page.goto('/dt09/balance');
    await expect(page.getByRole('heading', { name: 'Cân đối bảo đảm' })).toBeVisible();
    await expect(page.getByPlaceholder('scenario_run_id (DT-08)')).toBeVisible();
  });
});
