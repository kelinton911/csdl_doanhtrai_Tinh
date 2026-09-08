import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { login } from './helpers';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X). Chuỗi tự chứa (không phụ thuộc seed ledger):
// lập đợt (scope org) → cutoff + book_snapshot → phiếu blind (autosave) → đối chiếu (UNBOOKED) →
// chốt official + khóa → điều chỉnh → DT-05 POST → dataset gắn snapshot_version.
test.describe.serial('DT-10 — kiểm kê 3 lớp & chốt số liệu', () => {
  test('cutoff+book → blind → variance → official+lock → điều chỉnh→DT-05 → dataset', async ({ page }) => {
    const org = randomUUID();
    const material = randomUUID();
    const code = `KK-E2E-${Date.now().toString().slice(-6)}`;

    await login(page, 'admin');
    await page.goto('/dt10/inventory-count');
    await expect(page.getByRole('heading', { name: 'Kiểm kê & chốt số liệu' })).toBeVisible();

    // 1) Lập đợt kiểm kê (scope organizationId để điều chỉnh đi qua DT-05).
    await page.getByPlaceholder('Mã đợt (campaign_code)').fill(code);
    await page.getByPlaceholder('Tên đợt').fill('Đợt E2E DT-10');
    await page.getByPlaceholder('organizationId phạm vi (tùy chọn)').fill(org);
    await page.getByRole('button', { name: 'Lập đợt' }).click();

    // Đợt được chọn → panel chi tiết + bước Cutoff & book_snapshot hiển thị.
    await expect(page.getByRole('button', { name: /Dựng book_snapshot/ })).toBeVisible({ timeout: 15_000 });

    // 2) Cutoff + dựng book_snapshot (bất biến, checksum).
    await page.getByRole('button', { name: /Chốt cutoff/ }).click();
    await page.getByRole('button', { name: /Dựng book_snapshot/ }).click();
    await expect(page.getByText(/checksum/).first()).toBeVisible({ timeout: 15_000 });

    // 3) Phiếu kiểm đếm blind + autosave.
    await page.getByRole('button', { name: /Kiểm đếm \(blind\)/ }).click();
    await page.getByRole('button', { name: 'Tạo phiếu' }).click();
    await page.getByPlaceholder('material_catalog_id').fill(material);
    await page.getByPlaceholder('Số thực đếm').fill('10');
    // Chờ autosave (debounce 1.2s) → hiển thị "đã lưu".
    await expect(page.getByText(/đã lưu/).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Gửi phiếu' }).click();

    // 4) Đối chiếu → chênh lệch UNBOOKED (có thực không sổ).
    await page.getByRole('button', { name: /Đối chiếu lệch/ }).click();
    await page.getByRole('button', { name: /Đối chiếu Book/ }).click();
    await expect(page.getByText('Có thực không sổ').first()).toBeVisible({ timeout: 15_000 });

    // 5) Chốt official + khóa bất biến.
    await page.getByRole('button', { name: /Chốt chính thức & khóa/ }).click();
    await page.getByRole('button', { name: 'Chốt số chính thức' }).click();
    await expect(page.getByText(/version 1/).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Khóa', exact: true }).click();
    await expect(page.getByText(/ĐÃ KHÓA/).first()).toBeVisible({ timeout: 15_000 });

    // 6) Điều chỉnh → DT-05 (CONVERSION POSTED).
    await page.getByRole('button', { name: /Điều chỉnh → DT-05/ }).click();
    await page.getByRole('button', { name: 'Lập điều chỉnh' }).first().click();
    await page.getByRole('button', { name: 'Duyệt → DT-05' }).first().click();
    await expect(page.getByText('POSTED').first()).toBeVisible({ timeout: 15_000 });

    // 7) Dataset gắn snapshot_version (→ DT-11).
    await page.getByRole('button', { name: /Dataset & hậu kiểm/ }).click();
    await page.getByRole('button', { name: /Sinh dataset/ }).click();
    // Dòng dataset xuất hiện trong bảng (ô "Biểu" = 03/KK) — không phải <option> ẩn của select.
    await expect(page.getByRole('cell', { name: '03/KK', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
