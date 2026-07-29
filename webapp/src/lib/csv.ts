// Tiện ích xuất nhanh dữ liệu ĐANG XEM ra CSV (client-side). KHÔNG thay module Báo cáo (snapshot
// chính thức, có thời điểm chốt) — đây chỉ là export tiện lợi cho bảng hiện hành. Dùng BOM UTF-8 để
// Excel mở đúng tiếng Việt.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  // Bọc trong dấu " nếu chứa dấu phẩy/nháy/xuống dòng; nhân đôi dấu " bên trong.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(',')).join('\r\n');
  return body ? `${head}\r\n${body}` : head;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
