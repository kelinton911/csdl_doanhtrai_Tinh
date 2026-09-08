// Integration test DT-10 — chạy trên DB THẬT (transaction/query/constraint). Chuỗi kiểm kê 3 lớp:
// cutoff + book_snapshot bất biến → phiếu blind → chất lượng C1–5 → recount vòng mới → variance →
// chốt official + khóa → revise sau mở khóa → điều chỉnh → DT-05 POST → dataset gắn snapshot_version.
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/errors/business-error';
import { MovementStatus, MovementType } from '../dt04-materiel/materiel-rules';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { InventoryDocument } from '../dt05-documents/entities/inventory-document.entity';
import { InventoryDocumentLine } from '../dt05-documents/entities/inventory-document-line.entity';
import { PostingBatch } from '../dt05-documents/entities/posting-batch.entity';
import { TransferOrder } from '../dt05-documents/entities/transfer-order.entity';
import { StockPeriod } from '../dt05-documents/entities/stock-period.entity';
import { DocumentsService } from '../dt05-documents/documents.service';
import { CountService } from './count.service';
import { InventoryCountCampaign } from './entities/inventory-count-campaign.entity';
import { BookSnapshot, BookSnapshotLine } from './entities/book-snapshot.entity';
import { CountSheet, CountLine } from './entities/count-sheet.entity';
import { RecountRound } from './entities/recount-round.entity';
import { CountVariance } from './entities/count-variance.entity';
import { CountQualityGrade } from './entities/count-quality-grade.entity';
import { OfficialSnapshot, OfficialSnapshotLine, OfficialLock } from './entities/official-snapshot.entity';
import { CountAdjustmentRequest } from './entities/count-adjustment-request.entity';
import { ReportDataset } from './entities/report-dataset.entity';
import { StockQualityDetail } from '../inventory/entities/stock-quality-detail.entity';
import { CampaignStatus, CountAdjustmentStatus, VarianceType } from './dt10.enums';

const user: AuthUser = { sub: null as unknown as string, username: 'it-dt10', roles: [], organizationId: null };

describe('DT-10 CountService — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: CountService;

  const ORG = randomUUID();
  const MATERIAL = randomUUID(); // có sổ
  const MATERIAL2 = randomUUID(); // không sổ (UNBOOKED)
  const cutoff = new Date();
  let campaignId: string;
  let sheetId: string;

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    const outbox = new OutboxService(ds.getRepository(OutboxEvent));
    const documents = new DocumentsService(
      ds.getRepository(InventoryDocument),
      ds.getRepository(InventoryDocumentLine),
      ds.getRepository(PostingBatch),
      ds.getRepository(TransferOrder),
      ds.getRepository(StockPeriod),
      ds.getRepository(MaterielMovement),
      ds,
      outbox,
    );
    svc = new CountService(
      ds.getRepository(InventoryCountCampaign),
      ds.getRepository(BookSnapshot),
      ds.getRepository(BookSnapshotLine),
      ds.getRepository(CountSheet),
      ds.getRepository(CountLine),
      ds.getRepository(RecountRound),
      ds.getRepository(CountVariance),
      ds.getRepository(CountQualityGrade),
      ds.getRepository(OfficialSnapshot),
      ds.getRepository(OfficialSnapshotLine),
      ds.getRepository(OfficialLock),
      ds.getRepository(CountAdjustmentRequest),
      ds.getRepository(ReportDataset),
      ds.getRepository(MaterielMovement),
      ds.getRepository(StockQualityDetail),
      documents,
      ds,
    );

    // Sổ cái DT-04: RECEIPT +100 cho MATERIAL/ORG, effective_time TRƯỚC cutoff.
    await ds.getRepository(MaterielMovement).save(
      ds.getRepository(MaterielMovement).create({
        transactionNo: `IT10-${Date.now()}-A`,
        transactionType: MovementType.RECEIPT,
        materialCatalogId: MATERIAL,
        organizationId: ORG,
        quantity: '100',
        quantitySigned: '100',
        effectiveTime: new Date(cutoff.getTime() - 86_400_000),
        postedAt: new Date(cutoff.getTime() - 86_400_000),
        status: MovementStatus.POSTED,
      }),
    );
  }, 30000);

  afterAll(async () => {
    if (campaignId) {
      const snaps = await ds.getRepository(BookSnapshot).find({ where: { campaignId } });
      for (const s of snaps) await ds.query('DELETE FROM book_snapshot_line WHERE snapshot_id = $1', [s.id]);
      const osnaps = await ds.getRepository(OfficialSnapshot).find({ where: { campaignId } });
      for (const s of osnaps) await ds.query('DELETE FROM official_snapshot_line WHERE snapshot_id = $1', [s.id]);
      const sheets = await ds.getRepository(CountSheet).find({ where: { campaignId } });
      for (const s of sheets) {
        await ds.query('DELETE FROM count_line WHERE sheet_id = $1', [s.id]);
        await ds.query('DELETE FROM recount_round WHERE count_sheet_id = $1', [s.id]);
      }
      await ds.query('DELETE FROM report_dataset WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM count_adjustment_request WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM official_lock WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM official_snapshot WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM count_variance WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM count_sheet WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM book_snapshot WHERE campaign_id = $1', [campaignId]);
      await ds.query('DELETE FROM inventory_count_campaign WHERE id = $1', [campaignId]);
    }
    // Dọn chứng từ + movement + count-line quality theo ORG/material.
    const docs = await ds.getRepository(InventoryDocument).find({ where: { organizationId: ORG } });
    for (const d of docs) {
      await ds.query('DELETE FROM inventory_document_line WHERE document_id = $1', [d.id]);
      await ds.query('DELETE FROM posting_batch WHERE document_id = $1', [d.id]);
    }
    await ds.query('DELETE FROM inventory_document WHERE organization_id = $1', [ORG]);
    await ds.query('DELETE FROM materiel_movement WHERE organization_id = $1', [ORG]);
    await ds.destroy();
  }, 30000);

  it('tạo đợt + cutoff + dựng book_snapshot bất biến (checksum) — BR-DT10-002/003', async () => {
    const c = await svc.createCampaign(
      { campaignCode: `KK-IT-${Date.now()}`, name: 'Đợt IT DT-10', scopeJson: { organizationId: ORG } },
      user,
    );
    campaignId = c.id;
    await svc.cutoff(c.id, { cutoffTime: cutoff.toISOString() }, user);
    const built = await svc.buildBookSnapshot(c.id, user);
    expect(built.snapshot.locked).toBe(true);
    expect(built.snapshot.checksum).toHaveLength(64);
    const book = await svc.getBookSnapshot(c.id);
    const line = book.lines.find((l) => l.materialCatalogId === MATERIAL);
    expect(Number(line?.bookQty)).toBe(100);
    const fresh = await svc.getCampaign(c.id);
    expect(fresh.status).toBe(CampaignStatus.COUNTING);
  });

  it('TC-DT10-002: giao dịch mới sau cutoff KHÔNG đổi book_snapshot; rebuild → LOCKED_IMMUTABLE', async () => {
    // Phát sinh +50 SAU cutoff.
    await ds.getRepository(MaterielMovement).save(
      ds.getRepository(MaterielMovement).create({
        transactionNo: `IT10-${Date.now()}-B`,
        transactionType: MovementType.RECEIPT,
        materialCatalogId: MATERIAL,
        organizationId: ORG,
        quantity: '50',
        quantitySigned: '50',
        effectiveTime: new Date(cutoff.getTime() + 3_600_000),
        postedAt: new Date(),
        status: MovementStatus.POSTED,
      }),
    );
    const book = await svc.getBookSnapshot(campaignId);
    const line = book.lines.find((l) => l.materialCatalogId === MATERIAL);
    expect(Number(line?.bookQty)).toBe(100); // vẫn tại cutoff, bất biến.
    await expect(svc.buildBookSnapshot(campaignId, user)).rejects.toBeInstanceOf(BusinessException);
  });

  it('TC-DT10-005: phiếu kiểm đếm là blind (dòng không có book_qty)', async () => {
    const sheet = await svc.createSheet(campaignId, { organizationId: ORG }, user);
    sheetId = sheet.id;
    await svc.updateSheetLines(
      sheetId,
      {
        lines: [
          { materialCatalogId: MATERIAL, physicalQty: 90 },
          { materialCatalogId: MATERIAL2, physicalQty: 5 },
        ],
      },
      user,
    );
    const detail = await svc.getSheetDetail(sheetId);
    expect(detail.lines.length).toBe(2);
    for (const l of detail.lines) {
      expect('physicalQty' in l).toBe(true);
      expect('bookQty' in l).toBe(false); // blind: không lộ số sổ.
    }
    await svc.submitSheet(sheetId, user);
  });

  it('TC-DT10-009: Σ chất lượng ≠ physical → QUALITY_TOTAL_MISMATCH; đúng → lưu', async () => {
    const detail = await svc.getSheetDetail(sheetId);
    const matLine = detail.lines.find((l) => l.materialCatalogId === MATERIAL && l.roundNo === 1)!;
    await expect(
      svc.saveQualityGrades(matLine.id, { grade1: 50, grade2: 0, grade3: 0, grade4: 0, grade5: 0 }, user),
    ).rejects.toBeInstanceOf(BusinessException);
    const ok = await svc.saveQualityGrades(matLine.id, { grade1: 90, grade2: 0, grade3: 0, grade4: 0, grade5: 0 }, user);
    expect(Number(ok.grade1)).toBe(90);
  });

  it('TC-DT10-008: recount tạo vòng MỚI, giữ nguyên vòng trước', async () => {
    const { sheet, round } = await svc.recount(sheetId, { reason: 'Đếm lại kho A' }, user);
    expect(round.roundNo).toBe(2);
    expect(sheet.currentRound).toBe(2);
    // Nhập vòng 2 (MATERIAL 95, MATERIAL2 5) rồi gửi.
    await svc.updateSheetLines(
      sheetId,
      { lines: [{ materialCatalogId: MATERIAL, physicalQty: 95 }, { materialCatalogId: MATERIAL2, physicalQty: 5 }] },
      user,
    );
    await svc.submitSheet(sheetId, user);
    const detail = await svc.getSheetDetail(sheetId);
    // Dòng vòng 1 vẫn còn (không ghi đè).
    expect(detail.lines.some((l) => l.roundNo === 1)).toBe(true);
    expect(detail.lines.some((l) => l.roundNo === 2)).toBe(true);
  });

  it('TC-DT10-013: đối chiếu → variance đủ loại (SHORTAGE + UNBOOKED)', async () => {
    const variances = await svc.computeVariances(campaignId, user);
    const mat = variances.find((v) => v.materialCatalogId === MATERIAL)!;
    const mat2 = variances.find((v) => v.materialCatalogId === MATERIAL2)!;
    expect(mat.varianceType).toBe(VarianceType.SHORTAGE); // book 100 vs physical 95
    expect(Number(mat.varianceQty)).toBe(-5);
    expect(mat2.varianceType).toBe(VarianceType.UNBOOKED); // có thực, không sổ
    const c = await svc.getCampaign(campaignId);
    expect(c.status).toBe(CampaignStatus.RECONCILING);
  });

  it('TC-DT10-019: official khóa bất biến; revise khi khóa → LOCKED_IMMUTABLE; mở khóa (lý do) → version mới', async () => {
    await svc.createOfficialSnapshot(campaignId, user);
    await svc.lockOfficial(campaignId, user);
    const locked = await svc.getCampaign(campaignId);
    expect(locked.status).toBe(CampaignStatus.OFFICIAL_LOCKED);
    // Sửa (revise) khi đang khóa → LOCKED_IMMUTABLE.
    await expect(svc.reviseOfficial(campaignId, { reason: 'x' }, user)).rejects.toBeInstanceOf(BusinessException);
    // Mở khóa có lý do → revise tạo version 2.
    await svc.unlockOfficial(campaignId, { reason: 'Điều chỉnh sau hậu kiểm' }, user);
    const revised = await svc.reviseOfficial(campaignId, { reason: 'Cập nhật số chính thức' }, user);
    expect(revised.snapshot.version).toBe(2);
  });

  it('TC-DT10-022: điều chỉnh → DT-05 (CONVERSION POSTED), KHÔNG sửa số dư trực tiếp', async () => {
    const variances = await svc.listVariances(campaignId);
    const shortage = variances.find((v) => v.materialCatalogId === MATERIAL)!;
    const req = await svc.createAdjustmentRequest(campaignId, { varianceId: shortage.id }, user);
    expect(req.status).toBe(CountAdjustmentStatus.DRAFT);
    const posted = await svc.approveAdjustment(req.id, user);
    expect(posted.status).toBe(CountAdjustmentStatus.POSTED);
    expect(posted.dt05DocumentId).toBeTruthy();
    // Chứng từ DT-05 tồn tại & POSTED; movement ADJUSTMENT gắn document (đi qua DT-05, không sửa trực tiếp).
    const doc = await ds.getRepository(InventoryDocument).findOne({ where: { id: posted.dt05DocumentId! } });
    expect(doc?.status).toBe('POSTED');
    const adjMove = await ds.getRepository(MaterielMovement).findOne({ where: { documentId: posted.dt05DocumentId! } });
    expect(adjMove?.transactionType).toBe(MovementType.ADJUSTMENT);
    expect(Number(adjMove?.quantitySigned)).toBe(-5);
  });

  it('TC-DT10-025: dataset gắn đúng official snapshot_version', async () => {
    const dataset = await svc.buildDataset(campaignId, { formCode: '03/KK' }, user);
    expect(dataset.snapshotVersion).toBe(2); // version sau revision
    expect(dataset.datasetHash).toHaveLength(64);
    const recon = await svc.reconciliation(campaignId);
    expect(recon.snapshotVersion).toBe(2);
    expect(Array.isArray(recon.rows)).toBe(true);
  });
});
