// Seed danh mục C3 (Sprint 0 §1 GAP-9 — ma trận truy vết vận hành).
// Idempotent: chạy lại chỉ cập nhật theo c3_code, không sinh trùng.
import 'reflect-metadata';
import dataSource from '../data-source';
import { C3Catalog } from '../../modules/c3-catalog/entities/c3-catalog.entity';
import { C3_CATALOG_SEED } from './data/c3-catalog.data';

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(C3Catalog);

  let created = 0;
  let updated = 0;
  for (const row of C3_CATALOG_SEED) {
    const existing = await repo.findOne({ where: { c3Code: row.c3Code } });
    if (existing) {
      await repo.update(existing.id, row);
      updated++;
    } else {
      await repo.insert(repo.create(row));
      created++;
    }
  }

  console.log(`C3 catalog seed: +${created} mới, cập nhật ${updated} (tổng ${C3_CATALOG_SEED.length}).`);
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
