// Seed mẫu kỹ thuật DT-03 (Quyển III) từ ma-ky-hieu-doanh-cu-thiet-ke-mau.csv.
// Mỗi dòng CSV (ma_ky_hieu, ten, nhom_chinh) → một product_model DRAFT. Idempotent theo mã.
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import dataSource from '../data-source';
import { ProductModel } from '../../modules/dt03-technical/entities/product-model.entity';
import { ModelStatus } from '../../modules/dt03-technical/tech.enums';

// Parser CSV tối giản có xử lý dấu ngoặc kép bao trường (tên có dấu phẩy).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// Tách năm thiết kế (4 chữ số) từ ký hiệu, nếu có (VD ...-2016-...).
function extractYear(symbol: string): string | null {
  const m = /(\d{4})/.exec(symbol);
  return m ? m[1] : null;
}

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(ProductModel);
  const csvPath = join(__dirname, '..', '..', '..', '..', 'docs', 'thu-thap-csdl', 'ma-ky-hieu-doanh-cu-thiet-ke-mau.csv');
  const raw = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (i === 0 && /ma_ky_hieu/i.test(cells[0])) continue; // header
    const [symbol, name, group] = cells;
    if (!symbol || !name) continue;
    const existing = await repo.findOne({ where: { modelCodeInternal: symbol } });
    if (existing) { skipped++; continue; }
    await repo.save(
      repo.create({
        modelCodeInternal: symbol,
        modelName: name,
        designSymbol: symbol,
        designYear: extractYear(symbol),
        technologyGroup: group ?? null,
        issuingAuthority: /TCHC/i.test(symbol) ? 'TCHC' : null,
        status: ModelStatus.ACTIVE,
      }),
    );
    created++;
  }

  console.log(`DT-03 seed mẫu kỹ thuật: +${created} mẫu (bỏ qua ${skipped}) từ ${lines.length - 1} dòng CSV.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
