// Integration test DT-09 — chạy trên DB THẬT (persistence + giao dịch giữ chỗ chống overbooking +
// snapshot bất biến). KHÔNG lọt vào `npm test` (tên *.int-spec.ts). Chạy: `npm run test:int` (cần DB dev).
// CalcService (DT-08) & DocumentsService (DT-05) được giả lập ở ranh giới module — chỉ dùng
// supplyRequired()/createDocument() — để cô lập nghiệp vụ DT-09.
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { BusinessError, BusinessException } from '../../common/errors/business-error';

import { SourceService } from './source.service';
import { BalanceService } from './balance.service';
import { TerritorialSource } from './entities/territorial-source.entity';
import { SourceMaterial } from './entities/source-material.entity';
import { SourceVerification } from './entities/source-verification.entity';
import { VerificationEvidence } from './entities/verification-evidence.entity';
import { MobilizationAssessment } from './entities/mobilization-assessment.entity';
import { BalancePlan } from './entities/balance-plan.entity';
import { BalanceLine } from './entities/balance-line.entity';
import { SourceReservation } from './entities/source-reservation.entity';
import { ExecutionRequest } from './entities/execution-request.entity';
import { ExecutionFeedback } from './entities/execution-feedback.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from './entities/balance-snapshot.entity';
import { VerificationStatus } from './dt09.enums';
import type { CalcService } from '../dt08-calculation/calc.service';
import type { DocumentsService } from '../dt05-documents/documents.service';

const user: AuthUser = { sub: null as unknown as string, username: 'it', roles: [], organizationId: null };
const MAT = randomUUID();
const ADMIN_UNIT = randomUUID();
const ORG = randomUUID();
const RUN_ID = randomUUID();

describe('DT-09 Balance/Source — integration (DB thật)', () => {
  let ds: DataSource;
  let sourceSvc: SourceService;
  let balanceSvc: BalanceService;

  let sourceId = '';
  let sourceMaterialId = '';
  let planId = '';
  let lineId = '';
  let snapshotId = '';

  // Giả lập DT-08: trả supply_required cố định cho MAT.
  const fakeCalc = {
    supplyRequired: async (_runId: string) => ({
      runId: RUN_ID,
      scenarioId: randomUUID(),
      outputHash: 'hash-dt08',
      engineVersion: 'dt08-need-v1',
      locked: true,
      pendingExceptions: 0,
      items: [{ materialCatalogId: MAT, supplyRequired: 100, nc: 100, unitId: null }],
    }),
  } as unknown as CalcService;

  // Giả lập DT-05: trả chứng từ giả.
  const fakeDocs = {
    createDocument: async () => ({ id: randomUUID() }),
  } as unknown as DocumentsService;

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();

    sourceSvc = new SourceService(
      ds.getRepository(TerritorialSource),
      ds.getRepository(SourceMaterial),
      ds.getRepository(SourceVerification),
      ds.getRepository(VerificationEvidence),
      ds.getRepository(MobilizationAssessment),
      ds.getRepository(BalanceLine),
      ds.getRepository(SourceReservation),
      ds,
    );
    balanceSvc = new BalanceService(
      ds.getRepository(BalancePlan),
      ds.getRepository(BalanceLine),
      ds.getRepository(SourceReservation),
      ds.getRepository(SourceMaterial),
      ds.getRepository(SourceVerification),
      ds.getRepository(MobilizationAssessment),
      ds.getRepository(ExecutionRequest),
      ds.getRepository(ExecutionFeedback),
      ds.getRepository(BalanceSnapshot),
      ds.getRepository(BalanceSnapshotLine),
      ds,
      fakeCalc,
      fakeDocs,
    );
  }, 30000);

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    if (snapshotId) await ds.query('DELETE FROM balance_snapshot WHERE id = $1', [snapshotId]);
    if (planId) await ds.query('DELETE FROM balance_plan WHERE id = $1', [planId]);
    if (sourceId) await ds.query('DELETE FROM territorial_source WHERE id = $1', [sourceId]);
    await ds.destroy();
  }, 30000);

  it('khai báo nguồn + vật chất theo xã/điểm', async () => {
    const src = await sourceSvc.createSource(
      { name: 'Nguồn IT', adminUnitId: ADMIN_UNIT, sourceType: 'SUPPLIER', lat: 21.0, lng: 105.8 },
      user,
    );
    sourceId = src.id;
    const mat = await sourceSvc.addMaterial(src.id, { materialCatalogId: MAT, declaredQty: 100 }, user);
    sourceMaterialId = mat.id;
    expect(sourceMaterialId).toBeTruthy();
  });

  it('TC-DT09-001: chưa xác minh thì KHÔNG được đánh giá huy động', async () => {
    await expect(
      sourceSvc.assessMobilization(sourceMaterialId, { mobilizableQty: 60, leadTimeDays: 3 }, user),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('xác minh VERIFIED (verified_qty=100) + minh chứng', async () => {
    const ver = await sourceSvc.verify(
      sourceMaterialId,
      { status: VerificationStatus.VERIFIED, verifiedQty: 100, expiresAt: '2027-12-31', evidence: [{ fileId: randomUUID(), note: 'BB' }] },
      user,
    );
    expect(ver.status).toBe(VerificationStatus.VERIFIED);
  });

  it('TC-DT09-003: đánh giá huy động vượt verified ⇒ từ chối; ≤ verified ⇒ OK', async () => {
    await expect(
      sourceSvc.assessMobilization(sourceMaterialId, { mobilizableQty: 200, leadTimeDays: 3 }, user),
    ).rejects.toBeInstanceOf(BusinessException);
    const mob = await sourceSvc.assessMobilization(sourceMaterialId, { mobilizableQty: 60, leadTimeDays: 3 }, user);
    expect(Number(mob.mobilizableQty)).toBe(60);
  });

  it('TC-DT09-009: lập kế hoạch nhận supply_required từ DT-08 (copy, không tính lại NC)', async () => {
    const plan = await balanceSvc.createPlan({ name: 'KH IT', scenarioRunId: RUN_ID, deadlineDays: 30 }, user);
    planId = plan.id;
    expect(plan.lines).toHaveLength(1);
    lineId = plan.lines[0].id;
    expect(plan.lines[0].supplyRequired).toBe(100);
    expect(plan.sourceOutputHash).toBe('hash-dt08');
  });

  it('candidate 8 bước: nguồn đã verified + mobilizable vào danh sách xếp hạng', async () => {
    const res = await sourceSvc.candidates(lineId, { deadlineDays: 30, radiusKm: null });
    expect(res.ranked.length).toBeGreaterThanOrEqual(1);
    expect(res.ranked[0].sourceMaterialId).toBe(sourceMaterialId);
    expect(res.ranked[0].availableQty).toBe(60);
  });

  it('TC-DT09-008: hai giữ chỗ song song vượt available (60) ⇒ đúng một cái bị chặn', async () => {
    const results = await Promise.allSettled([
      balanceSvc.reserve(lineId, { sourceMaterialId, reservedQty: 40 }, user),
      balanceSvc.reserve(lineId, { sourceMaterialId, reservedQty: 40 }, user),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0].reason as BusinessException).getCode()).toBe(BusinessError.INSUFFICIENT_FREE_SOURCE);
  });

  it('cân đối: planned = 40, gap = 60 (PARTIAL)', async () => {
    const plan = await balanceSvc.balance(planId, user);
    const line = plan.lines[0];
    expect(line.plannedSourceQty).toBe(40);
    expect(line.gapQty).toBe(60);
    expect(line.status).toBe('PARTIAL');
  });

  it('TC-DT09-028: execution_request sinh chứng từ DT-05 + feedback cập nhật delivered', async () => {
    const req = await balanceSvc.createExecutionRequest(
      lineId,
      { requestedQty: 40, spawnDocument: true, organizationId: ORG, effectiveDate: '2026-09-08' },
      user,
    );
    expect(req.dt05DocumentId).toBeTruthy();
    expect(req.status).toBe('SENT');
    await balanceSvc.feedback(req.id, { deliveredQty: 25 }, user);
    const summary = await balanceSvc.gapSummary(planId);
    expect(summary.totals.deliveredQty).toBe(25);
  });

  it('TC-DT09-020: approve + lock ⇒ snapshot bất biến + fingerprint; sửa kế hoạch đã khóa bị chặn', async () => {
    await balanceSvc.approve(planId, user);
    const snap = await balanceSvc.lock(planId, user);
    snapshotId = snap.id;
    expect(snap.checksum).toBeTruthy();
    expect(snap.sourceFingerprint).toBeTruthy();
    expect(snap.locked).toBe(true);

    // Kế hoạch đã LOCKED — không cho giữ chỗ thêm.
    await expect(
      balanceSvc.reserve(lineId, { sourceMaterialId, reservedQty: 5 }, user),
    ).rejects.toBeInstanceOf(BusinessException);

    // Snapshot vẫn còn nguyên (bất biến) dù nguồn có thể đổi sau đó.
    const rows = await ds.query('SELECT checksum FROM balance_snapshot WHERE id = $1', [snapshotId]);
    expect(rows[0].checksum).toBe(snap.checksum);
  });
});
