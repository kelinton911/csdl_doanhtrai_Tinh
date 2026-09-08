import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TerritorialSource } from './entities/territorial-source.entity';
import { SourceMaterial } from './entities/source-material.entity';
import { SourceVerification } from './entities/source-verification.entity';
import { VerificationEvidence } from './entities/verification-evidence.entity';
import { MobilizationAssessment } from './entities/mobilization-assessment.entity';
import { BalanceLine } from './entities/balance-line.entity';
import { SourceReservation } from './entities/source-reservation.entity';
import { ReservationStatus, VERIFICATION_TRANSITIONS, VerificationStatus, ReadinessLevel } from './dt09.enums';
import {
  AddSourceMaterialDto,
  AssessMobilizationDto,
  CreateSourceDto,
  SourceQuery,
  UpdateSourceDto,
  VerifyDto,
} from './dto/dt09.dto';
import {
  CandidateRow,
  assertMobilizable,
  effectiveVerificationStatus,
  rankCandidates,
} from './balance-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { resolveAsOf } from '../../common/time/as-of';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// DT-09 — Hồ sơ nguồn địa bàn: khai báo, xác minh (vòng đời tin cậy), đánh giá huy động,
// và dịch vụ candidate 8 bước (Quyển IX §III/§VII).
@Injectable()
export class SourceService {
  constructor(
    @InjectRepository(TerritorialSource) private readonly sources: Repository<TerritorialSource>,
    @InjectRepository(SourceMaterial) private readonly materials: Repository<SourceMaterial>,
    @InjectRepository(SourceVerification) private readonly verifications: Repository<SourceVerification>,
    @InjectRepository(VerificationEvidence) private readonly evidences: Repository<VerificationEvidence>,
    @InjectRepository(MobilizationAssessment) private readonly mobilizations: Repository<MobilizationAssessment>,
    @InjectRepository(BalanceLine) private readonly lines: Repository<BalanceLine>,
    @InjectRepository(SourceReservation) private readonly reservations: Repository<SourceReservation>,
    private readonly dataSource: DataSource,
  ) {}

  private uid(u: AuthUser): string | null {
    return u?.sub ?? null;
  }

  // ======================= Nguồn =======================
  listSources(q: SourceQuery) {
    const qb = this.sources.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    if (q.adminUnitId) qb.andWhere('s.admin_unit_id = :au', { au: q.adminUnitId });
    if (q.sourceType) qb.andWhere('s.source_type = :st', { st: q.sourceType });
    if (q.status) qb.andWhere('s.status = :st2', { st2: q.status });
    if (q.search) qb.andWhere('(s.name ILIKE :kw OR s.source_code ILIKE :kw)', { kw: `%${q.search}%` });
    return qb
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async getSource(id: string) {
    const s = await this.sources.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`DATA-001: Không có nguồn ${id}`);
    const materials = await this.materials.find({ where: { sourceId: id }, order: { createdAt: 'ASC' } });
    const enriched = await Promise.all(materials.map((m) => this.materialSummary(m)));
    return { ...s, materials: enriched };
  }

  async createSource(dto: CreateSourceDto, user: AuthUser): Promise<TerritorialSource> {
    const sourceCode = dto.sourceCode ?? `TS-${Date.now()}`;
    const dup = await this.sources.findOne({ where: { sourceCode } });
    if (dup) throw new NotFoundException(`DATA-003: Nguồn ${sourceCode} đã tồn tại`);
    const saved = await this.sources.save(
      this.sources.create({
        sourceCode,
        name: dto.name,
        adminUnitId: dto.adminUnitId,
        areaId: dto.areaId ?? null,
        sourceType: dto.sourceType,
        ownerName: dto.ownerName ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        address: dto.address ?? null,
        localResourceId: dto.localResourceId ?? null,
        status: 'ACTIVE',
        effectiveFrom: dto.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        effectiveTo: dto.effectiveTo ?? null,
        notes: dto.notes ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.dataSource.query(
        'UPDATE territorial_source SET location = ST_SetSRID(ST_MakePoint($1,$2),4326) WHERE id = $3',
        [dto.lng, dto.lat, saved.id],
      );
    }
    return saved;
  }

  async updateSource(id: string, dto: UpdateSourceDto, user: AuthUser): Promise<TerritorialSource> {
    const s = await this.getSource(id);
    Object.assign(s, {
      name: dto.name ?? s.name,
      sourceType: dto.sourceType ?? s.sourceType,
      ownerName: dto.ownerName ?? s.ownerName,
      contactName: dto.contactName ?? s.contactName,
      contactPhone: dto.contactPhone ?? s.contactPhone,
      address: dto.address ?? s.address,
      status: dto.status ?? s.status,
      effectiveTo: dto.effectiveTo ?? s.effectiveTo,
      notes: dto.notes ?? s.notes,
      updatedBy: this.uid(user),
    });
    return this.sources.save(s);
  }

  // ======================= Vật chất trên nguồn =======================
  async addMaterial(sourceId: string, dto: AddSourceMaterialDto, user: AuthUser): Promise<SourceMaterial> {
    await this.getSourceEntity(sourceId);
    return this.materials.save(
      this.materials.create({
        sourceId,
        materialCatalogId: dto.materialCatalogId,
        declaredQty: String(dto.declaredQty),
        unitId: dto.unitId ?? null,
        price: dto.price !== undefined ? String(dto.price) : null,
        asOfTime: resolveAsOf(dto.asOfTime),
        status: 'ACTIVE',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async listMaterials(sourceId: string) {
    const rows = await this.materials.find({ where: { sourceId }, order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((m) => this.materialSummary(m)));
  }

  // Gom trạng thái hiện hành của một nguồn vật chất: verification mới nhất + mobilization mới nhất.
  private async materialSummary(m: SourceMaterial) {
    const [ver, mob] = await Promise.all([
      this.latestVerification(m.id),
      this.latestMobilization(m.id),
    ]);
    const effStatus = effectiveVerificationStatus(ver?.status ?? null, ver?.expiresAt ?? null, new Date());
    return {
      ...m,
      verification: ver
        ? { ...ver, effectiveStatus: effStatus, verifiedQty: ver.verifiedQty != null ? Number(ver.verifiedQty) : null }
        : null,
      mobilization: mob ? { ...mob, mobilizableQty: Number(mob.mobilizableQty) } : null,
    };
  }

  private async latestVerification(sourceMaterialId: string): Promise<SourceVerification | null> {
    return this.verifications.findOne({ where: { sourceMaterialId }, order: { createdAt: 'DESC' } });
  }

  private async latestMobilization(sourceMaterialId: string): Promise<MobilizationAssessment | null> {
    return this.mobilizations.findOne({ where: { sourceMaterialId }, order: { createdAt: 'DESC' } });
  }

  private async getMaterialEntity(id: string): Promise<SourceMaterial> {
    const m = await this.materials.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`DATA-001: Không có nguồn vật chất ${id}`);
    return m;
  }

  private async getSourceEntity(id: string): Promise<TerritorialSource> {
    const s = await this.sources.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`DATA-001: Không có nguồn ${id}`);
    return s;
  }

  // ======================= Xác minh (BR-DT09-001/002) =======================
  async verify(sourceMaterialId: string, dto: VerifyDto, user: AuthUser): Promise<SourceVerification> {
    await this.getMaterialEntity(sourceMaterialId);
    const prev = await this.latestVerification(sourceMaterialId);
    const from = prev?.status ?? VerificationStatus.UNVERIFIED;
    assertTransition(VERIFICATION_TRANSITIONS, from, dto.status);

    const ver = await this.verifications.save(
      this.verifications.create({
        sourceMaterialId,
        status: dto.status,
        verifiedQty: dto.verifiedQty !== undefined ? String(dto.verifiedQty) : null,
        verifiedBy: dto.status === VerificationStatus.VERIFIED ? this.uid(user) : null,
        verifiedAt: dto.status === VerificationStatus.VERIFIED ? new Date() : null,
        evidenceFileId: dto.evidenceFileId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        method: dto.method ?? null,
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (dto.evidence?.length) {
      await this.evidences.save(
        dto.evidence.map((e) =>
          this.evidences.create({
            verificationId: ver.id,
            fileId: e.fileId,
            note: e.note ?? null,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        ),
      );
    }
    return ver;
  }

  // ======================= Đánh giá huy động (BR-DT09-003) =======================
  async assessMobilization(
    sourceMaterialId: string,
    dto: AssessMobilizationDto,
    user: AuthUser,
  ): Promise<MobilizationAssessment> {
    await this.getMaterialEntity(sourceMaterialId);
    const ver = await this.latestVerification(sourceMaterialId);
    const effStatus = effectiveVerificationStatus(ver?.status ?? null, ver?.expiresAt ?? null, new Date());
    const verifiedQty =
      effStatus === VerificationStatus.VERIFIED && ver?.verifiedQty != null ? Number(ver.verifiedQty) : null;
    assertMobilizable(dto.mobilizableQty, verifiedQty); // ném OVER_ALLOCATED nếu vượt/chưa xác minh

    return this.mobilizations.save(
      this.mobilizations.create({
        sourceMaterialId,
        mobilizableQty: String(dto.mobilizableQty),
        leadTimeDays: dto.leadTimeDays,
        readinessLevel: dto.readinessLevel ?? ReadinessLevel.MEDIUM,
        assessedBy: this.uid(user),
        assessedAt: new Date(),
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // ======================= Candidate 8 bước (Quyển IX §VII) =======================
  async candidates(
    balanceLineId: string,
    opts: { deadlineDays: number | null; radiusKm: number | null; lat?: number; lng?: number },
  ) {
    const line = await this.lines.findOne({ where: { id: balanceLineId } });
    if (!line) throw new NotFoundException(`DATA-001: Không có dòng cân đối ${balanceLineId}`);

    const materials = await this.materials.find({
      where: { materialCatalogId: line.materialCatalogId, status: 'ACTIVE' },
    });
    if (!materials.length) return { line: this.lineView(line), ranked: [], rejected: [] };

    const ids = materials.map((m) => m.id);
    const [vers, mobs, activeRes, distMap] = await Promise.all([
      this.verifications.find({ where: { sourceMaterialId: In(ids) }, order: { createdAt: 'DESC' } }),
      this.mobilizations.find({ where: { sourceMaterialId: In(ids) }, order: { createdAt: 'DESC' } }),
      this.reservations.find({ where: { sourceMaterialId: In(ids), status: ReservationStatus.ACTIVE } }),
      this.distanceMap(materials, opts.lat, opts.lng),
    ]);

    const latestVer = new Map<string, SourceVerification>();
    for (const v of vers) if (!latestVer.has(v.sourceMaterialId)) latestVer.set(v.sourceMaterialId, v);
    const latestMob = new Map<string, MobilizationAssessment>();
    for (const m of mobs) if (!latestMob.has(m.sourceMaterialId)) latestMob.set(m.sourceMaterialId, m);
    const reservedByMat = new Map<string, number>();
    for (const r of activeRes) {
      reservedByMat.set(r.sourceMaterialId, (reservedByMat.get(r.sourceMaterialId) ?? 0) + Number(r.reservedQty));
    }

    const now = new Date();
    const rows: CandidateRow[] = materials.map((m) => {
      const v = latestVer.get(m.id);
      const mob = latestMob.get(m.id);
      return {
        sourceMaterialId: m.id,
        sourceId: m.sourceId,
        materialCatalogId: m.materialCatalogId,
        verificationStatus: v?.status ?? null,
        verifiedQty: v?.verifiedQty != null ? Number(v.verifiedQty) : null,
        expiresAt: v?.expiresAt ?? null,
        mobilizableQty: mob ? Number(mob.mobilizableQty) : 0,
        leadTimeDays: mob ? mob.leadTimeDays : null,
        activeReserved: reservedByMat.get(m.id) ?? 0,
        distanceKm: distMap.get(m.sourceId) ?? null,
        priority: 100,
      };
    });

    const result = rankCandidates(rows, {
      materialCatalogId: line.materialCatalogId,
      now,
      deadlineDays: opts.deadlineDays,
      radiusKm: opts.radiusKm,
    });
    // Bổ sung tên nguồn cho hiển thị.
    const srcMap = new Map((await this.sources.find({ where: { id: In(materials.map((m) => m.sourceId)) } })).map((s) => [s.id, s]));
    const ranked = result.ranked.map((r) => ({
      ...r,
      sourceCode: srcMap.get(r.sourceId)?.sourceCode ?? null,
      sourceName: srcMap.get(r.sourceId)?.name ?? null,
    }));
    return { line: this.lineView(line), ranked, rejected: result.rejected };
  }

  private lineView(line: BalanceLine) {
    return {
      id: line.id,
      planId: line.planId,
      materialCatalogId: line.materialCatalogId,
      supplyRequired: Number(line.supplyRequired),
      plannedSourceQty: Number(line.plannedSourceQty),
      gapQty: Number(line.gapQty),
      status: line.status,
    };
  }

  // Khoảng cách (km) từ điểm tham chiếu tới từng nguồn (PostGIS). Không có điểm → rỗng.
  private async distanceMap(
    materials: SourceMaterial[],
    lat?: number,
    lng?: number,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (lat === undefined || lng === undefined) return map;
    const sourceIds = [...new Set(materials.map((m) => m.sourceId))];
    if (!sourceIds.length) return map;
    const rows = await this.dataSource.query(
      `SELECT id, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS dist_m
       FROM territorial_source WHERE id = ANY($3) AND location IS NOT NULL`,
      [lng, lat, sourceIds],
    );
    for (const r of rows) {
      map.set(r.id, Math.round((Number(r.dist_m) / 1000) * 100) / 100);
    }
    return map;
  }
}
