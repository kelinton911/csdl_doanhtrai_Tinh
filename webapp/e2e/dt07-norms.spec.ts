import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { login } from './helpers';

// DT-07 — Định mức có căn cứ + bộ chọn deterministic (Quyển VII). Luồng tự chứa (không phụ
// thuộc seed): resolve vật chất lạ → NO_RULE (không ngầm 0); biên tập tạo bộ → định mức legacy
// → công bố → resolve vẫn NO_RULE (LEGACY bị loại — BR-DT07-026) + hiện ở màn Legacy.
test.describe.serial('DT-07 — định mức & chỉ lệnh', () => {
  test('resolve NO_RULE (không ngầm 0) + biên tập LEGACY + màn Legacy', async ({ page }) => {
    const material = randomUUID();
    const setCode = `E2E-${Date.now().toString().slice(-6)}`;

    await login(page, 'admin');
    await page.goto('/norms');
    await expect(page.getByRole('heading', { name: 'Định mức & Chỉ lệnh hậu cần' })).toBeVisible();

    // 1) Resolve vật chất chưa có định mức → NO_RULE (BR-DT07-009: không trả 0).
    await page.getByPlaceholder('material_catalog_id').fill(material);
    await page.getByRole('button', { name: /Chọn định mức/ }).click();
    await expect(page.getByText('Không có định mức (không tính = 0)')).toBeVisible({ timeout: 15_000 });

    // 2) Biên tập: tạo bộ định mức.
    await page.getByRole('button', { name: 'Biên tập & nhập' }).click();
    await page.getByPlaceholder('Mã bộ (set_code)').fill(setCode);
    await page.getByPlaceholder('Tên bộ').fill('Bộ E2E DT-07');
    await page.getByRole('button', { name: 'Tạo bộ', exact: true }).click();

    // 3) Tạo phiên bản (DRAFT).
    await page.getByPlaceholder('v1').fill('v1');
    await page.getByRole('button', { name: 'Tạo phiên bản' }).click();

    // 4) Thêm định mức LEGACY (không nhập trích dẫn căn cứ).
    await page.getByPlaceholder('material_catalog_id').fill(material);
    await page.getByRole('button', { name: 'Thêm định mức', exact: true }).click();
    await expect(page.getByText(/LEGACY|chưa căn cứ/i).first()).toBeVisible({ timeout: 15_000 });

    // 5) Công bố phiên bản (DRAFT → PUBLISHED).
    await page.getByRole('button', { name: 'Công bố', exact: true }).first().click();

    // 6) Màn Legacy: bộ vừa tạo phải xuất hiện (định mức chưa có căn cứ).
    await page.getByRole('button', { name: 'Legacy chưa xác minh' }).click();
    await expect(page.getByText(setCode).first()).toBeVisible({ timeout: 15_000 });

    // 7) Resolve lại cùng vật chất → vẫn NO_RULE vì định mức LEGACY bị loại (BR-DT07-026).
    await page.getByRole('button', { name: 'Thử chọn định mức' }).click();
    await page.getByPlaceholder('material_catalog_id').fill(material);
    await page.getByRole('button', { name: /Chọn định mức/ }).click();
    await expect(page.getByText('Không có định mức (không tính = 0)')).toBeVisible({ timeout: 15_000 });
  });

  test('quản lý chỉ lệnh: tạo → phát hành → thêm yêu cầu vật chất', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/norms');
    await page.getByRole('button', { name: 'Chỉ lệnh hậu cần' }).click();

    // Tạo chỉ lệnh (auto chọn vào chi tiết).
    await page.getByPlaceholder('Tiêu đề').fill('Chỉ lệnh E2E DT-07');
    await page.getByPlaceholder('Cơ quan ban hành').fill('BTL');
    await page.getByRole('button', { name: 'Tạo chỉ lệnh' }).click();

    // Phát hành (DRAFT → ISSUED).
    await page.getByRole('button', { name: 'Phát hành', exact: true }).click();
    await expect(page.getByText('Đã phát hành').first()).toBeVisible({ timeout: 15_000 });

    // Thêm yêu cầu vật chất → xuất hiện nút "Phân giao" của dòng yêu cầu.
    await page.getByPlaceholder('material_catalog_id').fill(randomUUID());
    await page.locator('input[type=number]').first().fill('100');
    await page.getByRole('button', { name: 'Thêm yêu cầu' }).click();
    await expect(page.getByRole('button', { name: 'Phân giao' }).first()).toBeVisible({ timeout: 15_000 });
  });
});
