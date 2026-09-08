import { test, expect } from '@playwright/test';
import { login } from './helpers';

// DT-11 — Báo cáo & biểu mẫu (Quyển XI). Chuỗi nghiệm thu qua webapp:
// thêm biểu bằng cấu hình (không sửa code) → sinh dataset từ official snapshot demo (DT-10) → validate →
// lập báo cáo → duyệt → phát hành (checksum) → phát hành lại (version) → truy vết ô → tổng hợp (chưa gửi ≠ 0).
// Yêu cầu đã chạy: npm run seed:report-dt11 (tạo official_snapshot demo campaignId cố định).
const DEMO_CAMPAIGN_ID = '00000000-0000-0000-0000-0000000d1100';

test.describe.serial('DT-11 — Report Engine cấu hình + phát hành + lineage + rollup', () => {
  test('cấu hình biểu → dataset → validate → phát hành (checksum) → phát hành lại → lineage → rollup', async ({ page }) => {
    const formCode = `E2E-${Date.now().toString().slice(-6)}/KK`;

    await login(page, 'admin');
    await page.goto('/dt11/reports');
    await expect(page.getByRole('heading', { name: 'Báo cáo & biểu mẫu' })).toBeVisible();

    // 1) SCR-01/02/03 — thêm biểu mới bằng CẤU HÌNH (BR-DT11-019, không sửa code)
    await page.getByPlaceholder('Mã biểu (vd 09/KK)').fill(formCode);
    await page.getByPlaceholder('Tên biểu').fill('Biểu E2E DT-11');
    await page.getByRole('button', { name: /Thêm biểu \(không sửa code\)/ }).click();
    await expect(page.getByRole('heading', { name: new RegExp(formCode.replace('/', '\\/')) })).toBeVisible({ timeout: 15_000 });

    // 2) SCR-04 — sinh dataset từ official snapshot demo (DT-10) + validate
    await page.getByPlaceholder('campaignId (nguồn DT-10 official snapshot)').fill(DEMO_CAMPAIGN_ID);
    await page.getByRole('button', { name: /Sinh dataset/ }).click();
    await expect(page.getByText('dataset_hash:')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Validate dataset/ }).click();
    await expect(page.getByText('RECONCILIATION')).toBeVisible({ timeout: 15_000 });

    // 3) SCR-05/07 — lập báo cáo → validate → duyệt → phát hành (checksum bất biến)
    const workflow = page.locator('.panel', { hasText: '5–7 · Lập báo cáo' });
    await page.getByRole('button', { name: 'Lập báo cáo' }).click();
    await expect(workflow.getByText(/RPT-/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Validate', exact: true }).click();
    await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await page.getByRole('button', { name: 'Phát hành', exact: true }).click();
    await expect(page.getByText('checksum:')).toBeVisible({ timeout: 15_000 });

    // 4) SCR-08 — truy vết ô → dataset → snapshot
    await expect(page.getByText('8 · Truy vết ô → dataset → snapshot')).toBeVisible();
    await expect(page.getByText(/:total/).first()).toBeVisible({ timeout: 15_000 });

    // 5) SCR-06 — tổng hợp nhiều đơn vị: đơn vị chưa gửi ≠ 0
    await page.getByRole('button', { name: /Tổng hợp A/ }).click();
    await expect(page.getByText(/Chưa gửi: 1/)).toBeVisible({ timeout: 15_000 });

    // 6) SCR-09 — phát hành lại: version mới (báo cáo v2 xuất hiện trong kho)
    await page.getByRole('button', { name: /Phát hành lại \(version\)/ }).click();
    await expect(page.getByText('v2').first()).toBeVisible({ timeout: 15_000 });
  });
});
