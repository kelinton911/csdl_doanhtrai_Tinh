import { Page, expect } from '@playwright/test';

// Đăng nhập theo tài khoản (mật khẩu demo chung admin@123).
export async function login(page: Page, username = 'admin') {
  await page.goto('/login');
  const user = page.locator('input.input').first();
  await user.click();
  await user.fill(username);
  const pw = page.locator('input[type=password]');
  await pw.click();
  await pw.fill('admin@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });
  await expect(page.getByText('Tổng quan chỉ huy').first()).toBeVisible();
}
