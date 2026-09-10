// [04] DT-04 — Thực lực vật chất (Quyển IV). Với mỗi xã đại diện: lô + giao dịch RECEIPT POSTED
// cho tập CORE + vài cá thể tài sản; rồi dựng materiel_snapshot KHOÁ từ MOVEMENT THẬT (HC as-of).
// HC(t) = Σ quantity_signed POSTED, effective_time ≤ as_of. Idempotent theo transaction_no/lot_code/snapshot_code.
import 'reflect-metadata';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { InventoryLot } from '../../../modules/dt04-materiel/entities/inventory-lot.entity';
import { AssetInstance } from '../../../modules/dt04-materiel/entities/asset-instance.entity';
import { MaterielMovement } from '../../../modules/dt04-materiel/entities/materiel-movement.entity';
import { MaterielSnapshot } from '../../../modules/dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../../../modules/dt04-materiel/entities/materiel-snapshot-line.entity';
import { LotStatus, AssetStatus } from '../../../modules/dt04-materiel/dt04.enums';
import { MovementStatus, MovementType } from '../../../modules/dt04-materiel/materiel-rules';
import { QualityGrade } from '../../../common/enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, MATERIALS, CORE_MATERIAL_CODES, CHAIN, T_RECEIPT, T_SNAPSHOT } from './_shared/demo-ids';

const CORE = MATERIALS.filter((m) => CORE_MATERIAL_CODES.includes(m.code));

export async function run(ds: DataSource): Promise<void> {
  const lotRepo = ds.getRepository(InventoryLot);
  const assetRepo = ds.getRepository(AssetInstance);
  const moveRepo = ds.getRepository(MaterielMovement);
  const snapRepo = ds.getRepository(MaterielSnapshot);
  const lineRepo = ds.getRepository(MaterielSnapshotLine);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nMove = 0;
  let nSnap = 0;

  for (let i = 0; i < communes.length; i++) {
    const c = communes[i];
    // Kho của xã (DT-02) để gắn vị trí lô.
    const kho = await ds.query(`SELECT id FROM storage_locations WHERE code = $1 LIMIT 1`, [`KHO-38-${String(i + 1).padStart(2, '0')}`]);
    const locationId: string | null = kho?.[0]?.id ?? null;

    for (let j = 0; j < CORE.length; j++) {
      const mat = CORE[j];
      const qty = 120 + i * 20 + j * 15;

      // Lô.
      const lotCode = CHAIN.lotCode(c.orgCode, mat.code);
      let lot = await lotRepo.findOne({ where: { lotCode } });
      if (!lot) {
        lot = await lotRepo.save(
          lotRepo.create({
            lotCode,
            materialCatalogId: mat.id,
            organizationId: c.orgId,
            primaryLocationId: locationId,
            receivedDate: '2026-03-01',
            manufactureYear: String(2022 + (j % 3)),
            status: LotStatus.ACTIVE,
          }),
        );
      }

      // Giao dịch RECEIPT POSTED (+qty).
      const txNo = CHAIN.movementNo(c.orgCode, mat.code, 1);
      if (!(await moveRepo.findOne({ where: { transactionNo: txNo } }))) {
        await moveRepo.save(
          moveRepo.create({
            transactionNo: txNo,
            transactionType: MovementType.RECEIPT,
            materialCatalogId: mat.id,
            lotId: lot.id,
            quantity: String(qty),
            quantitySigned: String(qty),
            organizationId: c.orgId,
            toLocationId: locationId,
            effectiveTime: T_RECEIPT,
            postedAt: T_RECEIPT,
            status: MovementStatus.POSTED,
          }),
        );
        nMove++;
      }

      // Cá thể tài sản cho hàng kỹ thuật (máy phát điện) — 1 cái/xã.
      if (mat.code === 'R00.04.01') {
        const assetCode = CHAIN.assetCode(c.orgCode);
        if (!(await assetRepo.findOne({ where: { assetCode } }))) {
          await assetRepo.save(
            assetRepo.create({
              assetCode,
              materialCatalogId: mat.id,
              lotId: lot.id,
              serialNumber: `SN-${c.orgCode}-MPD-01`,
              organizationId: c.orgId,
              locationId,
              qualityCurrent: QualityGrade.C1,
              status: AssetStatus.ACTIVE,
              qrValue: `QR:${assetCode}`,
            }),
          );
        }
      }
    }

    // Snapshot HC as-of từ MOVEMENT THẬT (Σ signed POSTED ≤ T_SNAPSHOT).
    const snapCode = CHAIN.materielSnapshotCode(c.orgCode);
    if (!(await snapRepo.findOne({ where: { snapshotCode: snapCode } }))) {
      const hcRows: Array<{ material_catalog_id: string; hc: string }> = await ds.query(
        `SELECT material_catalog_id, COALESCE(SUM(quantity_signed),0) AS hc
           FROM materiel_movement
          WHERE organization_id = $1 AND status = 'POSTED' AND effective_time <= $2
          GROUP BY material_catalog_id HAVING COALESCE(SUM(quantity_signed),0) > 0`,
        [c.orgId, T_SNAPSHOT],
      );
      const checksum = createHash('sha256')
        .update(JSON.stringify(hcRows.map((r) => [r.material_catalog_id, r.hc]).sort()))
        .digest('hex')
        .slice(0, 32);
      const snap = await snapRepo.save(
        snapRepo.create({
          snapshotCode: snapCode,
          asOfTime: T_SNAPSHOT,
          scope: { organizationId: c.orgId },
          checksum,
          locked: true,
          lockedAt: new Date(),
        }),
      );
      for (const r of hcRows) {
        const hc = Number(r.hc);
        const g1 = Math.round(hc * 0.7);
        const g2 = Math.round(hc * 0.2);
        const g3 = Math.max(0, hc - g1 - g2);
        const price = MATERIALS.find((m) => m.id === r.material_catalog_id)?.price ?? 0;
        await lineRepo.save(
          lineRepo.create({
            snapshotId: snap.id,
            materialCatalogId: r.material_catalog_id,
            organizationId: c.orgId,
            quantityOnHand: String(hc),
            grade1: String(g1),
            grade2: String(g2),
            grade3: String(g3),
            grade4: '0',
            grade5: '0',
            value: (hc * price).toFixed(2),
          }),
        );
      }
      nSnap++;
    }
  }

  console.log(`  [04] DT-04: giao dịch RECEIPT POSTED +${nMove} · materiel_snapshot khoá +${nSnap} (HC từ sổ cái thật).`);
}

if (require.main === module) standalone(run);
