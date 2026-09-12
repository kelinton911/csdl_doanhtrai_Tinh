import { Workbook } from 'exceljs';

// Đọc bảng từ tệp tải lên: CSV hoặc .xlsx/.xls (dùng exceljs). Ô rỗng = ''.
// Dùng chung cho mọi luồng import (khai báo vật chất, doanh trại, khu đất…).
export async function parseTabular(
  file: { originalname: string; buffer: Buffer },
): Promise<{ headers: string[]; rows: string[][] }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.originalname);
  if (isExcel) {
    const wb = new Workbook();
    // Node Buffer → ArrayBuffer đúng kiểu exceljs mong đợi.
    const ab = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    ) as ArrayBuffer;
    await wb.xlsx.load(ab);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    const all: string[][] = [];
    ws.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1); // exceljs: [0] là undefined
      all.push(vals.map((v) => (v == null ? '' : String(v).trim())));
    });
    if (all.length === 0) return { headers: [], rows: [] };
    return { headers: all[0], rows: all.slice(1).filter((r) => r.some((c) => c !== '')) };
  }
  const text = file.buffer.toString('utf8').replace(/^﻿/, '');
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (l: string) => l.split(',').map((c) => c.trim());
  return { headers: split(lines[0]), rows: lines.slice(1).map(split) };
}

// Chuẩn hóa chuỗi tiếng Việt: bỏ dấu + hạ chữ + gộp khoảng trắng (khớp tên/alias/cột).
export function normalizeText(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Chuẩn hóa tên cột: bỏ dấu + hạ chữ + bỏ ký tự không phải chữ/số (khớp mềm header).
export function normalizeHeader(h: string): string {
  return normalizeText(h).replace(/[^a-z0-9]/g, '');
}
