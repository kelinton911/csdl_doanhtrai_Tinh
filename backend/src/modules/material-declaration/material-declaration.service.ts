import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MaterialDeclaration } from './entities/material-declaration.entity';
import { MaterialDeclarationLine } from './entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from './entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from './entities/declaration-amendment-request.entity';
import { DeclarationTemplate } from './entities/declaration-template.entity';
import { MaterialCatalog } from '../catalog/entities/material-catalog.entity';
import { InventoryService } from '../inventory/inventory.service';
import { MasterDataService } from '../master-data/master-data.service';
import { AdjustmentDto } from '../inventory/dto/inventory.dto';
import { MaterialAlias } from '../catalog/entities/material-alias.entity';
import {
  BulkLinesDto,
  CarryForwardDto,
  CreateAmendmentDto,
  CreateDeclarationDto,
  CreateLineDto,
  CreateTemplateDto,
  DuplicateDeclarationDto,
  ReviewDecisionDto,
  UpdateDeclarationDto,
  UpdateLineDto,
} from './dto/material-declaration.dto';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { assertReadScope, orgScopeWhere } from '../../common/scope/scope-query';
import { normalizeHeader, normalizeText, parseTabular } from '../../common/tabular';

// Khai báo vật chất (cấp xã / đơn vị trực thuộc Tỉnh). CRUD đầy đủ khi chưa duyệt;
// duyệt xong khóa; sửa sau duyệt qua đề nghị cấp trên (amendment). Tái dùng toolkit
// workflow-transition + data-scope theo đơn vị (SYS-BR-08).
@Injectable()
export class MaterialDeclarationService {
  constructor(
    @InjectRepository(MaterialDeclaration)
    private readonly repo: Repository<MaterialDeclaration>,
    @InjectRepository(MaterialDeclarationLine)
    private readonly lines: Repository<MaterialDeclarationLine>,
    @InjectRepository(MaterialDeclarationRevision)
    private readonly revisions: Repository<MaterialDeclarationRevision>,
    @InjectRepository(DeclarationAmendmentRequest)
    private readonly amendments: Repository<DeclarationAmendmentRequest>,
    @InjectRepository(MaterialCatalog)
    private readonly catalog: Repository<MaterialCatalog>,
    @InjectRepository(MaterialAlias)
    private readonly aliases: Repository<MaterialAlias>,
    @InjectRepository(DeclarationTemplate)
    private readonly templates: Repository<DeclarationTemplate>,
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly masterData: MasterDataService,
  ) {}

  // ---- P3 "Khai một lần": bản khai ĐÃ DUYỆT → đồng bộ số cuối kỳ vào tồn kho (stock_balances) ----
  // Mỗi dòng: bắc cầu material_catalog→materials rồi ĐIỀU CHỈNH tồn = cuối kỳ (có bút toán, idempotent).
  async syncToInventory(id: string, storageLocationId: string | undefined, user: AuthUser) {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    if (d.workflowStatus !== WorkflowStatus.APPROVED) {
      throw new ConflictException('KB-SYNC-01: Chỉ đồng bộ tồn kho khi bản khai đã DUYỆT.');
    }
    // Kho đích: tham số → kho gắn bản khai → kho đầu tiên của doanh trại.
    let locId = storageLocationId ?? d.storageLocationId ?? null;
    if (!locId && d.barracksId) {
      const rows = await this.dataSource.query(
        'SELECT id FROM storage_locations WHERE barracks_id = $1 ORDER BY code LIMIT 1',
        [d.barracksId],
      );
      locId = rows[0]?.id ?? null;
    }
    if (!locId) {
      throw new BadRequestException('KB-SYNC-02: Chưa xác định kho đích — chọn kho hoặc gắn kho/doanh trại cho bản khai.');
    }
    const lines = await this.lines.find({ where: { declarationId: id }, order: { sortOrder: 'ASC' } });
    let synced = 0;
    for (const l of lines) {
      const qty = Number(l.closingQty ?? l.quantity ?? 0);
      const material = await this.masterData.ensureMaterialFromCatalog(l.materialCatalogId, user);
      await this.inventory.adjustment(
        { materialId: material.id, storageLocationId: locId, countedQuantity: qty, note: `Đồng bộ từ bản khai ${d.code}` } as AdjustmentDto,
        user,
      );
      synced++;
    }
    return { synced, storageLocationId: locId };
  }

  // ---- Biểu mẫu định mức (bộ mã vật chất chuẩn dùng lại) ----
  async listTemplates() {
    return this.templates.find({ order: { name: 'ASC' } });
  }
  async createTemplate(dto: CreateTemplateDto, user: AuthUser): Promise<DeclarationTemplate> {
    return this.templates.save(
      this.templates.create({
        code: `TPL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: dto.name,
        note: dto.note ?? null,
        organizationId: user.organizationId ?? null,
        items: dto.items,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }
  async deleteTemplate(id: string): Promise<{ deleted: boolean }> {
    const t = await this.templates.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy biểu mẫu');
    await this.templates.delete(id);
    return { deleted: true };
  }

  // ---------- Bản khai báo ----------
  async list(user: AuthUser, barracksId?: string) {
    // orgScopeWhere: province-wide → {} (tất cả); ngược lại lọc theo organizationId.
    return this.repo.find({
      where: { ...orgScopeWhere(user), ...(barracksId ? { barracksId } : {}) },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
  }

  private async getEntity(id: string): Promise<MaterialDeclaration> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy bản khai báo');
    return d;
  }

  async get(id: string, user: AuthUser) {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    const lines = await this.lines.find({
      where: { declarationId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    // Bổ sung mã/tên CHUẨN (material_catalog) cho từng dòng để UI hiển thị tách bạch
    // tên chuẩn (liên thông TC HC-KT) với "tên gọi khác" do xã tự đặt (aliasUsed).
    const catIds = [...new Set(lines.map((l) => l.materialCatalogId).filter(Boolean))];
    const cats = catIds.length
      ? await this.catalog.find({ where: { id: In(catIds) }, select: { id: true, code: true, name: true } })
      : [];
    const catById = new Map(cats.map((c) => [c.id, c]));
    const enriched = lines.map((l) => {
      const c = catById.get(l.materialCatalogId);
      return { ...l, materialCode: c?.code ?? null, materialName: c?.name ?? null };
    });
    // Đối chiếu cảnh báo (không khóa cứng) trả kèm để UI hiển thị badge/banner.
    const warnings = enriched
      .map((l) => ({ lineId: l.id, messages: this.reconcileLine(l) }))
      .filter((w) => w.messages.length > 0);
    return { ...d, lines: enriched, warnings };
  }

  async create(dto: CreateDeclarationDto, user: AuthUser): Promise<MaterialDeclaration> {
    const code = dto.code ?? `KBVC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dup = await this.repo.findOne({ where: { code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã bản khai báo ${code}`);
    return this.repo.save(
      this.repo.create({
        code,
        title: dto.title,
        organizationId: dto.organizationId ?? user.organizationId ?? null,
        areaId: dto.areaId ?? null,
        storageLocationId: dto.storageLocationId ?? null,
        barracksId: dto.barracksId ?? null,
        periodLabel: dto.periodLabel ?? null,
        note: dto.note ?? null,
        workflowStatus: WorkflowStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async update(id: string, dto: UpdateDeclarationDto, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus);
    if (dto.title !== undefined) d.title = dto.title;
    if (dto.organizationId !== undefined) d.organizationId = dto.organizationId;
    if (dto.areaId !== undefined) d.areaId = dto.areaId;
    if (dto.storageLocationId !== undefined) d.storageLocationId = dto.storageLocationId;
    if (dto.periodLabel !== undefined) d.periodLabel = dto.periodLabel;
    if (dto.note !== undefined) d.note = dto.note;
    d.updatedBy = user.sub;
    return this.repo.save(d);
  }

  // Xóa chỉ khi DRAFT (chưa từng vào luồng duyệt) — bảo toàn dữ liệu đã trình/duyệt.
  async remove(id: string, user: AuthUser): Promise<{ deleted: true }> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    if (d.workflowStatus !== WorkflowStatus.DRAFT) {
      throw new ConflictException(
        `WF-001: Chỉ xóa bản khai báo ở trạng thái DRAFT (hiện ${d.workflowStatus})`,
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(MaterialDeclarationLine).delete({ declarationId: id });
      await m.getRepository(MaterialDeclaration).delete({ id });
    });
    return { deleted: true };
  }

  // ---------- Dòng vật chất ----------
  private async getEditableParent(declarationId: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus);
    return d;
  }

  async addLine(declarationId: string, dto: CreateLineDto, user: AuthUser): Promise<MaterialDeclarationLine> {
    await this.getEditableParent(declarationId, user);
    const line = this.lines.create(this.lineFields(dto, { declarationId, user }));
    this.finalizeLine(line, dto);
    return this.lines.save(line);
  }

  async updateLine(lineId: string, dto: UpdateLineDto, user: AuthUser): Promise<MaterialDeclarationLine> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('DATA-001: Không tìm thấy dòng khai báo');
    await this.getEditableParent(line.declarationId, user);
    Object.assign(line, this.lineFields(dto, { user }));
    this.finalizeLine(line, dto);
    line.updatedBy = user.sub;
    return this.lines.save(line);
  }

  // Lưu hàng loạt dòng (nhập dạng bảng / dán Excel) trong 1 giao dịch. `id` có = cập nhật,
  // không có = thêm mới; `deleteIds` xóa dòng (chỉ trong bản khai báo này).
  async bulkUpsertLines(declarationId: string, dto: BulkLinesDto, user: AuthUser) {
    await this.getEditableParent(declarationId, user);
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(MaterialDeclarationLine);
      if (dto.deleteIds?.length) {
        await repo.delete({ id: In(dto.deleteIds), declarationId });
      }
      for (const l of dto.lines ?? []) {
        if (l.id) {
          const existing = await repo.findOne({ where: { id: l.id, declarationId } });
          if (!existing) continue; // bỏ qua dòng lạ (không thuộc bản khai báo)
          Object.assign(existing, this.lineFields(l, { user }));
          this.finalizeLine(existing, l);
          existing.updatedBy = user.sub;
          await repo.save(existing);
        } else {
          const created = repo.create(this.lineFields(l, { declarationId, user }));
          this.finalizeLine(created, l);
          await repo.save(created);
        }
      }
    });
    return this.get(declarationId, user);
  }

  async deleteLine(lineId: string, user: AuthUser): Promise<{ deleted: true }> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('DATA-001: Không tìm thấy dòng khai báo');
    await this.getEditableParent(line.declarationId, user);
    await this.lines.delete({ id: lineId });
    return { deleted: true };
  }

  // Map DTO → cột (số lượng lưu dạng chuỗi numeric). Bỏ qua trường undefined khi cập nhật.
  private lineFields(
    dto: CreateLineDto | UpdateLineDto,
    ctx: { declarationId?: string; user: AuthUser },
  ): Partial<MaterialDeclarationLine> {
    const num = (v: number | undefined) => (v === undefined ? undefined : String(v));
    const out: Partial<MaterialDeclarationLine> = {
      materialCatalogId: dto.materialCatalogId,
      aliasUsed: dto.aliasUsed,
      unitId: dto.unitId,
      reservePurpose: dto.reservePurpose,
      quantity: num(dto.quantity),
      openingQty: num(dto.openingQty),
      increaseQty: num(dto.increaseQty),
      decreaseQty: num(dto.decreaseQty),
      closingQty: num(dto.closingQty),
      inUseQty: num(dto.inUseQty),
      ministryStoreQty: num(dto.ministryStoreQty),
      unitStoreQty: num(dto.unitStoreQty),
      openingValue: num(dto.openingValue),
      increaseValue: num(dto.increaseValue),
      decreaseValue: num(dto.decreaseValue),
      closingValue: num(dto.closingValue),
      convertedWeight: num(dto.convertedWeight),
      qtyGrade1: num(dto.qtyGrade1),
      qtyGrade2: num(dto.qtyGrade2),
      qtyGrade3: num(dto.qtyGrade3),
      qtyGrade4: num(dto.qtyGrade4),
      qtyGrade5: num(dto.qtyGrade5),
      unitPrice: num(dto.unitPrice),
      note: dto.note,
      sortOrder: dto.sortOrder,
    };
    if (ctx.declarationId) {
      out.declarationId = ctx.declarationId;
      out.createdBy = ctx.user.sub;
      out.updatedBy = ctx.user.sub;
    }
    // Loại bỏ khóa undefined để không ghi đè giá trị cũ khi PUT.
    (Object.keys(out) as Array<keyof MaterialDeclarationLine>).forEach((k) => {
      if (out[k] === undefined) delete out[k];
    });
    return out;
  }

  // Đồng bộ cuối kỳ ↔ số lượng: closingQty là nguồn sự thật, quantity giữ đồng bộ (tương thích ngược).
  // Ưu tiên closingQty client gửi; nếu chỉ gửi quantity (đường modal cũ) → dùng quantity;
  // còn lại tính = đầu kỳ + tăng − giảm.
  private finalizeLine(line: MaterialDeclarationLine, dto: Partial<CreateLineDto>): void {
    const n = (s: string | null | undefined) => Number(s ?? 0) || 0;
    let closing: number;
    if (dto.closingQty !== undefined) {
      closing = dto.closingQty;
    } else if (
      dto.quantity !== undefined &&
      dto.openingQty === undefined &&
      dto.increaseQty === undefined &&
      dto.decreaseQty === undefined
    ) {
      closing = dto.quantity;
    } else {
      closing = n(line.openingQty) + n(line.increaseQty) - n(line.decreaseQty);
    }
    line.closingQty = closing.toFixed(3);
    line.quantity = line.closingQty;
  }

  // Đối chiếu 02/KK — trả cảnh báo (không throw). Chỉ cảnh báo khi có dữ liệu tương ứng.
  reconcileLine(line: MaterialDeclarationLine): string[] {
    const n = (s: string | null | undefined) => Number(s ?? 0) || 0;
    const w: string[] = [];
    const closing = n(line.closingQty);
    const computed = n(line.openingQty) + n(line.increaseQty) - n(line.decreaseQty);
    if ((n(line.openingQty) || n(line.increaseQty) || n(line.decreaseQty)) && Math.abs(closing - computed) > 0.001) {
      w.push(`Cuối kỳ (${closing}) ≠ đầu kỳ + tăng − giảm (${computed})`);
    }
    const loc = n(line.inUseQty) + n(line.ministryStoreQty) + n(line.unitStoreQty);
    if (loc > 0 && Math.abs(loc - closing) > 0.001) {
      w.push(`Tổng vị trí kho (${loc}) ≠ cuối kỳ (${closing})`);
    }
    const grades =
      n(line.qtyGrade1) + n(line.qtyGrade2) + n(line.qtyGrade3) + n(line.qtyGrade4) + n(line.qtyGrade5);
    if (grades > 0 && Math.abs(grades - closing) > 0.001) {
      w.push(`Tổng chất lượng C1–C5 (${grades}) ≠ cuối kỳ (${closing})`);
    }
    return w;
  }

  // Copy các trường số/text của 1 dòng (dùng cho nhân bản/kế thừa).
  private copyLineValues(s: MaterialDeclarationLine): Partial<MaterialDeclarationLine> {
    return {
      materialCatalogId: s.materialCatalogId,
      aliasUsed: s.aliasUsed,
      unitId: s.unitId,
      reservePurpose: s.reservePurpose,
      quantity: s.quantity,
      openingQty: s.openingQty,
      increaseQty: s.increaseQty,
      decreaseQty: s.decreaseQty,
      closingQty: s.closingQty,
      inUseQty: s.inUseQty,
      ministryStoreQty: s.ministryStoreQty,
      unitStoreQty: s.unitStoreQty,
      openingValue: s.openingValue,
      increaseValue: s.increaseValue,
      decreaseValue: s.decreaseValue,
      closingValue: s.closingValue,
      convertedWeight: s.convertedWeight,
      qtyGrade1: s.qtyGrade1,
      qtyGrade2: s.qtyGrade2,
      qtyGrade3: s.qtyGrade3,
      qtyGrade4: s.qtyGrade4,
      qtyGrade5: s.qtyGrade5,
      unitPrice: s.unitPrice,
      note: s.note,
    };
  }

  // ---------- Kế thừa kỳ trước / Nhân bản ----------
  // Nạp dòng từ bản khai báo nguồn (nên đã DUYỆT): đầu kỳ = cuối kỳ nguồn; tăng/giảm = 0.
  async carryForward(targetId: string, dto: CarryForwardDto, user: AuthUser) {
    await this.getEditableParent(targetId, user);
    const source = await this.getEntity(dto.sourceDeclarationId);
    assertReadScope(undefined, source.organizationId, user);
    const srcLines = await this.lines.find({
      where: { declarationId: source.id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(MaterialDeclarationLine);
      let order = await repo.count({ where: { declarationId: targetId } });
      for (const s of srcLines) {
        const opening = s.closingQty ?? s.quantity ?? '0';
        await repo.save(
          repo.create({
            declarationId: targetId,
            materialCatalogId: s.materialCatalogId,
            aliasUsed: s.aliasUsed,
            unitId: s.unitId,
            reservePurpose: s.reservePurpose,
            openingQty: opening,
            increaseQty: '0',
            decreaseQty: '0',
            closingQty: opening,
            quantity: opening,
            inUseQty: s.inUseQty,
            ministryStoreQty: s.ministryStoreQty,
            unitStoreQty: s.unitStoreQty,
            qtyGrade1: s.qtyGrade1,
            qtyGrade2: s.qtyGrade2,
            qtyGrade3: s.qtyGrade3,
            qtyGrade4: s.qtyGrade4,
            qtyGrade5: s.qtyGrade5,
            unitPrice: s.unitPrice,
            sortOrder: order++,
            createdBy: user.sub,
            updatedBy: user.sub,
          }),
        );
      }
    });
    return this.get(targetId, user);
  }

  // Nhân bản: tạo bản DRAFT mới + copy toàn bộ dòng.
  async duplicate(id: string, dto: DuplicateDeclarationDto, user: AuthUser): Promise<MaterialDeclaration> {
    const src = await this.getEntity(id);
    assertReadScope(undefined, src.organizationId, user);
    const srcLines = await this.lines.find({
      where: { declarationId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return this.dataSource.transaction(async (m) => {
      const dRepo = m.getRepository(MaterialDeclaration);
      const lRepo = m.getRepository(MaterialDeclarationLine);
      const decl = await dRepo.save(
        dRepo.create({
          code: `KBVC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: dto.title,
          organizationId: dto.organizationId ?? src.organizationId,
          areaId: src.areaId,
          storageLocationId: src.storageLocationId,
          barracksId: src.barracksId,
          periodLabel: dto.periodLabel ?? null,
          note: src.note,
          workflowStatus: WorkflowStatus.DRAFT,
          createdBy: user.sub,
          updatedBy: user.sub,
        }),
      );
      let order = 0;
      for (const s of srcLines) {
        await lRepo.save(
          lRepo.create({
            ...this.copyLineValues(s),
            declarationId: decl.id,
            sortOrder: order++,
            createdBy: user.sub,
            updatedBy: user.sub,
          }),
        );
      }
      return decl;
    });
  }

  // ---------- Import Excel/CSV (dán/khớp danh mục chuẩn) ----------
  // dryRun=true: chỉ soát lỗi (không ghi). dryRun=false: ghi các dòng hợp lệ (bỏ dòng lỗi).
  async importLines(
    declarationId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
    dryRun: boolean,
    user: AuthUser,
  ) {
    await this.getEditableParent(declarationId, user);
    if (!file) throw new BadRequestException('VAL-001: Thiếu tệp nhập');
    const { headers, rows } = await parseTabular(file);
    if (headers.length === 0) throw new BadRequestException('VAL-001: Tệp rỗng hoặc không đọc được');

    // Bản đồ khớp danh mục chuẩn: theo mã, theo tên (chuẩn hóa), theo alias (chuẩn hóa).
    const cats = await this.catalog.find({ select: { id: true, code: true, name: true, status: true } });
    const byCode = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const c of cats) {
      if (c.status && String(c.status) !== 'ACTIVE') continue;
      byCode.set(c.code.trim().toLowerCase(), c.id);
      byName.set(normalizeText(c.name), c.id);
    }
    const byAlias = new Map<string, string>();
    for (const a of await this.aliases.find({ select: { materialCatalogId: true, aliasNormalized: true } })) {
      if (a.aliasNormalized) byAlias.set(a.aliasNormalized, a.materialCatalogId);
    }

    const H = headers.map((h) => normalizeHeader(h));
    const col = (row: string[], ...names: string[]) => {
      for (const nm of names) {
        const i = H.indexOf(nm);
        if (i >= 0) return (row[i] ?? '').trim();
      }
      return '';
    };
    const errors: Array<{ row: number; column?: string; message: string }> = [];
    // Mỗi mục staged giữ rowNo để lọc dòng lỗi chính xác (dòng skip không lệch chỉ số).
    const staged: Array<{ rowNo: number; dto: Partial<CreateLineDto> & { materialCatalogId: string } }> = [];

    rows.forEach((row, i) => {
      const rowNo = i + 2;
      const codeRaw = col(row, 'materialcode', 'code', 'ma', 'mavatchat');
      const nameRaw = col(row, 'materialname', 'name', 'ten', 'tenvatchat', 'danhmuc');
      const catId =
        (codeRaw && byCode.get(codeRaw.trim().toLowerCase())) ||
        (nameRaw && byName.get(normalizeText(nameRaw))) ||
        (nameRaw && byAlias.get(normalizeText(nameRaw))) ||
        undefined;
      if (!catId) {
        errors.push({ row: rowNo, column: 'materialCode', message: `Không khớp danh mục chuẩn: "${codeRaw || nameRaw}"` });
        return;
      }
      const numCol = (...names: string[]): number | undefined => {
        const raw = col(row, ...names);
        if (raw === '') return undefined;
        const v = Number(raw.replace(/,/g, ''));
        if (Number.isNaN(v)) { errors.push({ row: rowNo, column: names[0], message: `"${raw}" không phải số` }); return undefined; }
        return v;
      };
      const dto: Partial<CreateLineDto> & { materialCatalogId: string } = {
        materialCatalogId: catId,
        aliasUsed: nameRaw || undefined,
        reservePurpose: (col(row, 'reservepurpose', 'mucdich') || undefined) as CreateLineDto['reservePurpose'],
        openingQty: numCol('openingqty', 'dauky', 'tondauky'),
        increaseQty: numCol('increaseqty', 'tang'),
        decreaseQty: numCol('decreaseqty', 'giam'),
        closingQty: numCol('closingqty', 'cuoiky', 'toncuoiky', 'soluong', 'quantity'),
        inUseQty: numCol('inuseqty', 'dangsudung'),
        ministryStoreQty: numCol('ministrystoreqty', 'khobonganh'),
        unitStoreQty: numCol('unitstoreqty', 'khodonvi'),
        qtyGrade1: numCol('grade1', 'qtygrade1', 'c1', 'cap1'),
        qtyGrade2: numCol('grade2', 'qtygrade2', 'c2', 'cap2'),
        qtyGrade3: numCol('grade3', 'qtygrade3', 'c3', 'cap3'),
        qtyGrade4: numCol('grade4', 'qtygrade4', 'c4', 'cap4'),
        qtyGrade5: numCol('grade5', 'qtygrade5', 'c5', 'cap5'),
        unitPrice: numCol('unitprice', 'dongia'),
        note: col(row, 'note', 'ghichu') || undefined,
      };
      staged.push({ rowNo, dto });
    });

    const errorRowNos = new Set(errors.map((e) => e.row));
    const valid = staged.filter((s) => !errorRowNos.has(s.rowNo)).map((s) => s.dto);
    const summary = {
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: rows.length - valid.length,
      errors,
      committed: 0,
    };
    if (dryRun || valid.length === 0) return summary;

    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(MaterialDeclarationLine);
      let order = await repo.count({ where: { declarationId } });
      for (const dtoLine of valid) {
        const line = repo.create(this.lineFields(dtoLine as CreateLineDto, { declarationId, user }));
        line.sortOrder = order++;
        this.finalizeLine(line, dtoLine);
        await repo.save(line);
      }
    });
    summary.committed = valid.length;
    return summary;
  }

  // ---------- Workflow duyệt ----------
  async submit(id: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus, 'gửi duyệt');
    return this.transition(d, WorkflowStatus.PENDING_REVIEW, user);
  }

  async approve(id: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertPendingReview(d.workflowStatus);
    assertNotSelfApprove(d.createdBy, user.sub);
    d.lockedAt = new Date();
    d.lockedBy = user.sub;
    const saved = await this.transition(d, WorkflowStatus.APPROVED, user);
    // Khai một lần: nếu bản khai đã gắn kho → tự đồng bộ tồn (best-effort, không chặn duyệt).
    if (d.storageLocationId) {
      try {
        await this.syncToInventory(id, d.storageLocationId, user);
      } catch {
        /* không chặn duyệt nếu đồng bộ lỗi — người dùng có thể đồng bộ lại thủ công */
      }
    }
    return saved;
  }

  async requestChanges(id: string, _dto: ReviewDecisionDto, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertPendingReview(d.workflowStatus, 'yêu cầu bổ sung');
    d.lockedAt = null;
    d.lockedBy = null;
    return this.transition(d, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  async listRevisions(id: string, user: AuthUser): Promise<MaterialDeclarationRevision[]> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    return this.revisions.find({ where: { declarationId: id }, order: { revisionNo: 'DESC' } });
  }

  private transition(d: MaterialDeclaration, to: WorkflowStatus, user: AuthUser): Promise<MaterialDeclaration> {
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: MaterialDeclaration,
        revisionTarget: MaterialDeclarationRevision,
        fkColumn: 'declarationId',
        buildPayload: (saved) => ({
          code: saved.code,
          title: saved.title,
          organizationId: saved.organizationId,
          areaId: saved.areaId,
          periodLabel: saved.periodLabel,
        }),
      },
      d,
      to,
      user.sub,
    );
  }

  // ---------- Đề nghị sửa sau duyệt ----------
  async createAmendment(declarationId: string, dto: CreateAmendmentDto, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    if (d.workflowStatus !== WorkflowStatus.APPROVED) {
      throw new ConflictException('WF-001: Chỉ đề nghị sửa bản khai báo đã DUYỆT (APPROVED)');
    }
    return this.amendments.save(
      this.amendments.create({
        requestCode: `AMR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        declarationId,
        organizationId: d.organizationId,
        requestedChanges: dto.requestedChanges,
        reason: dto.reason,
        evidenceDocumentIds: dto.evidenceDocumentIds ?? [],
        status: WorkflowStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async listAmendments(declarationId: string, user: AuthUser): Promise<DeclarationAmendmentRequest[]> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    return this.amendments.find({ where: { declarationId }, order: { createdAt: 'DESC' } });
  }

  private async getAmendment(id: string): Promise<DeclarationAmendmentRequest> {
    const a = await this.amendments.findOne({ where: { id } });
    if (!a) throw new NotFoundException('DATA-001: Không tìm thấy đề nghị sửa');
    return a;
  }

  async submitAmendment(id: string, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertReadScope(undefined, a.organizationId, user);
    assertEditable(a.status, 'gửi duyệt');
    a.status = WorkflowStatus.PENDING_REVIEW;
    a.submittedBy = user.sub;
    a.submittedAt = new Date();
    a.updatedBy = user.sub;
    return this.amendments.save(a);
  }

  // Duyệt đề nghị → mở khóa bản khai báo về CHANGES_REQUESTED để đơn vị tự sửa.
  async approveAmendment(id: string, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertPendingReview(a.status);
    assertNotSelfApprove(a.submittedBy, user.sub);
    a.status = WorkflowStatus.APPROVED;
    a.reviewedBy = user.sub;
    a.reviewedAt = new Date();
    a.updatedBy = user.sub;
    const saved = await this.amendments.save(a);
    // Mở khóa bản khai báo (chỉ khi đang APPROVED) để đơn vị chỉnh sửa.
    const d = await this.getEntity(a.declarationId);
    if (d.workflowStatus === WorkflowStatus.APPROVED) {
      d.lockedAt = null;
      d.lockedBy = null;
      await this.transition(d, WorkflowStatus.CHANGES_REQUESTED, user);
    }
    return saved;
  }

  async rejectAmendment(id: string, dto: ReviewDecisionDto, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertPendingReview(a.status, 'từ chối');
    a.status = WorkflowStatus.REJECTED;
    a.reviewedBy = user.sub;
    a.reviewedAt = new Date();
    a.reviewNote = dto.note ?? null;
    a.updatedBy = user.sub;
    return this.amendments.save(a);
  }
}
