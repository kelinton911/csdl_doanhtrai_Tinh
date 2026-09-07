import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from './entities/normative-document.entity';
import { NormSet, NormSetVersion } from './entities/norm-set.entity';
import { MaterialNorm, NormDimension } from './entities/material-norm.entity';
import {
  AuthorityRankVersion,
  CalculationParameter,
  NormConflictCase,
  NormSelectorConfig,
} from './entities/norm-selector.entity';
import { NormImportBatch } from './entities/norm-import.entity';
import {
  Command,
  CommandAssignment,
  CommandProgress,
  CommandRequirement,
  CommandVersion,
} from './entities/command.entity';
import {
  CommandStatus,
  COMMAND_TRANSITIONS,
  NormCandidate,
  NormConflictStatus,
  NormSourceStatus,
  NormValueType,
  ResolveRequestInput,
  ResolveResult,
  resolveNorm,
  resolveRequestHash,
  assertNormSetEditable,
} from './norms-rules';
import { CatalogVersionStatus, CATALOG_VERSION_TRANSITIONS } from '../../common/enums';
import { ImportBatchStatus, ActiveStatus } from '../catalog/catalog.enums';
import { assertTransition } from '../../common/enums/assert-transition';
import { resolveAsOf, toHcmIso } from '../../common/time/as-of';
import { paginated, PaginationQuery } from '../../common/dto/pagination.dto';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  AddScopesDto,
  CreateAssignmentDto,
  CreateAuthorityRankDto,
  CreateCalculationParameterDto,
  CreateCommandDto,
  CreateCommandVersionDto,
  CreateDocumentVersionDto,
  CreateMaterialNormDto,
  CreateNormativeDocumentDto,
  CreateNormSetDto,
  CreateNormSetVersionDto,
  CreateProgressDto,
  CreateRequirementDto,
  CreateSourceReferenceDto,
  ImportNormsDto,
  ResolveConflictDto,
  ResolveNormDto,
} from './dt07.dto';

@Injectable()
export class NormsService {
  constructor(
    @InjectRepository(NormativeDocument) private readonly docs: Repository<NormativeDocument>,
    @InjectRepository(NormativeDocumentVersion) private readonly docVersions: Repository<NormativeDocumentVersion>,
    @InjectRepository(NormSourceReference) private readonly references: Repository<NormSourceReference>,
    @InjectRepository(NormSet) private readonly sets: Repository<NormSet>,
    @InjectRepository(NormSetVersion) private readonly setVersions: Repository<NormSetVersion>,
    @InjectRepository(MaterialNorm) private readonly norms: Repository<MaterialNorm>,
    @InjectRepository(NormDimension) private readonly dimensions: Repository<NormDimension>,
    @InjectRepository(CalculationParameter) private readonly params: Repository<CalculationParameter>,
    @InjectRepository(NormSelectorConfig) private readonly selectorConfigs: Repository<NormSelectorConfig>,
    @InjectRepository(AuthorityRankVersion) private readonly authorityRanks: Repository<AuthorityRankVersion>,
    @InjectRepository(NormConflictCase) private readonly conflicts: Repository<NormConflictCase>,
    @InjectRepository(NormImportBatch) private readonly importBatches: Repository<NormImportBatch>,
    @InjectRepository(Command) private readonly commands: Repository<Command>,
    @InjectRepository(CommandVersion) private readonly commandVersions: Repository<CommandVersion>,
    @InjectRepository(CommandRequirement) private readonly requirements: Repository<CommandRequirement>,
    @InjectRepository(CommandAssignment) private readonly assignments: Repository<CommandAssignment>,
    @InjectRepository(CommandProgress) private readonly progress: Repository<CommandProgress>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private uid(u: AuthUser) {
    return u?.sub ?? null;
  }

  // ======================= Văn bản căn cứ =======================
  listDocuments(q: PaginationQuery) {
    return this.docs
      .createQueryBuilder('d')
      .orderBy('d.created_at', 'DESC')
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async createDocument(dto: CreateNormativeDocumentDto, user: AuthUser): Promise<NormativeDocument> {
    const dup = await this.docs.findOne({ where: { docNo: dto.docNo } });
    if (dup) throw new ConflictException(`DATA-003: Văn bản ${dto.docNo} đã tồn tại`);
    return this.docs.save(this.docs.create({ ...dto, issueDate: dto.issueDate ?? null, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async createDocumentVersion(documentId: string, dto: CreateDocumentVersionDto, user: AuthUser): Promise<NormativeDocumentVersion> {
    const doc = await this.docs.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException(`DATA-001: Không có văn bản ${documentId}`);
    return this.docVersions.save(
      this.docVersions.create({
        documentId,
        versionLabel: dto.versionLabel,
        fileId: dto.fileId ?? null,
        fileHash: dto.fileHash ?? null,
        effectiveFrom: dto.effectiveFrom ?? null,
        effectiveTo: dto.effectiveTo ?? null,
        status: CatalogVersionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listDocumentVersions(documentId: string) {
    return this.docVersions.find({ where: { documentId }, order: { createdAt: 'DESC' } });
  }

  async addReference(documentVersionId: string, dto: CreateSourceReferenceDto, user: AuthUser): Promise<NormSourceReference> {
    const v = await this.docVersions.findOne({ where: { id: documentVersionId } });
    if (!v) throw new NotFoundException(`DATA-001: Không có phiên bản văn bản ${documentVersionId}`);
    return this.references.save(
      this.references.create({
        documentVersionId,
        pageNo: dto.pageNo ?? null,
        lineRef: dto.lineRef ?? null,
        quoteText: dto.quoteText ?? null,
        appendixCode: dto.appendixCode ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listReferences(documentVersionId: string) {
    return this.references.find({ where: { documentVersionId } });
  }

  // ======================= Bộ định mức =======================
  listSets(q: PaginationQuery) {
    return this.sets
      .createQueryBuilder('s')
      .orderBy('s.set_code', 'ASC')
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async createSet(dto: CreateNormSetDto, user: AuthUser): Promise<NormSet> {
    const dup = await this.sets.findOne({ where: { setCode: dto.setCode } });
    if (dup) throw new ConflictException(`DATA-003: Bộ định mức ${dto.setCode} đã tồn tại`);
    return this.sets.save(this.sets.create({ ...dto, description: dto.description ?? null, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async createSetVersion(normSetId: string, dto: CreateNormSetVersionDto, user: AuthUser): Promise<NormSetVersion> {
    const set = await this.sets.findOne({ where: { id: normSetId } });
    if (!set) throw new NotFoundException(`DATA-001: Không có bộ định mức ${normSetId}`);
    return this.setVersions.save(
      this.setVersions.create({
        normSetId,
        versionLabel: dto.versionLabel,
        documentVersionId: dto.documentVersionId ?? null,
        effectiveFrom: dto.effectiveFrom ?? null,
        effectiveTo: dto.effectiveTo ?? null,
        status: CatalogVersionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listSetVersions(normSetId: string) {
    return this.setVersions.find({ where: { normSetId }, order: { createdAt: 'DESC' } });
  }

  private async getSetVersion(id: string): Promise<NormSetVersion> {
    const v = await this.setVersions.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`DATA-001: Không có phiên bản bộ định mức ${id}`);
    return v;
  }

  // Thêm định mức vào phiên bản DRAFT (BR-DT07-002: bộ PUBLISHED bất biến).
  // Có sourceReferenceId → VERIFIED (dùng chính thức); không → LEGACY_UNVERIFIED (BR-DT07-026).
  async addNorm(setVersionId: string, dto: CreateMaterialNormDto, user: AuthUser): Promise<MaterialNorm> {
    const version = await this.getSetVersion(setVersionId);
    assertNormSetEditable(version.status);
    const sourceStatus = dto.sourceReferenceId ? NormSourceStatus.VERIFIED : NormSourceStatus.LEGACY_UNVERIFIED;
    return this.norms.save(
      this.norms.create({
        normSetVersionId: setVersionId,
        materialCatalogId: dto.materialCatalogId,
        semanticParam: dto.semanticParam,
        valueType: dto.valueType ?? NormValueType.FIXED,
        valueNumeric: dto.valueNumeric != null ? String(dto.valueNumeric) : null,
        rawValue: dto.rawValue ?? null,
        unitId: dto.unitId ?? null,
        formulaExpr: dto.formulaExpr ?? null,
        sourceStatus,
        sourceReferenceId: dto.sourceReferenceId ?? null,
        effectiveFrom: dto.effectiveFrom ?? version.effectiveFrom ?? null,
        effectiveTo: dto.effectiveTo ?? version.effectiveTo ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listNorms(setVersionId: string) {
    return this.norms.find({ where: { normSetVersionId: setVersionId }, order: { createdAt: 'ASC' } });
  }

  private async getNorm(id: string): Promise<MaterialNorm> {
    const n = await this.norms.findOne({ where: { id } });
    if (!n) throw new NotFoundException(`DATA-001: Không có định mức ${id}`);
    return n;
  }

  // Gắn chiều phạm vi (scope đa chiều) cho định mức — chỉ khi bộ còn sửa được.
  async addScopes(normId: string, dto: AddScopesDto, user: AuthUser): Promise<NormDimension[]> {
    const norm = await this.getNorm(normId);
    const version = await this.getSetVersion(norm.normSetVersionId);
    assertNormSetEditable(version.status);
    const rows = dto.dimensions.map((d) =>
      this.dimensions.create({
        materialNormId: normId,
        dimensionType: d.dimensionType,
        dimensionValue: d.dimensionValue,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    return this.dimensions.save(rows);
  }

  // Publish bộ định mức: DRAFT/VALIDATED → PUBLISHED; version trước của CÙNG bộ → SUPERSEDED.
  // Ghi outbox 'norm.set.published' trong cùng transaction (Sprint 0 GAP-7).
  async publishSetVersion(id: string, user: AuthUser): Promise<NormSetVersion> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(NormSetVersion);
      const version = await repo.findOne({ where: { id } });
      if (!version) throw new NotFoundException(`DATA-001: Không có phiên bản bộ định mức ${id}`);
      assertTransition(CATALOG_VERSION_TRANSITIONS, version.status, CatalogVersionStatus.PUBLISHED);

      await repo
        .createQueryBuilder()
        .update()
        .set({ status: CatalogVersionStatus.SUPERSEDED, updatedBy: this.uid(user) })
        .where('norm_set_id = :sid', { sid: version.normSetId })
        .andWhere('status = :pub', { pub: CatalogVersionStatus.PUBLISHED })
        .execute();

      version.status = CatalogVersionStatus.PUBLISHED;
      version.publishedAt = new Date();
      version.publishedBy = this.uid(user);
      version.updatedBy = this.uid(user);
      const saved = await repo.save(version);

      await this.outbox.enqueue(m, {
        aggregateType: 'norm_set_version',
        aggregateId: saved.id,
        eventType: 'norm.set.published',
        payload: { normSetId: saved.normSetId, versionLabel: saved.versionLabel, effectiveFrom: saved.effectiveFrom },
        correlationId: null,
      });
      return saved;
    });
  }

  // ======================= RESOLVE (DT-08 gọi) — deterministic =======================
  private async loadActiveRank(): Promise<Record<string, number>> {
    const rank = await this.authorityRanks.findOne({ where: { isActive: true } });
    return rank?.rankJson ?? {};
  }

  private async loadCandidates(materialCatalogId: string, semanticParam: string): Promise<NormCandidate[]> {
    const rows = await this.norms
      .createQueryBuilder('n')
      .innerJoin('norm_set_version', 'v', 'v.id = n.norm_set_version_id')
      .leftJoin('normative_document_version', 'dv', 'dv.id = v.document_version_id')
      .leftJoin('normative_document', 'd', 'd.id = dv.document_id')
      .where('n.material_catalog_id = :mat', { mat: materialCatalogId })
      .andWhere('n.semantic_param = :sem', { sem: semanticParam })
      .andWhere('v.status = :pub', { pub: CatalogVersionStatus.PUBLISHED })
      .select('n.id', 'normId')
      .addSelect('n.material_catalog_id', 'materialCatalogId')
      .addSelect('n.semantic_param', 'semanticParam')
      .addSelect('n.source_status', 'sourceStatus')
      .addSelect('n.value_type', 'valueType')
      .addSelect('n.value_numeric', 'valueNumeric')
      .addSelect('n.raw_value', 'rawValue')
      .addSelect('n.unit_id', 'unitId')
      .addSelect('n.formula_expr', 'formulaExpr')
      .addSelect('n.effective_from', 'effectiveFrom')
      .addSelect('n.effective_to', 'effectiveTo')
      .addSelect('d.issuing_authority', 'issuingAuthority')
      .getRawMany<{
        normId: string;
        materialCatalogId: string;
        semanticParam: string;
        sourceStatus: NormSourceStatus;
        valueType: string;
        valueNumeric: string | null;
        rawValue: string | null;
        unitId: string | null;
        formulaExpr: string | null;
        effectiveFrom: string | null;
        effectiveTo: string | null;
        issuingAuthority: string | null;
      }>();

    if (rows.length === 0) return [];
    const normIds = rows.map((r) => r.normId);
    const dims = await this.dimensions.find({ where: { materialNormId: In(normIds) } });
    const dimsByNorm = new Map<string, Array<{ dimensionType: string; dimensionValue: string }>>();
    for (const d of dims) {
      const list = dimsByNorm.get(d.materialNormId) ?? [];
      list.push({ dimensionType: d.dimensionType, dimensionValue: d.dimensionValue });
      dimsByNorm.set(d.materialNormId, list);
    }
    return rows.map((r) => ({
      normId: r.normId,
      materialCatalogId: r.materialCatalogId,
      semanticParam: r.semanticParam,
      sourceStatus: r.sourceStatus,
      valueType: r.valueType,
      valueNumeric: r.valueNumeric != null ? Number(r.valueNumeric) : null,
      rawValue: r.rawValue,
      unitId: r.unitId,
      formulaExpr: r.formulaExpr,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      issuingAuthority: r.issuingAuthority,
      dimensions: dimsByNorm.get(r.normId) ?? [],
    }));
  }

  // POST /norms/resolve — trả SELECTED | NO_RULE | CONFLICT + explanation trace.
  // CONFLICT được ghi vào norm_conflict_case (không tự chọn — BR-DT07-008).
  async resolve(dto: ResolveNormDto, user?: AuthUser): Promise<ResolveResult & { asOfTime: string; sourceReference?: NormSourceReference | null }> {
    const asOf = resolveAsOf(dto.asOfTime);
    const [candidates, rank] = await Promise.all([
      this.loadCandidates(dto.materialCatalogId, dto.semanticParam),
      this.loadActiveRank(),
    ]);
    const request = {
      materialCatalogId: dto.materialCatalogId,
      semanticParam: dto.semanticParam,
      scope: dto.scope ?? {},
      asOf,
    };
    const result = resolveNorm(candidates, request, rank);

    let sourceReference: NormSourceReference | null = null;
    if (result.status === 'SELECTED' && result.selected) {
      const norm = await this.norms.findOne({ where: { id: result.selected.normId } });
      if (norm?.sourceReferenceId) {
        sourceReference = await this.references.findOne({ where: { id: norm.sourceReferenceId } });
      }
    } else if (result.status === 'CONFLICT' && result.candidateNormIds) {
      await this.recordConflict(request, result.candidateNormIds, user);
    }

    return { ...result, asOfTime: toHcmIso(asOf), sourceReference };
  }

  private async recordConflict(
    request: ResolveRequestInput,
    candidateNormIds: string[],
    user?: AuthUser,
  ): Promise<void> {
    const hash = resolveRequestHash(request);
    const existing = await this.conflicts.findOne({ where: { resolveRequestHash: hash, status: NormConflictStatus.OPEN } });
    if (existing) return; // gom trùng: đã có case mở cho cùng yêu cầu.
    await this.conflicts.save(
      this.conflicts.create({
        resolveRequestHash: hash,
        materialCatalogId: request.materialCatalogId,
        semanticParam: request.semanticParam,
        candidateNormIds,
        requestScope: (request.scope ?? {}) as Record<string, unknown>,
        status: NormConflictStatus.OPEN,
        createdBy: user ? this.uid(user) : null,
        updatedBy: user ? this.uid(user) : null,
      }),
    );
  }

  // ======================= Xung đột định mức =======================
  listConflicts(status?: string) {
    return this.conflicts.find({
      where: status ? { status: status as NormConflictStatus } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async resolveConflict(id: string, dto: ResolveConflictDto, user: AuthUser): Promise<NormConflictCase> {
    const c = await this.conflicts.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`DATA-001: Không có ca xung đột ${id}`);
    if (!c.candidateNormIds.includes(dto.resolvedNormId)) {
      throw new ConflictException('DATA-003: Định mức chọn không nằm trong danh sách ứng viên xung đột');
    }
    c.status = NormConflictStatus.RESOLVED;
    c.resolvedNormId = dto.resolvedNormId;
    c.resolutionNote = dto.resolutionNote ?? null;
    c.resolvedBy = this.uid(user);
    c.resolvedAt = new Date();
    c.updatedBy = this.uid(user);
    return this.conflicts.save(c);
  }

  // ======================= Tham số tính toán + xếp hạng cơ quan =======================
  listParameters() {
    return this.params.find({ order: { semanticParam: 'ASC' } });
  }

  async createParameter(dto: CreateCalculationParameterDto, user: AuthUser): Promise<CalculationParameter> {
    const dup = await this.params.findOne({ where: { semanticParam: dto.semanticParam } });
    if (dup) throw new ConflictException(`DATA-003: Tham số ${dto.semanticParam} đã tồn tại`);
    return this.params.save(this.params.create({ ...dto, unitId: dto.unitId ?? null, status: ActiveStatus.ACTIVE, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  listAuthorityRanks() {
    return this.authorityRanks.find({ order: { createdAt: 'DESC' } });
  }

  // Tạo phiên bản xếp hạng cơ quan; đặt active sẽ tắt các phiên bản active khác (BR-DT07-027).
  async createAuthorityRank(dto: CreateAuthorityRankDto, user: AuthUser): Promise<AuthorityRankVersion> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(AuthorityRankVersion);
      const dup = await repo.findOne({ where: { versionLabel: dto.versionLabel } });
      if (dup) throw new ConflictException(`DATA-003: Phiên bản xếp hạng ${dto.versionLabel} đã tồn tại`);
      if (dto.isActive) {
        await repo.createQueryBuilder().update().set({ isActive: false, updatedBy: this.uid(user) }).where('is_active = true').execute();
      }
      return repo.save(
        repo.create({
          versionLabel: dto.versionLabel,
          rankJson: dto.rankJson,
          effectiveFrom: dto.effectiveFrom ?? null,
          isActive: dto.isActive ?? false,
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
    });
  }

  // ======================= Nhập Excel định mức (→ DRAFT) — BR-DT07-026 =======================
  async importNorms(dto: ImportNormsDto, user: AuthUser): Promise<{ batch: NormImportBatch; created: number }> {
    return this.dataSource.transaction(async (m) => {
      const batchRepo = m.getRepository(NormImportBatch);
      const normRepo = m.getRepository(MaterialNorm);

      const dupFile = await batchRepo.findOne({ where: { fileHash: dto.fileHash } });
      if (dupFile) throw new ConflictException(`DATA-003: File ${dto.fileHash} đã được nhập trước đó`);

      // Chỉ nhập vào phiên bản còn sửa được (nếu chỉ định).
      if (dto.normSetVersionId) {
        const v = await m.getRepository(NormSetVersion).findOne({ where: { id: dto.normSetVersionId } });
        if (!v) throw new NotFoundException(`DATA-001: Không có phiên bản bộ định mức ${dto.normSetVersionId}`);
        assertNormSetEditable(v.status);
      }

      const rows = dto.rows ?? [];
      let created = 0;
      const errors: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] as { materialCatalogId?: string; semanticParam?: string; valueNumeric?: number; rawValue?: string; unitId?: string };
        if (!r.materialCatalogId || !r.semanticParam) {
          errors.push(i + 1);
          continue;
        }
        if (dto.normSetVersionId) {
          // Nhập Excel LUÔN tạo định mức LEGACY_UNVERIFIED (chưa gắn căn cứ) — không dùng resolve.
          await normRepo.save(
            normRepo.create({
              normSetVersionId: dto.normSetVersionId,
              materialCatalogId: r.materialCatalogId,
              semanticParam: r.semanticParam,
              valueType: NormValueType.FIXED,
              valueNumeric: r.valueNumeric != null ? String(r.valueNumeric) : null,
              rawValue: r.rawValue ?? null,
              unitId: r.unitId ?? null,
              sourceStatus: NormSourceStatus.LEGACY_UNVERIFIED,
              createdBy: this.uid(user),
              updatedBy: this.uid(user),
            }),
          );
          created++;
        }
      }

      const batch = await batchRepo.save(
        batchRepo.create({
          fileName: dto.fileName,
          fileHash: dto.fileHash,
          normSetVersionId: dto.normSetVersionId ?? null,
          importedBy: this.uid(user),
          totalRows: rows.length,
          validRows: created,
          errorRows: errors.length,
          status: ImportBatchStatus.DRAFT,
          rows,
        }),
      );
      return { batch, created };
    });
  }

  // ======================= Chỉ lệnh hậu cần =======================
  listCommands(q: PaginationQuery) {
    return this.commands
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC')
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async createCommand(dto: CreateCommandDto, user: AuthUser): Promise<Command> {
    const commandNo = dto.commandNo ?? `CMD-${Date.now()}`;
    const dup = await this.commands.findOne({ where: { commandNo } });
    if (dup) throw new ConflictException(`DATA-003: Chỉ lệnh ${commandNo} đã tồn tại`);
    return this.commands.save(
      this.commands.create({
        commandNo,
        title: dto.title,
        issuingAuthority: dto.issuingAuthority,
        effectiveDate: dto.effectiveDate ?? null,
        status: CommandStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async getCommand(id: string): Promise<Command> {
    const c = await this.commands.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`DATA-001: Không có chỉ lệnh ${id}`);
    return c;
  }

  async createCommandVersion(commandId: string, dto: CreateCommandVersionDto, user: AuthUser): Promise<CommandVersion> {
    await this.getCommand(commandId);
    return this.commandVersions.save(
      this.commandVersions.create({ commandId, versionLabel: dto.versionLabel, fileId: dto.fileId ?? null, note: dto.note ?? null, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
  }

  async transitionCommand(id: string, to: CommandStatus, user: AuthUser): Promise<Command> {
    const c = await this.getCommand(id);
    assertTransition(COMMAND_TRANSITIONS, c.status, to);
    c.status = to;
    if (to === CommandStatus.ISSUED) c.issuedAt = new Date();
    c.updatedBy = this.uid(user);
    return this.commands.save(c);
  }

  // BR-DT07-031: yêu cầu chỉ lệnh gắn định mức PUBLISHED tại effective_date của chỉ lệnh.
  async addRequirement(commandId: string, dto: CreateRequirementDto, user: AuthUser): Promise<CommandRequirement> {
    const command = await this.getCommand(commandId);
    const bound = await this.bindPublishedNorm(dto.materialCatalogId, command.effectiveDate);
    return this.requirements.save(
      this.requirements.create({
        commandId,
        materialCatalogId: dto.materialCatalogId,
        requiredQty: String(dto.requiredQty),
        unitId: dto.unitId ?? null,
        deadline: dto.deadline ?? null,
        normSetVersionId: bound?.normSetVersionId ?? null,
        materialNormId: bound?.materialNormId ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Tìm định mức VERIFIED thuộc bộ PUBLISHED còn hiệu lực tại effective_date cho vật chất.
  private async bindPublishedNorm(
    materialCatalogId: string,
    effectiveDate: string | null,
  ): Promise<{ normSetVersionId: string; materialNormId: string } | null> {
    const asOf = effectiveDate ?? undefined;
    const qb = this.norms
      .createQueryBuilder('n')
      .innerJoin('norm_set_version', 'v', 'v.id = n.norm_set_version_id')
      .where('n.material_catalog_id = :mat', { mat: materialCatalogId })
      .andWhere('n.source_status = :verified', { verified: NormSourceStatus.VERIFIED })
      .andWhere('v.status = :pub', { pub: CatalogVersionStatus.PUBLISHED });
    if (asOf) {
      qb.andWhere('(n.effective_from IS NULL OR n.effective_from <= :asOf)', { asOf })
        .andWhere('(n.effective_to IS NULL OR n.effective_to >= :asOf)', { asOf });
    }
    const norm = await qb.orderBy('v.published_at', 'DESC').getOne();
    return norm ? { normSetVersionId: norm.normSetVersionId, materialNormId: norm.id } : null;
  }

  listRequirements(commandId: string) {
    return this.requirements.find({ where: { commandId } });
  }

  async addAssignment(requirementId: string, dto: CreateAssignmentDto, user: AuthUser): Promise<CommandAssignment> {
    const r = await this.requirements.findOne({ where: { id: requirementId } });
    if (!r) throw new NotFoundException(`DATA-001: Không có yêu cầu ${requirementId}`);
    return this.assignments.save(
      this.assignments.create({
        requirementId,
        organizationId: dto.organizationId,
        allocatedQty: String(dto.allocatedQty),
        deadline: dto.deadline ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async addProgress(assignmentId: string, dto: CreateProgressDto, user: AuthUser): Promise<CommandProgress> {
    const a = await this.assignments.findOne({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException(`DATA-001: Không có phân giao ${assignmentId}`);
    return this.progress.save(
      this.progress.create({
        assignmentId,
        reportedQty: String(dto.reportedQty),
        status: dto.status ?? 'REPORTED',
        reportedAt: new Date(),
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }
}
