import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { applyJsonOrgScope, assertReadScope } from '../../common/scope/scope-query';
import { StorageService } from '../storage/storage.service';
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
import {
  AddFieldDto,
  AddFilterDto,
  AddFormulaDto,
  CreateDatasetDefinitionDto,
  CreateReportDefinitionDto,
  CreateReportInstanceDto,
  CreateTemplateVersionDto,
  GenerateDatasetDto,
  IssueReportDto,
  RollupDto,
} from './dto/dt11.dto';
import {
  CellState,
  DatasetInstanceStatus,
  DatasetSourceType,
  REPORT_ENGINE_VERSION,
  REPORT_FILE_FORMATS,
  ReportDefinitionStatus,
  ReportFileFormat,
  ReportInstanceStatus,
  SubmissionStatus,
  TemplateVersionStatus,
  ValidationStatus,
} from './dt11.enums';
import {
  aggregateRollup,
  assertReportTransition,
  computeDatasetHash,
  computeSourceFingerprint,
  isBlockingValidation,
  toNum,
  validateCompleteness,
  validateQualityTotal,
  validateReconciliation,
  type DatasetPayload,
  type DatasetRow,
  type RollupChild,
} from './report-rules';
import { buildDatasetRows, fetchSource, type FieldDef, type FormulaDef, type SourceContext } from './report-sources';
import { renderExcel, renderPdf, type RenderColumn } from './report-render';

// DT-11 — Report Engine (Quyển XI). Biểu cấu hình → dataset từ snapshot chuẩn (hash+fingerprint) → validate →
// report (workflow ISSUED, file checksum bất biến) → rollup (chống trùng) → lineage (truy vết ô). SYS-BR-06.
@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportDefinition) private readonly defs: Repository<ReportDefinition>,
    @InjectRepository(ReportTemplateVersion) private readonly templates: Repository<ReportTemplateVersion>,
    @InjectRepository(DatasetDefinition) private readonly datasetDefs: Repository<DatasetDefinition>,
    @InjectRepository(DatasetField) private readonly fields: Repository<DatasetField>,
    @InjectRepository(DatasetFilter) private readonly filters: Repository<DatasetFilter>,
    @InjectRepository(DatasetFormula) private readonly formulas: Repository<DatasetFormula>,
    @InjectRepository(DatasetInstance) private readonly datasetInstances: Repository<DatasetInstance>,
    @InjectRepository(DatasetValidation) private readonly validations: Repository<DatasetValidation>,
    @InjectRepository(ReportInstance) private readonly reports: Repository<ReportInstance>,
    @InjectRepository(ReportRollup) private readonly rollups: Repository<ReportRollup>,
    @InjectRepository(ReportLineage) private readonly lineages: Repository<ReportLineage>,
    @InjectRepository(OfficialSnapshot) private readonly officialSnapshots: Repository<OfficialSnapshot>,
    @InjectRepository(OfficialSnapshotLine) private readonly officialLines: Repository<OfficialSnapshotLine>,
    @InjectRepository(MaterielSnapshot) private readonly materielSnapshots: Repository<MaterielSnapshot>,
    @InjectRepository(MaterielSnapshotLine) private readonly materielLines: Repository<MaterielSnapshotLine>,
    @InjectRepository(BalanceSnapshot) private readonly balanceSnapshots: Repository<BalanceSnapshot>,
    @InjectRepository(BalanceSnapshotLine) private readonly balanceLines: Repository<BalanceSnapshotLine>,
    @InjectRepository(CalculationRun) private readonly calcRuns: Repository<CalculationRun>,
    @InjectRepository(MaterialCalculation) private readonly materialCalcs: Repository<MaterialCalculation>,
    private readonly storage: StorageService,
    private readonly ds: DataSource,
  ) {}

  private uid(user: AuthUser): string | null {
    return user?.sub ?? null;
  }

  private sourceContext(): SourceContext {
    return {
      officialSnapshots: this.officialSnapshots,
      officialLines: this.officialLines,
      materielSnapshots: this.materielSnapshots,
      materielLines: this.materielLines,
      balanceSnapshots: this.balanceSnapshots,
      balanceLines: this.balanceLines,
      calcRuns: this.calcRuns,
      materialCalcs: this.materialCalcs,
      dataSource: this.ds,
    };
  }

  // ================= report_definition / template_version =================
  async createDefinition(dto: CreateReportDefinitionDto, user: AuthUser): Promise<ReportDefinition> {
    const dup = await this.defs.findOne({ where: { formCode: dto.formCode } });
    if (dup) throw new BusinessException(BusinessError.STALE_WRITE, `Biểu ${dto.formCode} đã tồn tại`);
    return this.defs.save(
      this.defs.create({
        formCode: dto.formCode,
        title: dto.title,
        category: dto.category ?? null,
        description: dto.description ?? null,
        status: ReportDefinitionStatus.ACTIVE,
        currentVersionNo: 0,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listDefinitions(): Promise<ReportDefinition[]> {
    return this.defs.find({ order: { formCode: 'ASC' } });
  }

  async getDefinition(id: string): Promise<ReportDefinition> {
    const d = await this.defs.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Không tìm thấy định nghĩa biểu');
    return d;
  }

  private async getDefinitionByFormCode(formCode: string): Promise<ReportDefinition> {
    const d = await this.defs.findOne({ where: { formCode } });
    if (!d) throw new NotFoundException(`Không tìm thấy biểu ${formCode}`);
    return d;
  }

  async createTemplateVersion(defId: string, dto: CreateTemplateVersionDto, user: AuthUser): Promise<ReportTemplateVersion> {
    const def = await this.getDefinition(defId);
    const last = await this.templates.find({ where: { reportDefinitionId: def.id }, order: { versionNo: 'DESC' }, take: 1 });
    const versionNo = (last[0]?.versionNo ?? 0) + 1;
    const publish = !!dto.publish;
    if (publish) {
      // supersede các bản PUBLISHED trước đó
      await this.templates.update(
        { reportDefinitionId: def.id, status: TemplateVersionStatus.PUBLISHED },
        { status: TemplateVersionStatus.SUPERSEDED },
      );
    }
    const tv = await this.templates.save(
      this.templates.create({
        reportDefinitionId: def.id,
        versionNo,
        layoutSchemaJson: dto.layoutSchemaJson,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        status: publish ? TemplateVersionStatus.PUBLISHED : TemplateVersionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (publish) {
      def.currentVersionNo = versionNo;
      def.updatedBy = this.uid(user);
      await this.defs.save(def);
    }
    return tv;
  }

  listTemplateVersions(defId: string): Promise<ReportTemplateVersion[]> {
    return this.templates.find({ where: { reportDefinitionId: defId }, order: { versionNo: 'DESC' } });
  }

  private async currentPublishedTemplate(defId: string): Promise<ReportTemplateVersion> {
    const tv = await this.templates.findOne({ where: { reportDefinitionId: defId, status: TemplateVersionStatus.PUBLISHED } });
    if (!tv) throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, 'Biểu chưa có template PUBLISHED');
    return tv;
  }

  // ================= dataset_definition + field/filter/formula =================
  async createDatasetDefinition(dto: CreateDatasetDefinitionDto, user: AuthUser): Promise<DatasetDefinition> {
    const dup = await this.datasetDefs.findOne({ where: { code: dto.code } });
    if (dup) throw new BusinessException(BusinessError.STALE_WRITE, `Dataset ${dto.code} đã tồn tại`);
    return this.datasetDefs.save(
      this.datasetDefs.create({
        code: dto.code,
        title: dto.title,
        sourceType: dto.sourceType as DatasetSourceType,
        unitId: dto.unitId ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listDatasetDefinitions(): Promise<DatasetDefinition[]> {
    return this.datasetDefs.find({ order: { code: 'ASC' } });
  }

  async getDatasetDefinition(id: string): Promise<DatasetDefinition> {
    const d = await this.datasetDefs.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Không tìm thấy dataset_definition');
    return d;
  }

  private async getDatasetDefinitionByCode(code: string): Promise<DatasetDefinition> {
    const d = await this.datasetDefs.findOne({ where: { code } });
    if (!d) throw new NotFoundException(`Không tìm thấy dataset ${code}`);
    return d;
  }

  async addField(defId: string, dto: AddFieldDto, user: AuthUser): Promise<DatasetField> {
    await this.getDatasetDefinition(defId);
    return this.fields.save(
      this.fields.create({
        datasetDefinitionId: defId,
        fieldKey: dto.fieldKey,
        sourcePath: dto.sourcePath,
        header: dto.header ?? null,
        dataType: dto.dataType ?? 'string',
        orderNo: dto.orderNo ?? 0,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }
  listFields(defId: string): Promise<DatasetField[]> {
    return this.fields.find({ where: { datasetDefinitionId: defId }, order: { orderNo: 'ASC' } });
  }

  async addFilter(defId: string, dto: AddFilterDto, user: AuthUser): Promise<DatasetFilter> {
    await this.getDatasetDefinition(defId);
    return this.filters.save(
      this.filters.create({ datasetDefinitionId: defId, filterKey: dto.filterKey, expr: dto.expr, orderNo: dto.orderNo ?? 0, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
  }
  listFilters(defId: string): Promise<DatasetFilter[]> {
    return this.filters.find({ where: { datasetDefinitionId: defId }, order: { orderNo: 'ASC' } });
  }

  async addFormula(defId: string, dto: AddFormulaDto, user: AuthUser): Promise<DatasetFormula> {
    await this.getDatasetDefinition(defId);
    return this.formulas.save(
      this.formulas.create({ datasetDefinitionId: defId, targetField: dto.targetField, formulaExpr: dto.formulaExpr, orderNo: dto.orderNo ?? 0, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
  }
  listFormulas(defId: string): Promise<DatasetFormula[]> {
    return this.formulas.find({ where: { datasetDefinitionId: defId }, order: { orderNo: 'ASC' } });
  }

  // ================= dataset_instance =================
  async generateDataset(dto: GenerateDatasetDto, user: AuthUser): Promise<DatasetInstance> {
    const def = await this.getDatasetDefinitionByCode(dto.datasetDefinitionCode);
    const fieldDefs = (await this.listFields(def.id)).map<FieldDef>((f) => ({
      fieldKey: f.fieldKey,
      sourcePath: f.sourcePath,
      dataType: f.dataType,
      header: f.header,
      orderNo: f.orderNo,
    }));
    const formulaDefs = (await this.listFormulas(def.id)).map<FormulaDef>((f) => ({
      targetField: f.targetField,
      formulaExpr: f.formulaExpr,
      orderNo: f.orderNo,
    }));

    const src = await fetchSource(this.sourceContext(), def.sourceType, dto.sourceRef);
    const rows: DatasetRow[] = buildDatasetRows(src, fieldDefs, formulaDefs);
    const payload: DatasetPayload = {
      engineVersion: REPORT_ENGINE_VERSION,
      formCode: String(dto.sourceRef.formCode ?? def.code),
      generatedAt: new Date().toISOString(),
      sourceTotals: src.sourceTotals,
      rows,
    };
    const datasetHash = computeDatasetHash(payload);
    const sourceRef = { ...dto.sourceRef, ...src.refBase };
    const sourceFingerprint = computeSourceFingerprint(sourceRef, src.upstreamHash);

    return this.datasetInstances.save(
      this.datasetInstances.create({
        datasetDefinitionId: def.id,
        sourceSnapshotRef: sourceRef,
        datasetHash,
        sourceFingerprint,
        status: DatasetInstanceStatus.GENERATED,
        scopeJson: dto.scopeJson ?? {},
        payloadJson: payload as unknown as Record<string, unknown>,
        rowCount: rows.length,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listDatasetInstances(datasetDefinitionId?: string, user?: AuthUser): Promise<DatasetInstance[]> {
    // SYS-BR-08: lọc theo phạm vi đơn vị (org nằm trong scope_json).
    const qb = this.datasetInstances.createQueryBuilder('di');
    if (datasetDefinitionId) qb.andWhere('di.dataset_definition_id = :d', { d: datasetDefinitionId });
    applyJsonOrgScope(qb, 'di', user);
    return qb.orderBy('di.generated_at', 'DESC').take(100).getMany();
  }

  async getDatasetInstance(id: string, user?: AuthUser): Promise<DatasetInstance> {
    const d = await this.datasetInstances.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Không tìm thấy dataset_instance');
    assertReadScope(undefined, (d.scopeJson?.organizationId as string) ?? null, user);
    return d;
  }

  async validateDataset(id: string, user: AuthUser): Promise<{ instance: DatasetInstance; validations: DatasetValidation[] }> {
    const inst = await this.getDatasetInstance(id);
    const payload = inst.payloadJson as unknown as DatasetPayload;
    const results = [validateReconciliation(payload), validateQualityTotal(payload), validateCompleteness(payload)];

    // Ghi đè bộ validate cũ (sinh lại) — giữ append-only? Ở đây thay bộ mới cho lần validate hiện tại.
    await this.validations.delete({ datasetInstanceId: inst.id });
    const saved: DatasetValidation[] = [];
    for (const r of results) {
      saved.push(
        await this.validations.save(
          this.validations.create({
            datasetInstanceId: inst.id,
            checkType: r.checkType,
            status: r.status,
            message: r.message,
            detailsJson: r.details,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        ),
      );
    }
    inst.status = isBlockingValidation(results) ? DatasetInstanceStatus.FAILED : DatasetInstanceStatus.VALIDATED;
    inst.updatedBy = this.uid(user);
    await this.datasetInstances.save(inst);
    return { instance: inst, validations: saved };
  }

  listDatasetValidations(instanceId: string): Promise<DatasetValidation[]> {
    return this.validations.find({ where: { datasetInstanceId: instanceId }, order: { checkType: 'ASC' } });
  }

  // ================= report_instance workflow =================
  private genReportCode(formCode: string, versionNo: number): string {
    const slug = formCode.replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
    return `RPT-${slug}-${Date.now().toString(36).toUpperCase()}-V${versionNo}`;
  }

  async createReport(dto: CreateReportInstanceDto, user: AuthUser): Promise<ReportInstance> {
    const def = await this.getDefinitionByFormCode(dto.formCode);
    const tv = dto.templateVersionId
      ? await this.templates.findOne({ where: { id: dto.templateVersionId } })
      : await this.currentPublishedTemplate(def.id);
    if (!tv) throw new NotFoundException('Không tìm thấy template_version');
    const dataset = await this.getDatasetInstance(dto.datasetInstanceId);
    return this.reports.save(
      this.reports.create({
        reportCode: this.genReportCode(def.formCode, 1),
        reportDefinitionId: def.id,
        templateVersionId: tv.id,
        datasetInstanceId: dataset.id,
        scopeJson: dto.scopeJson ?? {},
        status: ReportInstanceStatus.DRAFT,
        versionNo: 1,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listReports(user?: AuthUser): Promise<ReportInstance[]> {
    // SYS-BR-08: lọc theo phạm vi đơn vị (org nằm trong scope_json).
    const qb = this.reports.createQueryBuilder('r');
    applyJsonOrgScope(qb, 'r', user);
    return qb.orderBy('r.created_at', 'DESC').take(100).getMany();
  }

  async getReport(id: string, user?: AuthUser): Promise<ReportInstance> {
    const r = await this.reports.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Không tìm thấy báo cáo');
    assertReadScope(undefined, (r.scopeJson?.organizationId as string) ?? null, user);
    return r;
  }

  async validateReport(id: string, user: AuthUser): Promise<ReportInstance> {
    const r = await this.getReport(id);
    assertReportTransition(r.status, ReportInstanceStatus.VALIDATED);
    // đảm bảo dataset đã validate và không FAIL
    const dsValidations = await this.listDatasetValidations(r.datasetInstanceId);
    if (!dsValidations.length) throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, 'Dataset chưa được validate');
    if (dsValidations.some((v) => v.status === ValidationStatus.FAIL))
      throw new BusinessException(BusinessError.QUALITY_TOTAL_MISMATCH, 'Dataset có kiểm tra FAIL — không thể chuyển VALIDATED');
    r.status = ReportInstanceStatus.VALIDATED;
    r.updatedBy = this.uid(user);
    return this.reports.save(r);
  }

  async approveReport(id: string, user: AuthUser): Promise<ReportInstance> {
    const r = await this.getReport(id);
    assertReportTransition(r.status, ReportInstanceStatus.APPROVED);
    // BR-DT11-007: dataset lệch reconciliation (FAIL) chặn phê duyệt
    const dsValidations = await this.listDatasetValidations(r.datasetInstanceId);
    if (dsValidations.some((v) => v.status === ValidationStatus.FAIL))
      throw new BusinessException(BusinessError.QUALITY_TOTAL_MISMATCH, 'Dataset FAIL — chặn phê duyệt (BR-DT11-007)');
    r.status = ReportInstanceStatus.APPROVED;
    r.approvedAt = new Date();
    r.updatedBy = this.uid(user);
    return this.reports.save(r);
  }

  // Dựng cột hiển thị + display rows từ template layout + dataset payload.
  private buildDisplay(tv: ReportTemplateVersion, payload: DatasetPayload): { columns: RenderColumn[]; rows: Array<Record<string, string>> } {
    const layoutCols = (tv.layoutSchemaJson?.columns as Array<{ key: string; header: string }>) ?? [];
    const columns: RenderColumn[] = layoutCols.length
      ? layoutCols
      : this.inferColumns(payload);
    const rows = payload.rows.map((row) => {
      const out: Record<string, string> = {};
      for (const c of columns) out[c.key] = this.formatCell(row, c.key);
      return out;
    });
    return { columns, rows };
  }

  private inferColumns(payload: DatasetPayload): RenderColumn[] {
    const first = payload.rows[0];
    if (!first) return [{ key: 'key', header: 'Khóa' }];
    return Object.keys(first.cells).map((k) => ({ key: k, header: k }));
  }

  private formatCell(row: DatasetRow, key: string): string {
    const cell = row.cells[key];
    if (cell) {
      if (cell.state === CellState.NO_DATA) return '—';
      if (cell.state === CellState.MISSING_SUBMISSION) return 'Chưa gửi';
      if (cell.value === null) return '—';
      return typeof cell.value === 'number' ? String(cell.value) : String(cell.value);
    }
    const ref = row.refs?.[key];
    return ref === undefined || ref === null ? '' : String(ref);
  }

  // Phát hành lần đầu (APPROVED → ISSUED): render file, lưu MinIO (checksum), bất biến; sinh lineage mọi ô.
  async issueReport(id: string, dto: IssueReportDto, user: AuthUser): Promise<ReportInstance> {
    const r = await this.getReport(id);
    assertReportTransition(r.status, ReportInstanceStatus.ISSUED);
    return this.renderAndIssue(r, dto.format ?? ReportFileFormat.PDF, user);
  }

  // Phát hành LẠI bản đã ISSUED (BR-DT11-016): tạo version mới, bản cũ SUPERSEDED, FILE CŨ GIỮ NGUYÊN.
  async reissueReport(id: string, dto: IssueReportDto, user: AuthUser): Promise<ReportInstance> {
    const old = await this.getReport(id);
    if (old.status !== ReportInstanceStatus.ISSUED)
      throw new BusinessException(BusinessError.STALE_WRITE, 'Chỉ phát hành lại bản đã ISSUED');
    const def = await this.getDefinition(old.reportDefinitionId);
    const next = await this.reports.save(
      this.reports.create({
        reportCode: this.genReportCode(def.formCode, old.versionNo + 1),
        reportDefinitionId: old.reportDefinitionId,
        templateVersionId: old.templateVersionId,
        datasetInstanceId: old.datasetInstanceId,
        scopeJson: old.scopeJson,
        status: ReportInstanceStatus.APPROVED,
        approvedAt: new Date(),
        versionNo: old.versionNo + 1,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    const issued = await this.renderAndIssue(next, dto.format ?? ReportFileFormat.PDF, user);
    // đánh dấu bản cũ SUPERSEDED (không đụng file/checksum cũ)
    old.status = ReportInstanceStatus.SUPERSEDED;
    old.supersededById = issued.id;
    old.updatedBy = this.uid(user);
    await this.reports.save(old);
    return issued;
  }

  private async renderAndIssue(r: ReportInstance, format: string, user: AuthUser): Promise<ReportInstance> {
    if (!REPORT_FILE_FORMATS.includes(format as ReportFileFormat))
      throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, 'Định dạng phải là pdf|excel');
    const tv = await this.templates.findOne({ where: { id: r.templateVersionId } });
    const def = await this.getDefinition(r.reportDefinitionId);
    const dataset = await this.getDatasetInstance(r.datasetInstanceId);
    const payload = dataset.payloadJson as unknown as DatasetPayload;
    const { columns, rows } = this.buildDisplay(tv!, payload);
    const watermark = `${user.username} · ${new Date().toLocaleString('vi-VN')}`;
    const subtitle = `Biểu ${def.formCode} · dataset_hash=${dataset.datasetHash.slice(0, 12)}… · thời điểm ${new Date().toLocaleString('vi-VN')}`;
    const input = { title: def.title, subtitle, columns, rows, watermark };
    const buffer = format === ReportFileFormat.EXCEL ? await renderExcel(input) : await renderPdf(input);
    const contentType =
      format === ReportFileFormat.EXCEL
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
    const stored = await this.storage.putObject(buffer, contentType, 'reports-dt11');

    r.status = ReportInstanceStatus.ISSUED;
    r.fileObjectKey = stored.objectKey;
    r.fileFormat = format;
    r.checksum = stored.checksum; // sha256 — file bất biến
    r.issuedAt = new Date();
    r.updatedBy = this.uid(user);
    const saved = await this.reports.save(r);

    await this.writeLineage(saved, dataset, payload, columns);
    return saved;
  }

  // Ghi report_lineage: mỗi ô số/ref của báo cáo → dataset_field + snapshot_ref + transaction_ref (BR-DT11-002).
  private async writeLineage(
    report: ReportInstance,
    dataset: DatasetInstance,
    payload: DatasetPayload,
    columns: RenderColumn[],
  ): Promise<void> {
    await this.lineages.delete({ reportInstanceId: report.id });
    const snapshotRefBase = { datasetInstanceId: dataset.id, datasetHash: dataset.datasetHash, ...dataset.sourceSnapshotRef };
    const batch: ReportLineage[] = [];
    for (const row of payload.rows) {
      for (const c of columns) {
        const cell = row.cells[c.key];
        if (!cell) continue;
        batch.push(
          this.lineages.create({
            reportInstanceId: report.id,
            cellRef: `${row.key}:${c.key}`,
            datasetField: c.key,
            cellState: cell.state,
            value: typeof cell.value === 'number' ? String(cell.value) : null,
            snapshotRef: snapshotRefBase,
            transactionRef: row.refs ?? {},
          }),
        );
      }
    }
    if (batch.length) await this.lineages.save(batch);
  }

  async downloadUrl(id: string): Promise<{ url: string; reportCode: string; checksum: string | null; format: string | null }> {
    const r = await this.getReport(id);
    if (!r.fileObjectKey) throw new NotFoundException('Báo cáo chưa phát hành (chưa có tệp)');
    const url = await this.storage.presignedGetUrl(r.fileObjectKey);
    return { url, reportCode: r.reportCode, checksum: r.checksum, format: r.fileFormat };
  }

  async getLineage(reportId: string, cell?: string): Promise<ReportLineage[]> {
    await this.getReport(reportId);
    return this.lineages.find({
      where: cell ? { reportInstanceId: reportId, cellRef: cell } : { reportInstanceId: reportId },
      order: { cellRef: 'ASC' },
      take: cell ? 50 : 500,
    });
  }

  // ================= rollup nhiều đơn vị =================
  private async childTotals(childInstanceId: string | null): Promise<Record<string, number>> {
    if (!childInstanceId) return {};
    const inst = await this.reports.findOne({ where: { id: childInstanceId } });
    if (!inst) return {};
    const ds = await this.datasetInstances.findOne({ where: { id: inst.datasetInstanceId } });
    if (!ds) return {};
    const payload = ds.payloadJson as unknown as DatasetPayload;
    return payload.sourceTotals ?? {};
  }

  async rollup(parentId: string, dto: RollupDto, user: AuthUser) {
    const parent = await this.getReport(parentId);
    // upsert từng đơn vị con (unique parent+child ⇒ không nhân đôi — BR-DT11-021)
    for (const c of dto.children ?? []) {
      const existing = await this.rollups.findOne({ where: { parentReportId: parent.id, childOrgId: c.childOrgId } });
      const submitted = c.submissionStatus === SubmissionStatus.SUBMITTED;
      if (existing) {
        existing.childOrgName = c.childOrgName ?? existing.childOrgName;
        existing.childInstanceId = c.childInstanceId ?? existing.childInstanceId;
        existing.submissionStatus = c.submissionStatus;
        existing.updatedBy = this.uid(user);
        await this.rollups.save(existing);
      } else {
        await this.rollups.save(
          this.rollups.create({
            parentReportId: parent.id,
            childOrgId: c.childOrgId,
            childOrgName: c.childOrgName ?? null,
            childInstanceId: c.childInstanceId ?? null,
            submissionStatus: c.submissionStatus,
            aggregated: submitted,
            aggregatedAt: submitted ? new Date() : null,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        );
      }
    }
    return this.rollupStatus(parentId);
  }

  async rollupStatus(parentId: string) {
    await this.getReport(parentId);
    const rows = await this.rollups.find({ where: { parentReportId: parentId }, order: { childOrgName: 'ASC' } });
    const children: RollupChild[] = [];
    for (const r of rows) {
      children.push({
        childOrgId: r.childOrgId,
        submissionStatus: r.submissionStatus,
        totals: r.submissionStatus === SubmissionStatus.SUBMITTED ? await this.childTotals(r.childInstanceId) : {},
      });
    }
    const agg = aggregateRollup(children);
    return {
      parentReportId: parentId,
      children: rows.map((r) => ({
        childOrgId: r.childOrgId,
        childOrgName: r.childOrgName,
        childInstanceId: r.childInstanceId,
        submissionStatus: r.submissionStatus,
      })),
      aggregatedTotals: agg.aggregatedTotals,
      submittedCount: agg.submittedOrgIds.length,
      missingCount: agg.missingOrgIds.length,
      missingOrgIds: agg.missingOrgIds, // đơn vị chưa gửi — KHÔNG tính = 0 (BR-DT11-020)
    };
  }
}
