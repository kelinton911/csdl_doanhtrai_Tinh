import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductModel } from './entities/product-model.entity';
import { ModelCatalogLink } from './entities/model-catalog-link.entity';
import { DesignRevision } from './entities/design-revision.entity';
import { TechnicalDocument } from './entities/technical-document.entity';
import { DrawingSheet } from './entities/drawing-sheet.entity';
import { TechnicalAttribute } from './entities/technical-attribute.entity';
import { BomHeader } from './entities/bom-header.entity';
import { BomItem } from './entities/bom-item.entity';
import { SourceProvenance } from './entities/source-provenance.entity';
import { ModelRelationship } from './entities/model-relationship.entity';
import {
  CatalogLinkType,
  ModelRelationshipType,
  REVISION_TRANSITIONS,
  RevisionStatus,
  TechVerificationStatus,
} from './tech.enums';
import { ActiveStatus } from '../catalog/catalog.enums';
import { assertTransition } from '../../common/enums/assert-transition';
import {
  assertNoRelationshipCycle,
  assertVerifiedForCriterion,
  bomItemStatus,
  computeCompleteness,
  isDuplicateHash,
} from './tech-rules';
import { paginated, SearchQuery } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreateAttributeDto,
  CreateBomDto,
  CreateBomItemDto,
  CreateCatalogLinkDto,
  CreateDocumentDto,
  CreateModelDto,
  CreateRelationshipDto,
  CreateRevisionDto,
  CreateSheetDto,
  VerifyDto,
} from './dt03.dto';

@Injectable()
export class TechnicalService {
  constructor(
    @InjectRepository(ProductModel) private readonly models: Repository<ProductModel>,
    @InjectRepository(ModelCatalogLink) private readonly links: Repository<ModelCatalogLink>,
    @InjectRepository(DesignRevision) private readonly revisions: Repository<DesignRevision>,
    @InjectRepository(TechnicalDocument) private readonly documents: Repository<TechnicalDocument>,
    @InjectRepository(DrawingSheet) private readonly sheets: Repository<DrawingSheet>,
    @InjectRepository(TechnicalAttribute) private readonly attributes: Repository<TechnicalAttribute>,
    @InjectRepository(BomHeader) private readonly boms: Repository<BomHeader>,
    @InjectRepository(BomItem) private readonly bomItems: Repository<BomItem>,
    @InjectRepository(SourceProvenance) private readonly provenance: Repository<SourceProvenance>,
    @InjectRepository(ModelRelationship) private readonly relationships: Repository<ModelRelationship>,
  ) {}

  private uid(user: AuthUser) {
    return user?.sub ?? null;
  }

  // ---- Models ----
  async listModels(q: SearchQuery & { catalogId?: string }) {
    const qb = this.models.createQueryBuilder('m').orderBy('m.created_at', 'DESC').skip(q.skip).take(q.size);
    if (q.search) qb.andWhere('(m.model_code_internal ILIKE :s OR m.model_name ILIKE :s OR m.design_symbol ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async createModel(dto: CreateModelDto, user: AuthUser): Promise<ProductModel> {
    const exists = await this.models.findOne({ where: { modelCodeInternal: dto.modelCodeInternal } });
    if (exists) throw new ConflictException(`DATA-003: Mã mẫu ${dto.modelCodeInternal} đã tồn tại`);
    return this.models.save(this.models.create({ ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async getModel(id: string): Promise<ProductModel> {
    const m = await this.models.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`DATA-001: Không có mẫu ${id}`);
    return m;
  }

  // 1 R00 ↔ N model (BR-DT03-002): tra các mẫu gắn cùng material_catalog.
  async modelsByCatalog(materialCatalogId: string): Promise<ProductModel[]> {
    const links = await this.links.find({ where: { materialCatalogId, status: ActiveStatus.ACTIVE } });
    const ids = links.map((l) => l.productModelId);
    return ids.length ? this.models.find({ where: { id: In(ids) } }) : [];
  }

  async createCatalogLink(modelId: string, dto: CreateCatalogLinkDto, user: AuthUser): Promise<ModelCatalogLink> {
    await this.getModel(modelId);
    return this.links.save(
      this.links.create({
        productModelId: modelId,
        materialCatalogId: dto.materialCatalogId,
        linkType: dto.linkType ?? CatalogLinkType.PRIMARY,
        basisDocumentId: dto.basisDocumentId ?? null,
        status: ActiveStatus.ACTIVE,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // ---- Revisions ----
  async createRevision(modelId: string, dto: CreateRevisionDto, user: AuthUser): Promise<DesignRevision> {
    await this.getModel(modelId);
    const dup = await this.revisions.findOne({ where: { productModelId: modelId, revisionCode: dto.revisionCode } });
    if (dup) throw new ConflictException(`DATA-003: Revision ${dto.revisionCode} đã tồn tại cho mẫu này`);
    return this.revisions.save(
      this.revisions.create({
        productModelId: modelId,
        revisionCode: dto.revisionCode,
        changeSummary: dto.changeSummary ?? null,
        status: RevisionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async getRevision(id: string): Promise<DesignRevision> {
    const r = await this.revisions.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`DATA-001: Không có revision ${id}`);
    return r;
  }

  // Đổi trạng thái revision theo máy trạng thái (BR-DT03-007).
  async transitionRevision(id: string, to: RevisionStatus, user: AuthUser): Promise<DesignRevision> {
    const r = await this.getRevision(id);
    assertTransition(REVISION_TRANSITIONS, r.status, to);
    r.status = to;
    r.updatedBy = this.uid(user);
    return this.revisions.save(r);
  }

  // Công bố revision: VERIFIED → PUBLISHED; đời PUBLISHED trước của cùng mẫu → SUPERSEDED
  // và gắn supersedes (BR-DT03-014: tài sản lịch sử vẫn giữ đời cũ).
  async publishRevision(id: string, user: AuthUser): Promise<DesignRevision> {
    const r = await this.getRevision(id);
    assertTransition(REVISION_TRANSITIONS, r.status, RevisionStatus.PUBLISHED);
    const priors = await this.revisions.find({
      where: { productModelId: r.productModelId, status: RevisionStatus.PUBLISHED },
    });
    for (const p of priors) {
      p.status = RevisionStatus.SUPERSEDED;
      p.updatedBy = this.uid(user);
      await this.revisions.save(p);
      r.supersedesRevisionId = r.supersedesRevisionId ?? p.id;
    }
    r.status = RevisionStatus.PUBLISHED;
    r.publishedAt = new Date();
    r.updatedBy = this.uid(user);
    return this.revisions.save(r);
  }

  // So sánh thông số 2 revision (2016 ↔ K24).
  async compareRevisions(from: string, to: string) {
    const [a, b] = await Promise.all([
      this.attributes.find({ where: { revisionId: from } }),
      this.attributes.find({ where: { revisionId: to } }),
    ]);
    const am = new Map(a.map((x) => [x.attrName, x]));
    const bm = new Map(b.map((x) => [x.attrName, x]));
    const added: string[] = [];
    const removed: string[] = [];
    const changed: Array<{ attr: string; from: string | null; to: string | null }> = [];
    for (const name of bm.keys()) if (!am.has(name)) added.push(name);
    for (const [name, av] of am) {
      const bv = bm.get(name);
      if (!bv) { removed.push(name); continue; }
      if ((av.rawValue ?? null) !== (bv.rawValue ?? null)) changed.push({ attr: name, from: av.rawValue ?? null, to: bv.rawValue ?? null });
    }
    return { added, removed, changed };
  }

  // ---- Documents & sheets (BR-DT03-005: trùng hash → cảnh báo, không nhân bản) ----
  async addDocument(revisionId: string, dto: CreateDocumentDto, user: AuthUser) {
    await this.getRevision(revisionId);
    if (dto.fileHash) {
      const existing = await this.documents.find({ where: { revisionId } });
      if (isDuplicateHash(existing.map((d) => d.fileHash ?? ''), dto.fileHash)) {
        const dup = existing.find((d) => d.fileHash === dto.fileHash)!;
        return { duplicate: true, document: dup };
      }
    }
    const doc = await this.documents.save(
      this.documents.create({
        revisionId,
        documentType: dto.documentType,
        title: dto.title,
        fileId: dto.fileId ?? null,
        fileHash: dto.fileHash ?? null,
        sourceName: dto.sourceName ?? null,
        issueDate: dto.issueDate ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    return { duplicate: false, document: doc };
  }

  async addSheet(documentId: string, dto: CreateSheetDto, user: AuthUser): Promise<DrawingSheet> {
    const doc = await this.documents.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException(`DATA-001: Không có văn bản ${documentId}`);
    const sheet = await this.sheets.save(
      this.sheets.create({ technicalDocumentId: documentId, ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
    await this.documents.update(documentId, { totalSheets: (doc.totalSheets ?? 0) + 1 });
    return sheet;
  }

  // ---- Attributes + verification (BR-DT03-006) ----
  async addAttribute(revisionId: string, dto: CreateAttributeDto, user: AuthUser): Promise<TechnicalAttribute> {
    await this.getRevision(revisionId);
    return this.attributes.save(
      this.attributes.create({
        revisionId,
        attrName: dto.attrName,
        valueNumeric: dto.valueNumeric !== undefined ? String(dto.valueNumeric) : null,
        rawValue: dto.rawValue ?? null,
        rawUnit: dto.rawUnit ?? null,
        unitId: dto.unitId ?? null,
        sourceSheetId: dto.sourceSheetId ?? null,
        verificationStatus: TechVerificationStatus.DRAFT_EXTRACTED,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Xác minh một thực thể trích (technical_attribute…) → VERIFIED + ghi source_provenance.
  async verify(entityType: string, entityId: string, dto: VerifyDto, user: AuthUser) {
    if (entityType === 'technical_attribute') {
      const attr = await this.attributes.findOne({ where: { id: entityId } });
      if (!attr) throw new NotFoundException(`DATA-001: Không có thông số ${entityId}`);
      attr.verificationStatus = TechVerificationStatus.VERIFIED;
      attr.updatedBy = this.uid(user);
      await this.attributes.save(attr);
    }
    return this.provenance.save(
      this.provenance.create({
        entityType,
        entityId,
        sourceFile: dto.sourceFile ?? null,
        sourcePage: dto.sourcePage ?? null,
        extractionMethod: dto.extractionMethod ?? 'MANUAL',
        confidenceLevel: dto.confidenceLevel !== undefined ? String(dto.confidenceLevel) : null,
        verificationStatus: TechVerificationStatus.VERIFIED,
        verifiedBy: this.uid(user),
        verifiedAt: new Date(),
        createdBy: this.uid(user),
      }),
    );
  }

  // Dùng một thông số làm tiêu chí — chỉ khi đã VERIFIED (BR-DT03-006, TC-DT03-006).
  async useAttributeAsCriterion(attrId: string) {
    const attr = await this.attributes.findOne({ where: { id: attrId } });
    if (!attr) throw new NotFoundException(`DATA-001: Không có thông số ${attrId}`);
    assertVerifiedForCriterion(attr.verificationStatus);
    return { ok: true, attribute: attr };
  }

  // ---- BOM (BR-DT03-005) ----
  async createBom(revisionId: string, dto: CreateBomDto, user: AuthUser): Promise<BomHeader> {
    await this.getRevision(revisionId);
    return this.boms.save(this.boms.create({ revisionId, ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async addBomItem(bomId: string, dto: CreateBomItemDto, user: AuthUser): Promise<BomItem> {
    const bom = await this.boms.findOne({ where: { id: bomId } });
    if (!bom) throw new NotFoundException(`DATA-001: Không có BOM ${bomId}`);
    return this.bomItems.save(
      this.bomItems.create({
        bomHeaderId: bomId,
        lineNo: dto.lineNo ?? 0,
        groupName: dto.groupName ?? null,
        componentId: dto.componentId ?? null,
        rawName: dto.rawName,
        unitId: dto.unitId ?? null,
        quantity: dto.quantity !== undefined ? String(dto.quantity) : null,
        status: bomItemStatus(dto.componentId), // UNMAPPED nếu chưa ánh xạ.
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async exportBom(bomId: string) {
    const items = await this.bomItems.find({ where: { bomHeaderId: bomId }, order: { lineNo: 'ASC' } });
    const unmapped = items.filter((i) => i.status === 'UNMAPPED').length;
    return { bomId, itemCount: items.length, unmappedCount: unmapped, items };
  }

  // ---- Relationships (BR-DT03-013: không vòng lặp) ----
  async createRelationship(dto: CreateRelationshipDto, user: AuthUser): Promise<ModelRelationship> {
    if (dto.relationshipType === ModelRelationshipType.REPLACES) {
      const edges = (await this.relationships.find({ where: { relationshipType: ModelRelationshipType.REPLACES, status: ActiveStatus.ACTIVE } }))
        .map((r) => ({ source: r.sourceModelId, target: r.targetModelId }));
      assertNoRelationshipCycle(edges, dto.sourceModelId, dto.targetModelId);
    }
    return this.relationships.save(
      this.relationships.create({ ...dto, status: ActiveStatus.ACTIVE, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
  }

  // ---- Completeness ----
  async completeness(revisionId: string) {
    await this.getRevision(revisionId);
    const [docs, attrs, bomList] = await Promise.all([
      this.documents.count({ where: { revisionId } }),
      this.attributes.find({ where: { revisionId } }),
      this.boms.count({ where: { revisionId } }),
    ]);
    const sheetCount = docs > 0
      ? await this.sheets.count({ where: { technicalDocumentId: In((await this.documents.find({ where: { revisionId } })).map((d) => d.id)) } })
      : 0;
    const level = computeCompleteness({
      hasDrawing: sheetCount > 0 || docs > 0,
      hasSpecs: attrs.length > 0,
      hasBom: bomList > 0,
      hasDocument: docs > 0,
      allSpecsVerified: attrs.length > 0 && attrs.every((a) => a.verificationStatus === TechVerificationStatus.VERIFIED),
    });
    return {
      revisionId,
      level,
      counts: { documents: docs, sheets: sheetCount, attributes: attrs.length, boms: bomList },
      verifiedAttributes: attrs.filter((a) => a.verificationStatus === TechVerificationStatus.VERIFIED).length,
    };
  }
}
