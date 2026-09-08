// Integration test DT-11 — chạy trên DB THẬT (query/constraint/workflow). Chuỗi Report Engine:
// dựng official_snapshot (DT-10) → dataset_definition + field → sinh dataset (hash+fingerprint) →
// validate → lập report → validate → duyệt → phát hành (checksum) → lineage drill-down → phát hành lại (version).
// StorageService được thay bằng bản giả (sha256 thật) để không phụ thuộc MinIO.
import 'reflect-metadata';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { BusinessException } from '../../common/errors/business-error';
import { StorageService } from '../storage/storage.service';
import { ReportService } from './report.service';
import { ReportDefinition, ReportTemplateVersion } from './entities/report-definition.entity';
import { DatasetDefinition, DatasetField, DatasetFilter, DatasetFormula } from './entities/dataset-definition.entity';
import { DatasetInstance, DatasetValidation } from './entities/dataset-instance.entity';
import { ReportInstance } from './entities/report-instance.entity';
import { ReportRollup } from './entities/report-rollup.entity';
import { ReportLineage } from './entities/report-lineage.entity';
import { OfficialSnapshot, OfficialSnapshotLine } from '../dt10-inventory-count/entities/official-snapshot.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../dt09-balance/entities/balance-snapshot.entity';
import { CalculationRun } from '../dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../dt08-calculation/entities/material-calculation.entity';
import { DatasetInstanceStatus, ReportInstanceStatus, SubmissionStatus, TemplateVersionStatus } from './dt11.enums';
import type { DatasetPayload } from './report-rules';

const user: AuthUser = { sub: null as unknown as string, username: 'it-dt11', roles: [], organizationId: null };

// StorageService giả: sha256 thật của buffer, không gọi MinIO.
const fakeStorage = {
  putObject: async (buffer: Buffer, contentType: string) => ({
    objectKey: `reports-dt11/${randomUUID()}`,
    checksum: createHash('sha256').update(buffer).digest('hex'),
    size: buffer.length,
    contentType,
  }),
  presignedGetUrl: async (key: string) => `http://minio.local/${key}`,
} as unknown as StorageService;

describe('DT-11 ReportService — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: ReportService;

  const CAMPAIGN = randomUUID();
  const MAT1 = randomUUID();
  const MAT2 = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const FORM = `IT-${suffix}/KK`;
  const DS_CODE = `it-ds-${suffix}`;

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    svc = new ReportService(
      ds.getRepository(ReportDefinition),
      ds.getRepository(ReportTemplateVersion),
      ds.getRepository(DatasetDefinition),
      ds.getRepository(DatasetField),
      ds.getRepository(DatasetFilter),
      ds.getRepository(DatasetFormula),
      ds.getRepository(DatasetInstance),
      ds.getRepository(DatasetValidation),
      ds.getRepository(ReportInstance),
      ds.getRepository(ReportRollup),
      ds.getRepository(ReportLineage),
      ds.getRepository(OfficialSnapshot),
      ds.getRepository(OfficialSnapshotLine),
      ds.getRepository(MaterielSnapshot),
      ds.getRepository(MaterielSnapshotLine),
      ds.getRepository(BalanceSnapshot),
      ds.getRepository(BalanceSnapshotLine),
      ds.getRepository(CalculationRun),
      ds.getRepository(MaterialCalculation),
      fakeStorage,
      ds,
    );

    // Dựng official_snapshot (DT-10) làm nguồn chuẩn: 2 dòng, tổng 30.
    const snap = await ds.getRepository(OfficialSnapshot).save(
      ds.getRepository(OfficialSnapshot).create({ campaignId: CAMPAIGN, version: 1, checksum: 'chk-official-1', approvedAt: new Date() }),
    );
    const lineRepo = ds.getRepository(OfficialSnapshotLine);
    await lineRepo.save(lineRepo.create({ snapshotId: snap.id, materialCatalogId: MAT1, officialQty: '10', grade1: '4', grade2: '3', grade3: '2', grade4: '1', grade5: '0', value: '1000' }));
    await lineRepo.save(lineRepo.create({ snapshotId: snap.id, materialCatalogId: MAT2, officialQty: '20', grade1: '20', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '2000' }));
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  let datasetInstanceId: string;
  let reportId: string;
  let issuedChecksum: string | null;

  it('cấu hình biểu + dataset + sinh dataset (dataset_hash trùng khi cùng nguồn — TC-DT11-006)', async () => {
    const def = await svc.createDefinition({ formCode: FORM, title: 'Biểu IT DT-11' }, user);
    await svc.createTemplateVersion(
      def.id,
      { layoutSchemaJson: { columns: [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }] }, publish: true },
      user,
    );
    const dsDef = await svc.createDatasetDefinition({ code: DS_CODE, title: 'DS IT', sourceType: 'DT10_OFFICIAL_SNAPSHOT' }, user);
    await svc.addField(dsDef.id, { fieldKey: 'materialCatalogId', sourcePath: 'materialCatalogId', dataType: 'string' }, user);
    await svc.addField(dsDef.id, { fieldKey: 'total', sourcePath: 'total', dataType: 'number' }, user);

    const inst1 = await svc.generateDataset({ datasetDefinitionCode: DS_CODE, sourceRef: { campaignId: CAMPAIGN } }, user);
    expect(inst1.datasetHash).toHaveLength(64);
    expect(inst1.rowCount).toBe(2);
    expect(inst1.sourceFingerprint).toHaveLength(64);

    const inst2 = await svc.generateDataset({ datasetDefinitionCode: DS_CODE, sourceRef: { campaignId: CAMPAIGN } }, user);
    expect(inst2.datasetHash).toBe(inst1.datasetHash); // cùng nguồn ⇒ trùng hash
    datasetInstanceId = inst1.id;
  });

  it('validate dataset (reconciliation PASS) → lập & phát hành báo cáo (checksum)', async () => {
    const { instance, validations } = await svc.validateDataset(datasetInstanceId, user);
    expect(instance.status).toBe(DatasetInstanceStatus.VALIDATED);
    const recon = validations.find((v) => v.checkType === 'RECONCILIATION');
    expect(recon?.status).toBe('PASS');

    const report = await svc.createReport({ formCode: FORM, datasetInstanceId }, user);
    reportId = report.id;
    await svc.validateReport(reportId, user);
    await svc.approveReport(reportId, user);
    const issued = await svc.issueReport(reportId, { format: 'excel' }, user);
    expect(issued.status).toBe(ReportInstanceStatus.ISSUED);
    expect(issued.checksum).toHaveLength(64);
    expect(issued.fileObjectKey).toBeTruthy();
    issuedChecksum = issued.checksum;

    const dl = await svc.downloadUrl(reportId);
    expect(dl.url).toContain('reports-dt11/');
  });

  it('TC-DT11-002 — drill-down 1 ô → dataset → snapshot', async () => {
    const all = await svc.getLineage(reportId);
    expect(all.length).toBeGreaterThan(0);
    const cellRef = `${MAT1}:total`;
    const one = await svc.getLineage(reportId, cellRef);
    expect(one.length).toBe(1);
    expect(one[0].snapshotRef).toMatchObject({ datasetInstanceId, campaignId: CAMPAIGN });
    expect(one[0].transactionRef).toMatchObject({ materialCatalogId: MAT1 });
  });

  it('TC-DT11-016 — phát hành lại: version mới, bản cũ SUPERSEDED giữ nguyên checksum', async () => {
    const next = await svc.reissueReport(reportId, { format: 'excel' }, user);
    expect(next.versionNo).toBe(2);
    expect(next.status).toBe(ReportInstanceStatus.ISSUED);
    const old = await svc.getReport(reportId);
    expect(old.status).toBe(ReportInstanceStatus.SUPERSEDED);
    expect(old.supersededById).toBe(next.id);
    expect(old.checksum).toBe(issuedChecksum); // file cũ bất biến
  });

  it('TC-DT11-009/021 — rollup: đơn vị chưa gửi ≠ 0 & chống aggregate trùng', async () => {
    const parent = await svc.createReport({ formCode: FORM, datasetInstanceId }, user);
    const childOrgA = randomUUID();
    const childOrgB = randomUUID();
    // A đã gửi (trỏ chính report con có dataset tổng 30), B chưa gửi
    const childReport = await svc.createReport({ formCode: FORM, datasetInstanceId }, user);
    await svc.rollup(parent.id, {
      children: [
        { childOrgId: childOrgA, childInstanceId: childReport.id, submissionStatus: SubmissionStatus.SUBMITTED },
        { childOrgId: childOrgB, submissionStatus: SubmissionStatus.MISSING },
      ],
    }, user);
    // rollup lần 2 cùng đơn vị A ⇒ không cộng đôi
    const status = await svc.rollup(parent.id, {
      children: [{ childOrgId: childOrgA, childInstanceId: childReport.id, submissionStatus: SubmissionStatus.SUBMITTED }],
    }, user);
    expect(status.submittedCount).toBe(1);
    expect(status.missingCount).toBe(1);
    expect(status.missingOrgIds).toContain(childOrgB);
    expect(status.aggregatedTotals.total).toBe(30); // chỉ A, không nhân đôi
  });

  it('TC-DT11-007 — dataset lệch reconciliation ⇒ chặn tiến trình duyệt', async () => {
    const inst = await svc.generateDataset({ datasetDefinitionCode: DS_CODE, sourceRef: { campaignId: CAMPAIGN } }, user);
    // Bóp méo tổng nguồn để reconciliation FAIL.
    const repo = ds.getRepository(DatasetInstance);
    const dbInst = await repo.findOneByOrFail({ id: inst.id });
    const payload = dbInst.payloadJson as unknown as DatasetPayload;
    payload.sourceTotals = { total: 999 };
    dbInst.payloadJson = payload as unknown as Record<string, unknown>;
    await repo.save(dbInst);
    const { instance } = await svc.validateDataset(inst.id, user);
    expect(instance.status).toBe(DatasetInstanceStatus.FAILED);

    const rep = await svc.createReport({ formCode: FORM, datasetInstanceId: inst.id }, user);
    await expect(svc.validateReport(rep.id, user)).rejects.toBeInstanceOf(BusinessException);
  });

  it('TC-DT11-019 — thêm biểu mới bằng cấu hình (không sửa code)', async () => {
    const extra = `IT-${suffix}-EXTRA/KK`;
    const def = await svc.createDefinition({ formCode: extra, title: 'Biểu thêm bằng cấu hình' }, user);
    await svc.createTemplateVersion(def.id, { layoutSchemaJson: { columns: [{ key: 'total', header: 'Số lượng' }] }, publish: true }, user);
    const all = await svc.listDefinitions();
    expect(all.some((d) => d.formCode === extra)).toBe(true);
    const tvs = await svc.listTemplateVersions(def.id);
    expect(tvs[0].status).toBe(TemplateVersionStatus.PUBLISHED);
  });
});
