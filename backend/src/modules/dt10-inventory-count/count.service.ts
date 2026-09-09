import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { applyJsonOrgScope, assertReadScope } from '../../common/scope/scope-query';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { assertTransition } from '../../common/enums/assert-transition';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import { resolveAsOf } from '../../common/time/as-of';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { MovementStatus } from '../dt04-materiel/materiel-rules';
import { StockQualityDetail } from '../inventory/entities/stock-quality-detail.entity';
import { DocumentsService } from '../dt05-documents/documents.service';
import { InventoryDocumentType } from '../dt05-documents/dt05.enums';
import { DocumentStatus } from '../../common/enums';
import { InventoryCountCampaign } from './entities/inventory-count-campaign.entity';
import { BookSnapshot, BookSnapshotLine } from './entities/book-snapshot.entity';
import { CountSheet, CountLine } from './entities/count-sheet.entity';
import { RecountRound } from './entities/recount-round.entity';
import { CountVariance } from './entities/count-variance.entity';
import { CountQualityGrade } from './entities/count-quality-grade.entity';
import {
  OfficialSnapshot,
  OfficialSnapshotLine,
  OfficialLock,
} from './entities/official-snapshot.entity';
import { CountAdjustmentRequest } from './entities/count-adjustment-request.entity';
import { ReportDataset } from './entities/report-dataset.entity';
import {
  CAMPAIGN_TRANSITIONS,
  CampaignStatus,
  CountAdjustmentStatus,
  SHEET_TRANSITIONS,
  SheetStatus,
  VarianceStatus,
  VarianceType,
} from './dt10.enums';
import {
  assertQualityTotal,
  bookSnapshotChecksum,
  classifyVariance,
  officialSnapshotChecksum,
} from './count-rules';
import {
  BuildDatasetDto,
  CreateAdjustmentDto,
  CreateCampaignDto,
  CreateSheetDto,
  CampaignQuery,
  CutoffDto,
  QualityGradesDto,
  RecountDto,
  ResolveVarianceDto,
  ReviseDto,
  UnlockDto,
  UpdateSheetLinesDto,
} from './dto/dt10.dto';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X §XVI). Ba lớp độc lập Book/Physical/Official; blind count;
// recount vòng mới; official_snapshot khóa bất biến; điều chỉnh → DT-05 (KHÔNG sửa số dư trực tiếp).
@Injectable()
export class CountService {
  constructor(
    @InjectRepository(InventoryCountCampaign) private readonly campaigns: Repository<InventoryCountCampaign>,
    @InjectRepository(BookSnapshot) private readonly bookSnaps: Repository<BookSnapshot>,
    @InjectRepository(BookSnapshotLine) private readonly bookLines: Repository<BookSnapshotLine>,
    @InjectRepository(CountSheet) private readonly sheets: Repository<CountSheet>,
    @InjectRepository(CountLine) private readonly countLines: Repository<CountLine>,
    @InjectRepository(RecountRound) private readonly rounds: Repository<RecountRound>,
    @InjectRepository(CountVariance) private readonly variances: Repository<CountVariance>,
    @InjectRepository(CountQualityGrade) private readonly qualities: Repository<CountQualityGrade>,
    @InjectRepository(OfficialSnapshot) private readonly officialSnaps: Repository<OfficialSnapshot>,
    @InjectRepository(OfficialSnapshotLine) private readonly officialLines: Repository<OfficialSnapshotLine>,
    @InjectRepository(OfficialLock) private readonly locks: Repository<OfficialLock>,
    @InjectRepository(CountAdjustmentRequest) private readonly adjustments: Repository<CountAdjustmentRequest>,
    @InjectRepository(ReportDataset) private readonly datasets: Repository<ReportDataset>,
    @InjectRepository(MaterielMovement) private readonly movements: Repository<MaterielMovement>,
    @InjectRepository(StockQualityDetail) private readonly stockQuality: Repository<StockQualityDetail>,
    private readonly documents: DocumentsService,
    private readonly dataSource: DataSource,
  ) {}

  private uid(user: AuthUser): string | null {
    return user?.sub ?? null;
  }

  private key(materialCatalogId: string, lotId?: string | null): string {
    return `${materialCatalogId}|${lotId ?? ''}`;
  }

  // ---- Campaign ----
  async createCampaign(dto: CreateCampaignDto, user: AuthUser): Promise<InventoryCountCampaign> {
    const dup = await this.campaigns.findOne({ where: { campaignCode: dto.campaignCode } });
    if (dup) throw new ConflictException(`DATA-003: Đợt kiểm kê ${dto.campaignCode} đã tồn tại`);
    return this.campaigns.save(
      this.campaigns.create({
        campaignCode: dto.campaignCode,
        name: dto.name,
        countType: dto.countType ?? undefined,
        scopeJson: dto.scopeJson ?? {},
        status: CampaignStatus.DRAFT,
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async listCampaigns(q: CampaignQuery, user?: AuthUser) {
    const qb = this.campaigns.createQueryBuilder('c').orderBy('c.created_at', 'DESC');
    if (q.status) qb.andWhere('c.status = :st', { st: q.status });
    applyJsonOrgScope(qb, 'c', user); // SYS-BR-08: org trong scope_json
    const [data, total] = await qb.skip(q.skip).take(q.size).getManyAndCount();
    return paginated(data, total, q);
  }

  async getCampaign(id: string, user?: AuthUser): Promise<InventoryCountCampaign> {
    const c = await this.campaigns.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`DATA-001: Không có đợt kiểm kê ${id}`);
    assertReadScope(undefined, ((c.scopeJson as Record<string, unknown>)?.organizationId as string) ?? null, user);
    return c;
  }

  private async transitionCampaign(c: InventoryCountCampaign, to: CampaignStatus, user: AuthUser) {
    assertTransition(CAMPAIGN_TRANSITIONS, c.status, to);
    c.status = to;
    c.updatedBy = this.uid(user);
    return this.campaigns.save(c);
  }

  // ---- Cutoff + Book snapshot (lớp BOOK, BR-DT10-002/003) ----
  async cutoff(id: string, dto: CutoffDto, user: AuthUser): Promise<InventoryCountCampaign> {
    const c = await this.getCampaign(id);
    if (c.cutoffTime) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Đã chốt cutoff, không đặt lại');
    }
    c.cutoffTime = resolveAsOf(dto.cutoffTime);
    await this.campaigns.save(c);
    return this.transitionCampaign(c, CampaignStatus.CUTOFF, user);
  }

  // Dựng book_snapshot bất biến từ sổ cái DT-04 tại cutoff + chất lượng C1–5 (module inventory).
  async buildBookSnapshot(id: string, user: AuthUser): Promise<{ snapshot: BookSnapshot; lineCount: number }> {
    const c = await this.getCampaign(id);
    if (!c.cutoffTime) {
      throw new ConflictException('DATA-003: Chưa chốt cutoff — không dựng được book_snapshot');
    }
    const existing = await this.bookSnaps.findOne({ where: { campaignId: id } });
    if (existing?.locked) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'book_snapshot đã khóa (bất biến)');
    }
    const asOf = c.cutoffTime;
    const org = (c.scopeJson as { organizationId?: string } | null)?.organizationId;

    // Σ quantity_signed của movement POSTED & effective_time ≤ cutoff, theo material+lot+org.
    const rows = await this.movements
      .createQueryBuilder('m')
      .select('m.material_catalog_id', 'materialCatalogId')
      .addSelect('m.lot_id', 'lotId')
      .addSelect('m.organization_id', 'organizationId')
      .addSelect('COALESCE(SUM(m.quantity_signed),0)', 'qty')
      .where('m.status = :posted', { posted: MovementStatus.POSTED })
      .andWhere('m.effective_time <= :asOf', { asOf })
      .andWhere(org ? 'm.organization_id = :org' : '1=1', org ? { org } : {})
      .groupBy('m.material_catalog_id')
      .addGroupBy('m.lot_id')
      .addGroupBy('m.organization_id')
      .getRawMany<{ materialCatalogId: string; lotId: string | null; organizationId: string; qty: string }>();

    // Chất lượng C1–5 tại cutoff: gộp theo material (module inventory keyed material×location).
    const gradesByMaterial = await this.gradesByMaterial(org);

    const assignedGrades = new Set<string>();
    const lineData = rows
      .filter((r) => Number(r.qty) !== 0)
      .map((r) => {
        const g = !assignedGrades.has(r.materialCatalogId) ? gradesByMaterial.get(r.materialCatalogId) : undefined;
        if (g) assignedGrades.add(r.materialCatalogId);
        return {
          materialCatalogId: r.materialCatalogId,
          lotId: r.lotId,
          locationId: null as string | null,
          organizationId: r.organizationId,
          bookQty: Number(r.qty),
          grade1: g?.g1 ?? 0,
          grade2: g?.g2 ?? 0,
          grade3: g?.g3 ?? 0,
          grade4: g?.g4 ?? 0,
          grade5: g?.g5 ?? 0,
          value: g?.value ?? null,
        };
      });

    const checksum = bookSnapshotChecksum(
      lineData.map((l) => ({ ...l, qty: l.bookQty })),
      asOf,
    );

    return this.dataSource.transaction(async (mgr) => {
      const snapRepo = mgr.getRepository(BookSnapshot);
      const lineRepo = mgr.getRepository(BookSnapshotLine);
      if (existing) {
        await lineRepo.delete({ snapshotId: existing.id });
        await snapRepo.delete({ id: existing.id });
      }
      const snap = await snapRepo.save(
        snapRepo.create({
          campaignId: id,
          asOf,
          checksum,
          locked: true, // BẤT BIẾN ngay khi dựng.
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      for (const l of lineData) {
        await lineRepo.save(
          lineRepo.create({
            snapshotId: snap.id,
            materialCatalogId: l.materialCatalogId,
            lotId: l.lotId,
            locationId: l.locationId,
            organizationId: l.organizationId,
            bookQty: String(l.bookQty),
            grade1: String(l.grade1),
            grade2: String(l.grade2),
            grade3: String(l.grade3),
            grade4: String(l.grade4),
            grade5: String(l.grade5),
            value: l.value != null ? String(l.value) : null,
          }),
        );
      }
      // Sau khi dựng book_snapshot → mở giai đoạn kiểm đếm.
      const fresh = await mgr.getRepository(InventoryCountCampaign).findOneByOrFail({ id });
      if (fresh.status === CampaignStatus.CUTOFF) {
        fresh.status = CampaignStatus.COUNTING;
        fresh.updatedBy = this.uid(user);
        await mgr.getRepository(InventoryCountCampaign).save(fresh);
      }
      return { snapshot: snap, lineCount: lineData.length };
    });
  }

  private async gradesByMaterial(org?: string) {
    const qb = this.stockQuality
      .createQueryBuilder('q')
      .select('q.material_id', 'materialId')
      .addSelect('COALESCE(SUM(q.qty_grade_1),0)', 'g1')
      .addSelect('COALESCE(SUM(q.qty_grade_2),0)', 'g2')
      .addSelect('COALESCE(SUM(q.qty_grade_3),0)', 'g3')
      .addSelect('COALESCE(SUM(q.qty_grade_4),0)', 'g4')
      .addSelect('COALESCE(SUM(q.qty_grade_5),0)', 'g5')
      .addSelect('MAX(q.unit_price)', 'unitPrice')
      .groupBy('q.material_id');
    const rows = await qb.getRawMany<{
      materialId: string; g1: string; g2: string; g3: string; g4: string; g5: string; unitPrice: string | null;
    }>();
    const map = new Map<string, { g1: number; g2: number; g3: number; g4: number; g5: number; value: number | null }>();
    for (const r of rows) {
      const total = Number(r.g1) + Number(r.g2) + Number(r.g3) + Number(r.g4) + Number(r.g5);
      map.set(r.materialId, {
        g1: Number(r.g1), g2: Number(r.g2), g3: Number(r.g3), g4: Number(r.g4), g5: Number(r.g5),
        value: r.unitPrice != null ? Number(r.unitPrice) * total : null,
      });
    }
    return map;
  }

  async getBookSnapshot(campaignId: string) {
    const snap = await this.bookSnaps.findOne({ where: { campaignId } });
    if (!snap) throw new NotFoundException('DATA-001: Chưa dựng book_snapshot');
    const lines = await this.bookLines.find({ where: { snapshotId: snap.id } });
    return { snapshot: snap, lines };
  }

  // ---- Count sheets (lớp PHYSICAL, blind) ----
  async createSheet(campaignId: string, dto: CreateSheetDto, user: AuthUser): Promise<CountSheet> {
    await this.getCampaign(campaignId);
    const sheet = await this.sheets.save(
      this.sheets.create({
        campaignId,
        organizationId: dto.organizationId ?? null,
        locationId: dto.locationId ?? null,
        assignee: dto.assignee ?? null,
        currentRound: 1,
        status: SheetStatus.DRAFT,
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    await this.rounds.save(
      this.rounds.create({ countSheetId: sheet.id, roundNo: 1, reason: 'Vòng đầu', createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
    return sheet;
  }

  private async getSheet(id: string): Promise<CountSheet> {
    const s = await this.sheets.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`DATA-001: Không có phiếu kiểm đếm ${id}`);
    return s;
  }

  // Autosave: thay dòng của VÒNG HIỆN TẠI (blind — không đụng book, giữ nguyên vòng trước).
  async updateSheetLines(id: string, dto: UpdateSheetLinesDto, user: AuthUser): Promise<{ sheet: CountSheet; lineCount: number }> {
    const sheet = await this.getSheet(id);
    if (sheet.status !== SheetStatus.DRAFT && sheet.status !== SheetStatus.NEEDS_REVISION) {
      throw new ConflictException('DATA-003: Chỉ sửa dòng khi phiếu ở DRAFT/NEEDS_REVISION');
    }
    return this.dataSource.transaction(async (mgr) => {
      const lineRepo = mgr.getRepository(CountLine);
      await lineRepo.delete({ sheetId: id, roundNo: sheet.currentRound });
      for (const l of dto.lines) {
        await lineRepo.save(
          lineRepo.create({
            sheetId: id,
            roundNo: sheet.currentRound,
            materialCatalogId: l.materialCatalogId,
            lotId: l.lotId ?? null,
            locationId: l.locationId ?? null,
            physicalQty: String(l.physicalQty),
            note: l.note ?? null,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        );
      }
      return { sheet, lineCount: dto.lines.length };
    });
  }

  async submitSheet(id: string, user: AuthUser): Promise<CountSheet> {
    const sheet = await this.getSheet(id);
    const count = await this.countLines.count({ where: { sheetId: id, roundNo: sheet.currentRound } });
    if (count === 0) throw new ConflictException('DATA-003: Phiếu rỗng — không được gửi');
    assertTransition(SHEET_TRANSITIONS, sheet.status, SheetStatus.SUBMITTED);
    sheet.status = SheetStatus.SUBMITTED;
    sheet.submittedAt = new Date();
    sheet.updatedBy = this.uid(user);
    return this.sheets.save(sheet);
  }

  async approveSheet(id: string, user: AuthUser): Promise<CountSheet> {
    const sheet = await this.getSheet(id);
    assertTransition(SHEET_TRANSITIONS, sheet.status, SheetStatus.APPROVED);
    sheet.status = SheetStatus.APPROVED;
    sheet.updatedBy = this.uid(user);
    return this.sheets.save(sheet);
  }

  // Recount = vòng MỚI (BR-DT10-008): giữ nguyên dòng vòng trước, mở lại phiếu để đếm lại.
  async recount(id: string, dto: RecountDto, user: AuthUser): Promise<{ sheet: CountSheet; round: RecountRound }> {
    const sheet = await this.getSheet(id);
    if (sheet.status === SheetStatus.DRAFT) {
      throw new ConflictException('DATA-003: Phiếu chưa gửi vòng nào — chưa cần recount');
    }
    const nextRound = sheet.currentRound + 1;
    const round = await this.rounds.save(
      this.rounds.create({
        countSheetId: id,
        roundNo: nextRound,
        reason: dto.reason ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    sheet.currentRound = nextRound;
    sheet.status = SheetStatus.DRAFT; // mở lại để nhập vòng mới; dòng vòng cũ vẫn còn (round_no cũ).
    sheet.submittedAt = null;
    sheet.updatedBy = this.uid(user);
    await this.sheets.save(sheet);
    return { sheet, round };
  }

  async listSheets(campaignId: string) {
    return this.sheets.find({ where: { campaignId }, order: { createdAt: 'ASC' } });
  }

  async getSheetDetail(id: string) {
    const sheet = await this.getSheet(id);
    const lines = await this.countLines.find({ where: { sheetId: id }, order: { roundNo: 'ASC' } });
    const rounds = await this.rounds.find({ where: { countSheetId: id }, order: { roundNo: 'ASC' } });
    return { sheet, lines, rounds };
  }

  // ---- Kiểm kê chất lượng C1–5 (BR-DT10-009) ----
  async saveQualityGrades(countLineId: string, dto: QualityGradesDto, user: AuthUser): Promise<CountQualityGrade> {
    const line = await this.countLines.findOne({ where: { id: countLineId } });
    if (!line) throw new NotFoundException(`DATA-001: Không có dòng kiểm đếm ${countLineId}`);
    assertQualityTotal([dto.grade1, dto.grade2, dto.grade3, dto.grade4, dto.grade5], Number(line.physicalQty));
    const existing = await this.qualities.findOne({ where: { countLineId } });
    const entity = existing ?? this.qualities.create({ countLineId, createdBy: this.uid(user) });
    entity.grade1 = String(dto.grade1);
    entity.grade2 = String(dto.grade2);
    entity.grade3 = String(dto.grade3);
    entity.grade4 = String(dto.grade4);
    entity.grade5 = String(dto.grade5);
    entity.note = dto.note ?? null;
    entity.updatedBy = this.uid(user);
    return this.qualities.save(entity);
  }

  // ---- Đối chiếu Book ↔ Physical → variance (BR-DT10-013..015) ----
  private async aggregatePhysical(campaignId: string): Promise<Map<string, { qty: number; materialCatalogId: string; lotId: string | null; locationId: string | null }>> {
    const sheets = await this.sheets.find({ where: { campaignId } });
    const counted = sheets.filter((s) => s.status === SheetStatus.SUBMITTED || s.status === SheetStatus.APPROVED);
    const map = new Map<string, { qty: number; materialCatalogId: string; lotId: string | null; locationId: string | null }>();
    for (const s of counted) {
      const lines = await this.countLines.find({ where: { sheetId: s.id, roundNo: s.currentRound } });
      for (const l of lines) {
        const k = this.key(l.materialCatalogId, l.lotId);
        const prev = map.get(k);
        const qty = Number(l.physicalQty);
        if (prev) prev.qty += qty;
        else map.set(k, { qty, materialCatalogId: l.materialCatalogId, lotId: l.lotId, locationId: l.locationId });
      }
    }
    return map;
  }

  async computeVariances(campaignId: string, user: AuthUser): Promise<CountVariance[]> {
    const c = await this.getCampaign(campaignId);
    const { lines: bookLines } = await this.getBookSnapshot(campaignId);
    const physical = await this.aggregatePhysical(campaignId);

    const bookByKey = new Map<string, BookSnapshotLine>();
    for (const b of bookLines) bookByKey.set(this.key(b.materialCatalogId, b.lotId), b);

    await this.variances.delete({ campaignId });
    const out: CountVariance[] = [];

    // 1) Duyệt theo sổ sách: SHORTAGE/SURPLUS/MISSING/khớp.
    for (const b of bookLines) {
      const k = this.key(b.materialCatalogId, b.lotId);
      const phys = physical.get(k);
      const bookQty = Number(b.bookQty);
      const physicalQty = phys ? phys.qty : 0;
      const type = classifyVariance(bookQty, physicalQty, true);
      if (!type) continue;
      out.push(
        await this.variances.save(
          this.variances.create({
            campaignId,
            materialCatalogId: b.materialCatalogId,
            lotId: b.lotId,
            locationId: b.locationId,
            organizationId: b.organizationId,
            bookQty: String(bookQty),
            physicalQty: String(physicalQty),
            varianceQty: String(physicalQty - bookQty),
            varianceType: type,
            status: VarianceStatus.OPEN,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        ),
      );
    }

    // 2) Có thực nhưng KHÔNG có dòng sổ → UNBOOKED (TC-DT10-013).
    for (const [k, phys] of physical) {
      if (bookByKey.has(k)) continue;
      const type = classifyVariance(0, phys.qty, false);
      if (!type) continue;
      out.push(
        await this.variances.save(
          this.variances.create({
            campaignId,
            materialCatalogId: phys.materialCatalogId,
            lotId: phys.lotId,
            locationId: phys.locationId,
            organizationId: (c.scopeJson as { organizationId?: string } | null)?.organizationId ?? null,
            bookQty: '0',
            physicalQty: String(phys.qty),
            varianceQty: String(phys.qty),
            varianceType: type,
            status: VarianceStatus.OPEN,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        ),
      );
    }

    if (c.status === CampaignStatus.COUNTING) await this.transitionCampaign(c, CampaignStatus.RECONCILING, user);
    return out;
  }

  async listVariances(campaignId: string) {
    return this.variances.find({ where: { campaignId }, order: { createdAt: 'ASC' } });
  }

  async resolveVariance(id: string, dto: ResolveVarianceDto, user: AuthUser): Promise<CountVariance> {
    const v = await this.variances.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`DATA-001: Không có chênh lệch ${id}`);
    v.status = VarianceStatus.RESOLVED;
    v.resolutionNote = dto.note ?? null;
    v.updatedBy = this.uid(user);
    return this.variances.save(v);
  }

  // ---- Official snapshot + lock (lớp OFFICIAL, BR-DT10-019/020) ----
  private async activeLock(campaignId: string): Promise<OfficialLock | null> {
    return this.locks.findOne({ where: { campaignId, unlockReason: IsNull() } });
  }

  async createOfficialSnapshot(campaignId: string, user: AuthUser): Promise<{ snapshot: OfficialSnapshot; lineCount: number }> {
    const c = await this.getCampaign(campaignId);
    if (await this.activeLock(campaignId)) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Đã khóa official — mở khóa (có lý do) rồi revise');
    }
    const { lines: bookLines } = await this.getBookSnapshot(campaignId);
    const physical = await this.aggregatePhysical(campaignId);
    const prev = await this.officialSnaps.find({ where: { campaignId }, order: { version: 'DESC' }, take: 1 });
    const version = (prev[0]?.version ?? 0) + 1;

    // Số chính thức: có thực đếm → dùng thực; không → giữ sổ. Union book ∪ physical.
    const keys = new Set<string>([...bookLines.map((b) => this.key(b.materialCatalogId, b.lotId)), ...physical.keys()]);
    const lineData = [] as Array<{ materialCatalogId: string; lotId: string | null; locationId: string | null; organizationId: string | null; officialQty: number; g1: number; g2: number; g3: number; g4: number; g5: number; value: number | null }>;
    const bookByKey = new Map(bookLines.map((b) => [this.key(b.materialCatalogId, b.lotId), b]));
    for (const k of keys) {
      const b = bookByKey.get(k);
      const phys = physical.get(k);
      const officialQty = phys ? phys.qty : Number(b?.bookQty ?? 0);
      lineData.push({
        materialCatalogId: b?.materialCatalogId ?? phys!.materialCatalogId,
        lotId: b?.lotId ?? phys!.lotId,
        locationId: b?.locationId ?? phys?.locationId ?? null,
        organizationId: b?.organizationId ?? null,
        officialQty,
        g1: Number(b?.grade1 ?? 0), g2: Number(b?.grade2 ?? 0), g3: Number(b?.grade3 ?? 0),
        g4: Number(b?.grade4 ?? 0), g5: Number(b?.grade5 ?? 0),
        value: b?.value != null ? Number(b.value) : null,
      });
    }
    const checksum = officialSnapshotChecksum(
      lineData.map((l) => ({
        materialCatalogId: l.materialCatalogId, lotId: l.lotId, locationId: l.locationId,
        organizationId: l.organizationId, qty: l.officialQty,
        grade1: l.g1, grade2: l.g2, grade3: l.g3, grade4: l.g4, grade5: l.g5,
      })),
      version,
    );

    return this.dataSource.transaction(async (mgr) => {
      const snap = await mgr.getRepository(OfficialSnapshot).save(
        mgr.getRepository(OfficialSnapshot).create({
          campaignId, version, approvedAt: new Date(), checksum,
          createdBy: this.uid(user), updatedBy: this.uid(user),
        }),
      );
      for (const l of lineData) {
        await mgr.getRepository(OfficialSnapshotLine).save(
          mgr.getRepository(OfficialSnapshotLine).create({
            snapshotId: snap.id,
            materialCatalogId: l.materialCatalogId, lotId: l.lotId, locationId: l.locationId, organizationId: l.organizationId,
            officialQty: String(l.officialQty),
            grade1: String(l.g1), grade2: String(l.g2), grade3: String(l.g3), grade4: String(l.g4), grade5: String(l.g5),
            value: l.value != null ? String(l.value) : null,
          }),
        );
      }
      return { snapshot: snap, lineCount: lineData.length };
    });
  }

  async lockOfficial(campaignId: string, user: AuthUser): Promise<OfficialLock> {
    const c = await this.getCampaign(campaignId);
    if (await this.activeLock(campaignId)) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'official đã khóa');
    }
    const latest = await this.officialSnaps.find({ where: { campaignId }, order: { version: 'DESC' }, take: 1 });
    if (!latest[0]) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Chưa có official_snapshot để khóa');
    const lock = await this.locks.save(
      this.locks.create({
        campaignId,
        snapshotId: latest[0].id,
        snapshotVersion: latest[0].version,
        lockedBy: this.uid(user),
        lockedAt: new Date(),
        unlockReason: null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (c.status === CampaignStatus.RECONCILING) await this.transitionCampaign(c, CampaignStatus.OFFICIAL_LOCKED, user);
    return lock;
  }

  async unlockOfficial(campaignId: string, dto: UnlockDto, user: AuthUser): Promise<OfficialLock> {
    const lock = await this.activeLock(campaignId);
    if (!lock) throw new ConflictException('DATA-003: Không có khóa đang mở để mở');
    lock.unlockReason = dto.reason;
    lock.unlockedAt = new Date();
    lock.updatedBy = this.uid(user);
    return this.locks.save(lock);
  }

  // Sửa số đã khóa → LOCKED_IMMUTABLE; buộc revision (version mới) sau khi mở khóa có lý do (TC-DT10-019).
  async reviseOfficial(campaignId: string, dto: ReviseDto, user: AuthUser): Promise<{ snapshot: OfficialSnapshot; lineCount: number }> {
    if (await this.activeLock(campaignId)) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Bản chốt đang khóa — mở khóa (có lý do) trước khi revise');
    }
    const result = await this.createOfficialSnapshot(campaignId, user);
    result.snapshot.revisionReason = dto.reason;
    await this.officialSnaps.save(result.snapshot);
    return result;
  }

  async getOfficialSnapshot(campaignId: string) {
    const latest = await this.officialSnaps.find({ where: { campaignId }, order: { version: 'DESC' }, take: 1 });
    if (!latest[0]) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Chưa có official_snapshot');
    const lines = await this.officialLines.find({ where: { snapshotId: latest[0].id } });
    const lock = await this.activeLock(campaignId);
    return { snapshot: latest[0], lines, locked: !!lock };
  }

  // ---- Điều chỉnh → DT-05 (BR-DT10-022, SYS-BR-02: KHÔNG sửa số dư trực tiếp) ----
  async createAdjustmentRequest(campaignId: string, dto: CreateAdjustmentDto, user: AuthUser): Promise<CountAdjustmentRequest> {
    const c = await this.getCampaign(campaignId);
    const v = await this.variances.findOne({ where: { id: dto.varianceId } });
    if (!v) throw new NotFoundException(`DATA-001: Không có chênh lệch ${dto.varianceId}`);
    const org = v.organizationId ?? (c.scopeJson as { organizationId?: string } | null)?.organizationId;
    if (!org) throw new BusinessException(BusinessError.INVALID_LOCATION, 'Cần organizationId (variance/scope) để lập điều chỉnh');
    const req = await this.adjustments.save(
      this.adjustments.create({
        requestCode: `ADJKK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        campaignId,
        varianceId: v.id,
        materialCatalogId: v.materialCatalogId,
        lotId: v.lotId,
        organizationId: org,
        locationId: v.locationId,
        beforeQty: v.bookQty,
        proposedQty: v.physicalQty,
        proposedDelta: v.varianceQty,
        reasonCode: dto.reasonCode ?? 'INVENTORY_COUNT',
        status: CountAdjustmentStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (c.status === CampaignStatus.OFFICIAL_LOCKED) await this.transitionCampaign(c, CampaignStatus.ADJUSTING, user);
    return req;
  }

  // Duyệt điều chỉnh → sinh chứng từ DT-05 (CONVERSION) và POST (movement ADJUSTMENT theo delta).
  async approveAdjustment(id: string, user: AuthUser): Promise<CountAdjustmentRequest> {
    const req = await this.adjustments.findOne({ where: { id } });
    if (!req) throw new NotFoundException(`DATA-001: Không có yêu cầu điều chỉnh ${id}`);
    if (req.status === CountAdjustmentStatus.POSTED) return req; // idempotent.

    const doc = await this.documents.createDocument(
      {
        documentType: InventoryDocumentType.CONVERSION,
        organizationId: req.organizationId,
        effectiveDate: new Date().toISOString().slice(0, 10),
        basisDocumentId: undefined,
      },
      user,
    );
    await this.documents.addLine(
      doc.id,
      { materialCatalogId: req.materialCatalogId, quantity: Number(req.proposedDelta), lotId: req.lotId ?? undefined },
      user,
    );
    await this.documents.transitionDocument(doc.id, DocumentStatus.SUBMITTED, user);
    await this.documents.transitionDocument(doc.id, DocumentStatus.UNDER_REVIEW, user);
    await this.documents.transitionDocument(doc.id, DocumentStatus.APPROVED, user);
    await this.documents.postDocument(doc.id, user);

    req.dt05DocumentId = doc.id;
    req.status = CountAdjustmentStatus.POSTED;
    req.approvedBy = this.uid(user);
    req.updatedBy = this.uid(user);
    return this.adjustments.save(req);
  }

  async listAdjustments(campaignId: string) {
    return this.adjustments.find({ where: { campaignId }, order: { createdAt: 'ASC' } });
  }

  // ---- Reconciliation hậu kiểm: official ↔ HC hiện tại (sau điều chỉnh) ----
  async reconciliation(campaignId: string) {
    const { snapshot, lines } = await this.getOfficialSnapshot(campaignId);
    const rows = [] as Array<{ materialCatalogId: string; lotId: string | null; officialQty: number; hcNow: number; diff: number }>;
    for (const l of lines) {
      const qb = this.movements
        .createQueryBuilder('m')
        .select('COALESCE(SUM(m.quantity_signed),0)', 'hc')
        .where('m.material_catalog_id = :mat', { mat: l.materialCatalogId })
        .andWhere('m.status = :posted', { posted: MovementStatus.POSTED });
      if (l.lotId) qb.andWhere('m.lot_id = :lot', { lot: l.lotId });
      if (l.organizationId) qb.andWhere('m.organization_id = :org', { org: l.organizationId });
      const r = await qb.getRawOne<{ hc: string }>();
      const hcNow = Number(r?.hc ?? 0);
      const officialQty = Number(l.officialQty);
      rows.push({ materialCatalogId: l.materialCatalogId, lotId: l.lotId, officialQty, hcNow, diff: hcNow - officialQty });
    }
    return { snapshotVersion: snapshot.version, rows };
  }

  // ---- Dataset biểu KK → DT-11 (BR-DT10-025) ----
  async buildDataset(campaignId: string, dto: BuildDatasetDto, user: AuthUser): Promise<ReportDataset> {
    const { snapshot, lines } = await this.getOfficialSnapshot(campaignId);
    const payload = {
      formCode: dto.formCode,
      campaignId,
      snapshotVersion: snapshot.version,
      generatedAt: new Date().toISOString(),
      rows: lines.map((l) => ({
        materialCatalogId: l.materialCatalogId,
        lotId: l.lotId,
        officialQty: Number(l.officialQty),
        grades: [Number(l.grade1), Number(l.grade2), Number(l.grade3), Number(l.grade4), Number(l.grade5)],
        value: l.value != null ? Number(l.value) : null,
      })),
    };
    const datasetHash = sha256Hex(payload);
    return this.datasets.save(
      this.datasets.create({
        campaignId,
        formCode: dto.formCode,
        snapshotVersion: snapshot.version,
        datasetHash,
        payloadJson: payload,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async listDatasets(campaignId: string) {
    return this.datasets.find({ where: { campaignId }, order: { createdAt: 'DESC' } });
  }
}
