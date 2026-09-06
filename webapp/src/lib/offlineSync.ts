/**
 * Tiện ích Đồng bộ File nén USB Offline cho Webapp Frontend (P08)
 */

export interface ExportPackageResult {
  packageId: string;
  exportedAt: string;
  recordCount: number;
  encryptedPayload: string;
  iv: string;
  authTag: string;
  checksum: string;
  algorithm: string;
}

/**
 * Trích xuất gói dữ liệu đồng bộ mã hóa AES-256-GCM để chép sang USB
 */
export async function exportOfflineUsbPackage(scope?: string, token?: string): Promise<ExportPackageResult> {
  const url = scope
    ? `/api/v1/sync/export-offline-package?scope=${encodeURIComponent(scope)}`
    : '/api/v1/sync/export-offline-package';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (!res.ok) {
    throw new Error('Trích xuất gói đồng bộ USB thất bại');
  }

  return res.json();
}

/**
 * Nạp gói dữ liệu đồng bộ mã hóa từ đĩa USB
 */
export async function importOfflineUsbPackage(
  packageData: { encryptedPayload: string; iv: string; authTag: string; checksum: string },
  token?: string,
) {
  const res = await fetch('/api/v1/sync/import-offline-package', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(packageData),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Nạp gói đồng bộ USB thất bại');
  }

  return res.json();
}
