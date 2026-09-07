import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { login } from './helpers';

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC (Quyển VIII). Luồng tự chứa (không phụ
// thuộc seed): lập kịch bản với vật chất lạ + KHÔNG có snapshot HC → chạy engine → dòng bị
// đánh dấu NO_RULE/NO_HC_SNAPSHOT (KHÔNG ngầm quy 0 — BR-DT08-008/021), hiện ở hàng chờ ngoại lệ.
test.describe.serial('DT-08 — tính nhu cầu vật chất', () => {
  test('lập kịch bản → chạy engine → NO_RULE (không quy 0) + hàng chờ ngoại lệ', async ({ page }) => {
    const material = randomUUID();
    const name = `KB E2E ${Date.now().toString().slice(-6)}`;

    await login(page, 'admin');
    await page.goto('/calculation');
    await expect(page.getByRole('heading', { name: 'Tính toán nhu cầu vật chất' })).toBeVisible();

    // 1) Lập kịch bản: tên + 1 vật chất lạ (không có định mức).
    await page.getByPlaceholder('Tên kịch bản').fill(name);
    await page.getByPlaceholder('material_catalog_id (UUID)').first().fill(material);
    await page.getByRole('button', { name: 'Lập kịch bản' }).click();

    // 2) Kịch bản được chọn → chi tiết hiện nút "Chạy engine".
    await expect(page.getByRole('button', { name: /Chạy engine/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Chạy engine/ }).click();

    // 3) Chuyển sang bảng kết quả NC; hàng chờ ngoại lệ có NO_RULE (không tính = 0).
    await expect(page.getByText('Bảng kết quả NC (SCR-DT08-03)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Không có định mức (không tính = 0)').first()).toBeVisible({ timeout: 15_000 });
  });
});
