// Integration test DT-07 — chạy trên DB THẬT (transaction/query/constraint), KHÔNG lọt vào
// `npm test` (tên *.int-spec.ts). Chạy: `npm run test:int` (cần DB dev — .env, mặc định 5435).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { OutboxService } from '../../common/outbox/outbox.service';
import { NormsService } from './norms.service';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from './entities/normative-document.entity';
import { NormSet, NormSetVersion } from './entities/norm-set.entity';
import { MaterialNorm, NormDimension } from './entities/material-norm.entity';
import { AuthorityRankVersion, CalculationParameter, NormConflictCase, NormSelectorConfig } from './entities/norm-selector.entity';
import { NormImportBatch } from './entities/norm-import.entity';
import { Command, CommandAssignment, CommandProgress, CommandRequirement, CommandVersion } from './entities/command.entity';
import { CatalogVersionStatus } from '../../common/enums';
import { CommandStatus, DimensionType, NormConflictStatus, NormValueType } from './norms-rules';
import { BusinessException } from '../../common/errors/business-error';
import { parseNormsWorkbook } from './norms-import';
import * as ExcelJS from 'exceljs';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const RUN = Date.now();
const MATERIAL = '00000000-0000-0000-0000-0000000d7abc';
const user: AuthUser = { sub: null as unknown as string, username: 'it', roles: [], organizationId: null };

describe('DT-07 NormsService — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: NormsService;
  const setIds: string[] = [];
  const versionIds: string[] = [];
  const commandIds: string[] = [];
  let docId = '';
  let docVersionId = '';
  let refId = '';

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    const outbox = new OutboxService(ds.getRepository(OutboxEvent));
    svc = new NormsService(
      ds.getRepository(NormativeDocument),
      ds.getRepository(NormativeDocumentVersion),
      ds.getRepository(NormSourceReference),
      ds.getRepository(NormSet),
      ds.getRepository(NormSetVersion),
      ds.getRepository(MaterialNorm),
      ds.getRepository(NormDimension),
      ds.getRepository(CalculationParameter),
      ds.getRepository(NormSelectorConfig),
      ds.getRepository(AuthorityRankVersion),
      ds.getRepository(NormConflictCase),
      ds.getRepository(NormImportBatch),
      ds.getRepository(Command),
      ds.getRepository(CommandVersion),
      ds.getRepository(CommandRequirement),
      ds.getRepository(CommandAssignment),
      ds.getRepository(CommandProgress),
      ds,
      outbox,
    );

    // Văn bản căn cứ dùng chung cho các định mức VERIFIED.
    const doc = await svc.createDocument({ docNo: `IT-DOC-${RUN}`, title: 'IT doc', issuingAuthority: 'BQP' }, user);
    docId = doc.id;
    const dv = await svc.createDocumentVersion(docId, { versionLabel: 'v1', fileHash: `IT-HASH-${RUN}` }, user);
    docVersionId = dv.id;
    const ref = await svc.addReference(docVersionId, { pageNo: 1, lineRef: '§1', quoteText: 'IT' }, user);
    refId = ref.id;
  }, 30000);

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    if (versionIds.length) {
      await ds.query('DELETE FROM norm_dimension WHERE material_norm_id IN (SELECT id FROM material_norm WHERE norm_set_version_id = ANY($1))', [versionIds]);
      await ds.query('DELETE FROM material_norm WHERE norm_set_version_id = ANY($1)', [versionIds]);
      await ds.query('DELETE FROM outbox_event WHERE aggregate_id = ANY($1)', [versionIds]);
      await ds.query('DELETE FROM norm_set_version WHERE id = ANY($1)', [versionIds]);
    }
    if (setIds.length) await ds.query('DELETE FROM norm_set WHERE id = ANY($1)', [setIds]);
    if (commandIds.length) {
      await ds.query('DELETE FROM command_progress WHERE assignment_id IN (SELECT a.id FROM command_assignment a JOIN command_requirement r ON r.id = a.requirement_id WHERE r.command_id = ANY($1))', [commandIds]);
      await ds.query('DELETE FROM command_assignment WHERE requirement_id IN (SELECT id FROM command_requirement WHERE command_id = ANY($1))', [commandIds]);
      await ds.query('DELETE FROM command_requirement WHERE command_id = ANY($1)', [commandIds]);
      await ds.query('DELETE FROM command WHERE id = ANY($1)', [commandIds]);
    }
    await ds.query('DELETE FROM norm_conflict_case WHERE material_catalog_id = $1', [MATERIAL]);
    await ds.query('DELETE FROM norm_import_batch WHERE file_hash LIKE $1', [`ITIMP-${RUN}%`]);
    if (refId) await ds.query('DELETE FROM norm_source_reference WHERE id = $1', [refId]);
    if (docVersionId) await ds.query('DELETE FROM normative_document_version WHERE id = $1', [docVersionId]);
    if (docId) await ds.query('DELETE FROM normative_document WHERE id = $1', [docId]);
    await ds.destroy();
  }, 30000);

  // Tạo bộ + phiên bản; trả version. `withDoc` để gắn/không gắn văn bản (ảnh hưởng issuing_authority).
  async function makeVersion(suffix: string, withDoc = true): Promise<NormSetVersion> {
    const set = await svc.createSet({ setCode: `IT-SET-${RUN}-${suffix}`, name: `IT ${suffix}` }, user);
    setIds.push(set.id);
    const v = await svc.createSetVersion(
      set.id,
      { versionLabel: 'v1', documentVersionId: withDoc ? docVersionId : undefined, effectiveFrom: '2026-01-01' },
      user,
    );
    versionIds.push(v.id);
    return v;
  }

  it('publish supersede + ghi outbox trong transaction', async () => {
    const set = await svc.createSet({ setCode: `IT-SET-${RUN}-pub`, name: 'IT pub' }, user);
    setIds.push(set.id);
    const v1 = await svc.createSetVersion(set.id, { versionLabel: 'v1', effectiveFrom: '2026-01-01' }, user);
    const v2 = await svc.createSetVersion(set.id, { versionLabel: 'v2', effectiveFrom: '2026-06-01' }, user);
    versionIds.push(v1.id, v2.id);

    await svc.publishSetVersion(v1.id, user);
    await svc.publishSetVersion(v2.id, user);

    const rv1 = await ds.getRepository(NormSetVersion).findOneByOrFail({ id: v1.id });
    const rv2 = await ds.getRepository(NormSetVersion).findOneByOrFail({ id: v2.id });
    expect(rv1.status).toBe(CatalogVersionStatus.SUPERSEDED);
    expect(rv2.status).toBe(CatalogVersionStatus.PUBLISHED);

    const events = await ds.getRepository(OutboxEvent).find({ where: { aggregateId: v2.id } });
    expect(events.some((e) => e.eventType === 'norm.set.published')).toBe(true);
  });

  it('addNorm vào bộ PUBLISHED → LOCKED_IMMUTABLE (BR-DT07-002)', async () => {
    const v = await makeVersion('immutable');
    await svc.publishSetVersion(v.id, user);
    await expect(
      svc.addNorm(v.id, { materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', sourceReferenceId: refId }, user),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('resolve E2E từ DB: SELECTED đặc thù/tổng quát + NO_RULE khi hết hiệu lực', async () => {
    const v = await makeVersion('resolve');
    const specific = await svc.addNorm(
      v.id,
      { materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 15, rawValue: '15 l', sourceReferenceId: refId, effectiveFrom: '2026-01-01' },
      user,
    );
    await svc.addScopes(specific.id, { dimensions: [{ dimensionType: DimensionType.MISSION, dimensionValue: 'ATTACK' }] }, user);
    await svc.addNorm(
      v.id,
      { materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 10, rawValue: '10 l', sourceReferenceId: refId, effectiveFrom: '2026-01-01' },
      user,
    );
    await svc.publishSetVersion(v.id, user);

    const attack = await svc.resolve({ materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', scope: { mission: 'ATTACK' }, asOfTime: '2026-06-01T00:00:00+07:00' }, user);
    expect(attack.status).toBe('SELECTED');
    expect(attack.selected?.valueNumeric).toBe(15);
    expect(attack.sourceReference?.id).toBe(refId); // BR-DT07-007: kèm căn cứ

    const general = await svc.resolve({ materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', scope: {}, asOfTime: '2026-06-01T00:00:00+07:00' }, user);
    expect(general.status).toBe('SELECTED');
    expect(general.selected?.valueNumeric).toBe(10);

    const past = await svc.resolve({ materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', scope: { mission: 'ATTACK' }, asOfTime: '2020-01-01T00:00:00+07:00' }, user);
    expect(past.status).toBe('NO_RULE');
  });

  it('CONFLICT ghi norm_conflict_case (không tự chọn — BR-DT07-008)', async () => {
    // Bộ KHÔNG gắn văn bản → issuing_authority null → không tách được bằng authority_rank.
    const v = await makeVersion('conflict', false);
    for (const val of [11, 12]) {
      const n = await svc.addNorm(
        v.id,
        { materialCatalogId: MATERIAL, semanticParam: 'RESERVE_SSCD', valueNumeric: val, sourceReferenceId: refId, effectiveFrom: '2026-01-01' },
        user,
      );
      await svc.addScopes(n.id, { dimensions: [{ dimensionType: DimensionType.MISSION, dimensionValue: 'ATTACK' }] }, user);
    }
    await svc.publishSetVersion(v.id, user);

    const res = await svc.resolve({ materialCatalogId: MATERIAL, semanticParam: 'RESERVE_SSCD', scope: { mission: 'ATTACK' }, asOfTime: '2026-06-01T00:00:00+07:00' }, user);
    expect(res.status).toBe('CONFLICT');
    expect(res.selected).toBeUndefined();
    expect(res.candidateNormIds?.length).toBe(2);

    const cases = await ds.getRepository(NormConflictCase).find({ where: { materialCatalogId: MATERIAL, semanticParam: 'RESERVE_SSCD', status: NormConflictStatus.OPEN } });
    expect(cases.length).toBeGreaterThanOrEqual(1);
  });

  it('import trùng file_hash → ConflictException (chống nhập trùng file)', async () => {
    const hash = `ITIMP-${RUN}`;
    await svc.importNorms({ fileName: 'a.xlsx', fileHash: hash, rows: [] }, user);
    await expect(svc.importNorms({ fileName: 'a.xlsx', fileHash: hash, rows: [] }, user)).rejects.toBeTruthy();
  });

  it('chuỗi chỉ lệnh: requirement gắn định mức PUBLISHED (BR-DT07-031) + assignment + progress + transition', async () => {
    // Bộ định mức PUBLISHED có VERIFIED norm cho MATERIAL, hiệu lực 2026-01-01.
    const v = await makeVersion('cmd');
    await svc.addNorm(v.id, { materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 20, sourceReferenceId: refId, effectiveFrom: '2026-01-01' }, user);
    await svc.publishSetVersion(v.id, user);

    const cmd = await svc.createCommand({ title: 'IT command', issuingAuthority: 'BTL', effectiveDate: '2026-06-01' }, user);
    commandIds.push(cmd.id);

    const req = await svc.addRequirement(cmd.id, { materialCatalogId: MATERIAL, requiredQty: 100 }, user);
    expect(req.normSetVersionId).toBe(v.id); // BR-DT07-031: gắn đúng bộ PUBLISHED tại effective_date
    expect(req.materialNormId).toBeTruthy();

    const assign = await svc.addAssignment(req.id, { organizationId: '00000000-0000-0000-0000-0000000d7011', allocatedQty: 60 }, user);
    const prog = await svc.addProgress(assign.id, { reportedQty: 30 }, user);
    expect(Number(prog.reportedQty)).toBe(30);

    await svc.transitionCommand(cmd.id, CommandStatus.ISSUED, user);
    await svc.transitionCommand(cmd.id, CommandStatus.IN_PROGRESS, user);
    const done = await svc.transitionCommand(cmd.id, CommandStatus.COMPLETED, user);
    expect(done.status).toBe(CommandStatus.COMPLETED);

    expect((await svc.listAssignments(req.id)).length).toBe(1);
    expect((await svc.listProgress(assign.id)).length).toBe(1);
  });

  it('parser đọc .xlsx (exceljs) + .csv (có/không header)', async () => {
    // .xlsx có header
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('norms');
    ws.addRow(['materialCatalogId', 'semanticParam', 'valueNumeric', 'rawValue']);
    ws.addRow([MATERIAL, 'CONSUMPTION_COMBAT', 12, '12 lít/xe/ngày']);
    ws.addRow([MATERIAL, 'RESERVE_SSCD', 5, '5 cơ số']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const xlsxRows = await parseNormsWorkbook(buf, 'x.xlsx');
    expect(xlsxRows).toHaveLength(2);
    expect(xlsxRows[0]).toMatchObject({ materialCatalogId: MATERIAL, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 12 });

    // .csv không header (theo vị trí)
    const csvRows = await parseNormsWorkbook(Buffer.from(`${MATERIAL},CONSUMPTION_COMBAT,9,9 l`, 'utf8'), 'x.csv');
    expect(csvRows).toHaveLength(1);
    expect(csvRows[0].valueNumeric).toBe(9);
  });
});
