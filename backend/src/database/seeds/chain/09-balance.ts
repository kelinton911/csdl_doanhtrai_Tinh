// [09] DT-09 — Nguồn địa bàn & cân đối (Quyển IX). Mỗi xã: nguồn tại chỗ + xác minh VERIFIED →
// balance_plan NHẬN supply_required THẬT từ run DT-08 (không tính lại NC) + giữ chỗ (chống overbooking)
// → balance_snapshot khoá. gap = supply_required − Σ giữ chỗ ACTIVE.
import 'reflect-metadata';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { TerritorialSource } from '../../../modules/dt09-balance/entities/territorial-source.entity';
import { SourceMaterial } from '../../../modules/dt09-balance/entities/source-material.entity';
import { SourceVerification } from '../../../modules/dt09-balance/entities/source-verification.entity';
import { BalancePlan } from '../../../modules/dt09-balance/entities/balance-plan.entity';
import { BalanceLine } from '../../../modules/dt09-balance/entities/balance-line.entity';
import { SourceReservation } from '../../../modules/dt09-balance/entities/source-reservation.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../../../modules/dt09-balance/entities/balance-snapshot.entity';
import { BalancePlanStatus, ReservationStatus, VerificationStatus } from '../../../modules/dt09-balance/dt09.enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, CHAIN, T_SNAPSHOT } from './_shared/demo-ids';

export async function run(ds: DataSource): Promise<void> {
  const sourceRepo = ds.getRepository(TerritorialSource);
  const sourceMatRepo = ds.getRepository(SourceMaterial);
  const verifyRepo = ds.getRepository(SourceVerification);
  const planRepo = ds.getRepository(BalancePlan);
  const lineRepo = ds.getRepository(BalanceLine);
  const reservationRepo = ds.getRepository(SourceReservation);
  const snapRepo = ds.getRepository(BalanceSnapshot);
  const snapLineRepo = ds.getRepository(BalanceSnapshotLine);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nPlan = 0;

  for (const c of communes) {
    const planCode = CHAIN.balancePlanCode(c.orgCode);
    if (await planRepo.findOne({ where: { planCode } })) continue;

    // Run DT-08 của xã (cấp supply_required).
    const runRow = await ds.query(
      `SELECT r.id, r.output_hash FROM calculation_run r
         JOIN calculation_scenario s ON s.id = r.scenario_id
        WHERE s.scenario_code = $1 ORDER BY r.run_no DESC LIMIT 1`,
      [CHAIN.scenarioCode(c.orgCode)],
    );
    if (!runRow?.[0]) continue; // chưa có DT-08 → bỏ qua xã này
    const runId: string = runRow[0].id;
    const outputHash: string | null = runRow[0].output_hash ?? null;

    const supplyRows: Array<{ material_catalog_id: string; supply_required: string }> = await ds.query(
      `SELECT material_catalog_id, supply_required FROM material_calculation
        WHERE run_id = $1 AND supply_required IS NOT NULL AND supply_required::numeric > 0`,
      [runId],
    );
    if (supplyRows.length === 0) {
      // Không có nhu cầu dương → vẫn tạo plan rỗng (đủ đối chiếu), nhưng bỏ qua để gọn.
      continue;
    }

    // Nguồn tại chỗ + xác minh VERIFIED (một nguồn phục vụ mọi dòng).
    const sourceCode = CHAIN.territorialSourceCode(c.orgCode);
    let source = await sourceRepo.findOne({ where: { sourceCode } });
    if (!source) {
      source = await sourceRepo.save(
        sourceRepo.create({
          sourceCode,
          name: `Nguồn cung địa bàn ${c.areaName}`,
          adminUnitId: c.areaId,
          areaId: c.areaId,
          sourceType: 'SUPPLIER',
          ownerName: 'HTX/Doanh nghiệp địa bàn',
          address: c.areaName,
          effectiveFrom: '2026-01-01',
          status: 'ACTIVE',
        }),
      );
    }

    // Kế hoạch cân đối (LOCKED bất biến).
    const plan = await planRepo.save(
      planRepo.create({
        planCode,
        name: `Cân đối bảo đảm ${c.orgCode} 2026`,
        scenarioRunId: runId,
        status: BalancePlanStatus.DRAFT,
        revisionNo: 1,
        scopeJson: { organizationId: c.orgId },
        sourceOutputHash: outputHash,
        deadlineDays: 90,
      }),
    );

    const snapLinesData: Array<{ materialCatalogId: string; supply: number; planned: number; gap: number; reservations: unknown[] }> = [];
    for (const s of supplyRows) {
      const supply = Number(s.supply_required);
      const reserved = Math.min(supply, 40);
      const gap = Math.max(0, supply - reserved);
      const status = gap === 0 ? 'COVERED' : reserved > 0 ? 'PARTIAL' : 'OPEN';
      const line = await lineRepo.save(
        lineRepo.create({
          planId: plan.id, materialCatalogId: s.material_catalog_id,
          supplyRequired: String(supply), plannedSourceQty: String(reserved), gapQty: String(gap), status,
        }),
      );

      // source_material + verification cho vật chất này.
      let sm = await sourceMatRepo.findOne({ where: { sourceId: source.id, materialCatalogId: s.material_catalog_id } });
      if (!sm) {
        sm = await sourceMatRepo.save(
          sourceMatRepo.create({ sourceId: source.id, materialCatalogId: s.material_catalog_id, declaredQty: '100', asOfTime: T_SNAPSHOT, status: 'ACTIVE' }),
        );
        await verifyRepo.save(
          verifyRepo.create({ sourceMaterialId: sm.id, status: VerificationStatus.VERIFIED, verifiedQty: '80', verifiedAt: new Date(), method: 'FIELD_CHECK' }),
        );
      }

      // Giữ chỗ ACTIVE (Σ ACTIVE ≤ available).
      if (reserved > 0) {
        await reservationRepo.save(
          reservationRepo.create({ balanceLineId: line.id, sourceMaterialId: sm.id, reservedQty: String(reserved), priority: 100, status: ReservationStatus.ACTIVE }),
        );
      }
      snapLinesData.push({ materialCatalogId: s.material_catalog_id, supply, planned: reserved, gap, reservations: reserved > 0 ? [{ sourceCode, reserved }] : [] });
    }

    // Chốt: APPROVED → LOCKED + snapshot bất biến.
    plan.status = BalancePlanStatus.LOCKED;
    plan.lockedAt = new Date();
    const checksum = createHash('sha256').update(JSON.stringify(snapLinesData)).digest('hex').slice(0, 32);
    const fingerprint = createHash('sha256').update(`${outputHash ?? ''}|${sourceCode}`).digest('hex').slice(0, 32);
    plan.checksum = checksum;
    plan.sourceFingerprint = fingerprint;
    await planRepo.save(plan);

    const snap = await snapRepo.save(
      snapRepo.create({ planId: plan.id, planRevisionNo: 1, approvedAt: new Date(), checksum, sourceFingerprint: fingerprint, locked: true }),
    );
    for (const l of snapLinesData) {
      await snapLineRepo.save(
        snapLineRepo.create({ snapshotId: snap.id, materialCatalogId: l.materialCatalogId, supplyRequired: String(l.supply), plannedSourceQty: String(l.planned), gapQty: String(l.gap), reservationsJson: l.reservations }),
      );
    }
    nPlan++;
  }

  console.log(`  [09] DT-09: kế hoạch cân đối LOCKED +${nPlan} (supply_required từ DT-08, có GAP, snapshot khoá).`);
}

if (require.main === module) standalone(run);
