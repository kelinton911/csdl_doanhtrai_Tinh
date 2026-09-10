// [10] DT-10 — Kiểm kê & chốt số liệu (Quyển X). Mỗi xã: đợt kiểm kê + cutoff → book_snapshot từ
// MOVEMENT THẬT DT-04/05 (Σ signed POSTED ≤ cutoff, khoá) → official_snapshot khoá (physical = book,
// không chênh) theo scope xã (phục vụ rollup DT-11). Idempotent theo campaign_code.
import 'reflect-metadata';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { InventoryCountCampaign } from '../../../modules/dt10-inventory-count/entities/inventory-count-campaign.entity';
import { BookSnapshot, BookSnapshotLine } from '../../../modules/dt10-inventory-count/entities/book-snapshot.entity';
import { OfficialSnapshot, OfficialSnapshotLine, OfficialLock } from '../../../modules/dt10-inventory-count/entities/official-snapshot.entity';
import { CampaignStatus, CountType } from '../../../modules/dt10-inventory-count/dt10.enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, MATERIALS, CHAIN, T_CUTOFF } from './_shared/demo-ids';

export async function run(ds: DataSource): Promise<void> {
  const campRepo = ds.getRepository(InventoryCountCampaign);
  const bookRepo = ds.getRepository(BookSnapshot);
  const bookLineRepo = ds.getRepository(BookSnapshotLine);
  const offRepo = ds.getRepository(OfficialSnapshot);
  const offLineRepo = ds.getRepository(OfficialSnapshotLine);
  const lockRepo = ds.getRepository(OfficialLock);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nCampaign = 0;

  for (const c of communes) {
    const campaignCode = CHAIN.countCampaignCode(c.orgCode);
    if (await campRepo.findOne({ where: { campaignCode } })) continue;

    // HC tại cutoff từ sổ cái thật (DT-04 + DT-05).
    const hcRows: Array<{ material_catalog_id: string; hc: string }> = await ds.query(
      `SELECT material_catalog_id, COALESCE(SUM(quantity_signed),0) AS hc
         FROM materiel_movement
        WHERE organization_id = $1 AND status = 'POSTED' AND effective_time <= $2
        GROUP BY material_catalog_id HAVING COALESCE(SUM(quantity_signed),0) > 0`,
      [c.orgId, T_CUTOFF],
    );
    if (hcRows.length === 0) continue;

    const campaign = await campRepo.save(
      campRepo.create({
        campaignCode,
        name: `Kiểm kê định kỳ 2026 — ${c.areaName}`,
        countType: CountType.PERIODIC,
        scopeJson: { organizationId: c.orgId },
        status: CampaignStatus.DRAFT,
        note: 'Chuỗi vàng seed mẫu',
      }),
    );

    const lines = hcRows.map((r) => {
      const hc = Number(r.hc);
      const g1 = Math.round(hc * 0.7);
      const g2 = Math.round(hc * 0.2);
      const g3 = Math.max(0, hc - g1 - g2);
      const price = MATERIALS.find((m) => m.id === r.material_catalog_id)?.price ?? 0;
      return { materialCatalogId: r.material_catalog_id, qty: hc, g1, g2, g3, value: hc * price };
    });
    const checksum = createHash('sha256').update(JSON.stringify(lines.map((l) => [l.materialCatalogId, l.qty]).sort())).digest('hex').slice(0, 32);

    // BOOK snapshot (khoá) dựng từ movement thật.
    const book = await bookRepo.save(bookRepo.create({ campaignId: campaign.id, asOf: T_CUTOFF, checksum, locked: true }));
    for (const l of lines) {
      await bookLineRepo.save(
        bookLineRepo.create({
          snapshotId: book.id, materialCatalogId: l.materialCatalogId, organizationId: c.orgId,
          bookQty: String(l.qty), grade1: String(l.g1), grade2: String(l.g2), grade3: String(l.g3), grade4: '0', grade5: '0', value: l.value.toFixed(2),
        }),
      );
    }

    // OFFICIAL snapshot (physical = book, không chênh) + khoá bất biến.
    const official = await offRepo.save(
      offRepo.create({ campaignId: campaign.id, version: 1, approvedAt: new Date(), checksum: `${checksum}-off` }),
    );
    for (const l of lines) {
      await offLineRepo.save(
        offLineRepo.create({
          snapshotId: official.id, materialCatalogId: l.materialCatalogId, organizationId: c.orgId,
          officialQty: String(l.qty), grade1: String(l.g1), grade2: String(l.g2), grade3: String(l.g3), grade4: '0', grade5: '0', value: l.value.toFixed(2),
        }),
      );
    }
    await lockRepo.save(lockRepo.create({ campaignId: campaign.id, snapshotId: official.id, snapshotVersion: 1, lockedAt: new Date() }));

    campaign.status = CampaignStatus.OFFICIAL_LOCKED;
    await campRepo.save(campaign);
    nCampaign++;
  }

  console.log(`  [10] DT-10: đợt kiểm kê + book/official snapshot khoá +${nCampaign} (từ sổ cái thật, scope xã).`);
}

if (require.main === module) standalone(run);
