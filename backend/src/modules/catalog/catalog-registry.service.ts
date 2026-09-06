import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UnitOfMeasure } from './entities/unit-of-measure.entity';
import { MaterialAlias } from './entities/material-alias.entity';
import { MaterialCatalog } from './entities/material-catalog.entity';
import { CatalogReplacement } from './entities/catalog-replacement.entity';
import { CatalogChangeRequest } from './entities/catalog-change-request.entity';
import { TemporaryMaterial } from './entities/temporary-material.entity';
import { CatalogImportBatch } from './entities/catalog-import-batch.entity';
import { CatalogImportError } from './entities/catalog-import-error.entity';
import {
  ActiveStatus,
  ChangeRequestStatus,
  ImportBatchStatus,
  TemporaryMaterialStatus,
} from './catalog.enums';
import {
  assertTempCodeNotR00,
  normalizeAlias,
  replacementWarning,
  validateImportRows,
} from './catalog-rules';
import { paginated, SearchQuery } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import {
  AssignOfficialCodeDto,
  CreateAliasDto,
  CreateChangeRequestDto,
  CreateImportBatchDto,
  CreateReplacementDto,
  CreateTemporaryDto,
  CreateUnitDto,
  MapExistingDto,
  ReviewChangeRequestDto,
  UpdateAliasDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogRegistryService {
  constructor(
    @InjectRepository(UnitOfMeasure) private readonly units: Repository<UnitOfMeasure>,
    @InjectRepository(MaterialAlias) private readonly aliases: Repository<MaterialAlias>,
    @InjectRepository(MaterialCatalog) private readonly items: Repository<MaterialCatalog>,
    @InjectRepository(CatalogReplacement) private readonly replacements: Repository<CatalogReplacement>,
    @InjectRepository(CatalogChangeRequest) private readonly changeRequests: Repository<CatalogChangeRequest>,
    @InjectRepository(TemporaryMaterial) private readonly temporaries: Repository<TemporaryMaterial>,
    @InjectRepository(CatalogImportBatch) private readonly batches: Repository<CatalogImportBatch>,
    @InjectRepository(CatalogImportError) private readonly importErrors: Repository<CatalogImportError>,
    private readonly audit: AuditService,
  ) {}

  // ---- Units of measure ----
  async listUnits(q: SearchQuery) {
    const qb = this.units.createQueryBuilder('u').orderBy('u.code', 'ASC').skip(q.skip).take(q.size);
    if (q.search) qb.andWhere('(u.code ILIKE :s OR u.name ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async createUnit(dto: CreateUnitDto, user: AuthUser): Promise<UnitOfMeasure> {
    const exists = await this.units.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`DATA-003: ĐVT ${dto.code} đã tồn tại`);
    return this.units.save(this.units.create({ ...dto, createdBy: user?.sub ?? null, updatedBy: user?.sub ?? null }));
  }

  // ---- Aliases (BR-DT01-009) ----
  async createAlias(dto: CreateAliasDto, user: AuthUser): Promise<MaterialAlias> {
    const normalized = normalizeAlias(dto.aliasName);
    // Xung đột: alias chuẩn hóa đã trỏ tới mã ACTIVE khác.
    const conflict = await this.aliases.findOne({
      where: { aliasNormalized: normalized, status: ActiveStatus.ACTIVE },
    });
    if (conflict && conflict.materialCatalogId !== dto.materialCatalogId) {
      throw new ConflictException(`DATA-003: Tên khác "${dto.aliasName}" đang trỏ tới mã khác (BR-DT01-009)`);
    }
    return this.aliases.save(
      this.aliases.create({
        ...dto,
        aliasNormalized: normalized,
        status: ActiveStatus.ACTIVE,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  async updateAlias(id: string, dto: UpdateAliasDto, user: AuthUser): Promise<MaterialAlias> {
    const alias = await this.aliases.findOne({ where: { id } });
    if (!alias) throw new NotFoundException(`DATA-001: Không có alias ${id}`);
    if (dto.aliasName) {
      alias.aliasName = dto.aliasName;
      alias.aliasNormalized = normalizeAlias(dto.aliasName);
    }
    if (dto.aliasType) alias.aliasType = dto.aliasType;
    if (dto.status) alias.status = dto.status as ActiveStatus;
    alias.updatedBy = user?.sub ?? null;
    return this.aliases.save(alias);
  }

  async listAliasesForItem(materialCatalogId: string): Promise<MaterialAlias[]> {
    return this.aliases.find({ where: { materialCatalogId }, order: { aliasName: 'ASC' } });
  }

  // Tra mã chuẩn từ alias (SCR-DT01-04 "tìm trước khi đề nghị").
  async resolveAlias(q: string) {
    const normalized = normalizeAlias(q);
    const matches = await this.aliases.find({
      where: { aliasNormalized: normalized, status: ActiveStatus.ACTIVE },
    });
    const materialIds = Array.from(new Set(matches.map((a) => a.materialCatalogId)));
    const items = materialIds.length ? await this.items.find({ where: { id: In(materialIds) } }) : [];
    return { query: q, normalized, matches: items };
  }

  // ---- Replacements (BR-DT01-011) ----
  async createReplacement(dto: CreateReplacementDto, user: AuthUser): Promise<CatalogReplacement> {
    return this.replacements.save(
      this.replacements.create({ ...dto, createdBy: user?.sub ?? null }),
    );
  }

  async replacementWarningFor(materialId: string) {
    const list = await this.replacements.find({ where: { oldMaterialId: materialId } });
    const entries = await Promise.all(
      list.map(async (r) => ({
        oldMaterialId: r.oldMaterialId,
        newMaterialId: r.newMaterialId,
        newCode: (await this.items.findOne({ where: { id: r.newMaterialId } }))?.code ?? null,
      })),
    );
    return replacementWarning(entries, materialId);
  }

  // ---- Change requests (đề nghị bổ sung) ----
  async createChangeRequest(dto: CreateChangeRequestDto, user: AuthUser): Promise<CatalogChangeRequest> {
    const requestCode = `CR-${Date.now()}`;
    return this.changeRequests.save(
      this.changeRequests.create({
        requestCode,
        proposedName: dto.proposedName,
        requestType: dto.requestType,
        organizationId: dto.organizationId ?? user?.organizationId ?? null,
        proposedUnitId: dto.proposedUnitId ?? null,
        proposedParentId: dto.proposedParentId ?? null,
        description: dto.description ?? null,
        technicalSpec: dto.technicalSpec ?? null,
        status: ChangeRequestStatus.DRAFT,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  async submitChangeRequest(id: string, user: AuthUser): Promise<CatalogChangeRequest> {
    const cr = await this.getChangeRequest(id);
    cr.status = ChangeRequestStatus.SUBMITTED;
    cr.submittedBy = user?.sub ?? null;
    cr.submittedAt = new Date();
    cr.updatedBy = user?.sub ?? null;
    return this.changeRequests.save(cr);
  }

  async reviewChangeRequest(id: string, dto: ReviewChangeRequestDto, user: AuthUser): Promise<CatalogChangeRequest> {
    const cr = await this.getChangeRequest(id);
    cr.status = dto.decision === 'APPROVED' ? ChangeRequestStatus.APPROVED : ChangeRequestStatus.REJECTED;
    cr.reviewedBy = user?.sub ?? null;
    cr.reviewedAt = new Date();
    cr.updatedBy = user?.sub ?? null;
    return this.changeRequests.save(cr);
  }

  async mapExisting(id: string, dto: MapExistingDto, user: AuthUser): Promise<CatalogChangeRequest> {
    const cr = await this.getChangeRequest(id);
    const item = await this.items.findOne({ where: { id: dto.materialCatalogId } });
    if (!item) throw new NotFoundException(`DATA-001: Không có mã ${dto.materialCatalogId}`);
    cr.status = ChangeRequestStatus.MAPPED;
    cr.reviewedBy = user?.sub ?? null;
    cr.reviewedAt = new Date();
    cr.updatedBy = user?.sub ?? null;
    return this.changeRequests.save(cr);
  }

  async listChangeRequests(q: SearchQuery & { status?: string }) {
    const qb = this.changeRequests.createQueryBuilder('c').orderBy('c.created_at', 'DESC').skip(q.skip).take(q.size);
    if (q.status) qb.andWhere('c.status = :st', { st: q.status });
    if (q.search) qb.andWhere('(c.request_code ILIKE :s OR c.proposed_name ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  private async getChangeRequest(id: string): Promise<CatalogChangeRequest> {
    const cr = await this.changeRequests.findOne({ where: { id } });
    if (!cr) throw new NotFoundException(`DATA-001: Không có đề nghị ${id}`);
    return cr;
  }

  // ---- Temporary materials (BR-DT01-006) ----
  async createTemporary(dto: CreateTemporaryDto, user: AuthUser): Promise<TemporaryMaterial> {
    assertTempCodeNotR00(dto.temporaryCode); // cấm bắt đầu R00.
    const exists = await this.temporaries.findOne({ where: { temporaryCode: dto.temporaryCode } });
    if (exists) throw new ConflictException(`DATA-003: Mã tạm ${dto.temporaryCode} đã tồn tại`);
    return this.temporaries.save(
      this.temporaries.create({
        temporaryCode: dto.temporaryCode,
        displayName: dto.displayName,
        requestId: dto.requestId ?? null,
        unitId: dto.unitId ?? null,
        proposedParentId: dto.proposedParentId ?? null,
        status: TemporaryMaterialStatus.PENDING_MAPPING,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  async listTemporaries(q: SearchQuery & { status?: string }) {
    const qb = this.temporaries.createQueryBuilder('t').orderBy('t.created_at', 'DESC').skip(q.skip).take(q.size);
    if (q.status) qb.andWhere('t.status = :st', { st: q.status });
    if (q.search) qb.andWhere('(t.temporary_code ILIKE :s OR t.display_name ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  // Ánh xạ TEMP → mã chính thức (TC-DT01-010): giữ quan hệ + ghi audit.
  async assignOfficialCode(id: string, dto: AssignOfficialCodeDto, user: AuthUser): Promise<TemporaryMaterial> {
    const temp = await this.temporaries.findOne({ where: { id } });
    if (!temp) throw new NotFoundException(`DATA-001: Không có mã tạm ${id}`);
    const official = await this.items.findOne({ where: { id: dto.officialMaterialId } });
    if (!official) throw new NotFoundException(`DATA-001: Không có mã chính thức ${dto.officialMaterialId}`);

    const before = { status: temp.status, officialMaterialId: temp.officialMaterialId };
    temp.officialMaterialId = official.id;
    temp.status = TemporaryMaterialStatus.MAPPED;
    temp.mappedAt = new Date();
    temp.updatedBy = user?.sub ?? null;
    const saved = await this.temporaries.save(temp);

    await this.audit.record({
      actorId: user?.sub ?? null,
      actorName: user?.username ?? null,
      action: 'MAP_TEMPORARY_TO_OFFICIAL',
      entityType: 'temporary_material',
      entityId: saved.id,
      before,
      after: { status: saved.status, officialMaterialId: saved.officialMaterialId, officialCode: official.code },
    });
    return saved;
  }

  // ---- Import batches (file_hash + validate) ----
  async createImportBatch(dto: CreateImportBatchDto, user: AuthUser): Promise<CatalogImportBatch> {
    const rows = dto.rows ?? [];
    return this.batches.save(
      this.batches.create({
        fileName: dto.fileName,
        fileHash: dto.fileHash,
        versionCode: dto.versionCode ?? null,
        sourceDocumentId: dto.sourceDocumentId ?? null,
        importedBy: user?.sub ?? null,
        totalRows: rows.length,
        status: ImportBatchStatus.DRAFT,
        rows,
      }),
    );
  }

  // Validate: kiểm tra cấu trúc, sinh danh sách lỗi, đặt trạng thái VALIDATED/FAILED.
  async validateImportBatch(id: string): Promise<CatalogImportBatch> {
    const batch = await this.batches.findOne({ where: { id } });
    if (!batch) throw new NotFoundException(`DATA-001: Không có lô nhập ${id}`);
    await this.importErrors.delete({ batchId: id });
    const errors = validateImportRows(batch.rows as never[]);
    if (errors.length) {
      await this.importErrors.save(errors.map((e) => this.importErrors.create({ batchId: id, ...e })));
    }
    batch.errorRows = errors.length;
    batch.validRows = Math.max(0, batch.totalRows - errors.length);
    batch.status = errors.length ? ImportBatchStatus.FAILED : ImportBatchStatus.VALIDATED;
    return this.batches.save(batch);
  }

  async getImportErrors(id: string): Promise<CatalogImportError[]> {
    return this.importErrors.find({ where: { batchId: id }, order: { rowNo: 'ASC' } });
  }
}
