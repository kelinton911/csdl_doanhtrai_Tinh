import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CommunePotential } from './entities/commune-potential.entity';
import { CommunePotentialMaterial } from './entities/commune-potential-material.entity';
import {
  CreateCommunePotentialDto,
  POTENTIAL_METRIC_KEYS,
  ReplacePotentialMaterialsDto,
  UpdateCommunePotentialDto,
} from './dto/commune-potential.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
} from '../../common/workflow-transition';

export interface PotentialFilters {
  search?: string;
  areaId?: string;
  status?: string;
}

// M17 — Tiềm lực HC-KT khu vực cấp xã. Cùng luồng khai báo → duyệt như doanh trại/kho:
// DRAFT → (gửi duyệt) PENDING_REVIEW → (chỉ huy xã duyệt) APPROVED.
@Injectable()
export class CommunePotentialService {
  constructor(
    @InjectRepository(CommunePotential)
    private readonly repo: Repository<CommunePotential>,
    @InjectRepository(CommunePotentialMaterial)
    private readonly materials: Repository<CommunePotentialMaterial>,
    private readonly dataSource: DataSource,
  ) {}

  // number → chuỗi numeric ('' undefined giữ nguyên để PUT không ghi đè).
  private metricFields(
    dto: CreateCommunePotentialDto | UpdateCommunePotentialDto,
    withDefault: boolean,
  ): Partial<CommunePotential> {
    const out: Record<string, string> = {};
    const src = dto as unknown as Record<string, number | undefined>;
    for (const k of POTENTIAL_METRIC_KEYS) {
      const v = src[k];
      if (v !== undefined) out[k] = String(v);
      else if (withDefault) out[k] = '0';
    }
    return out as Partial<CommunePotential>;
  }

  async list(q: PaginationQuery, filters: PotentialFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo.createQueryBuilder('p');
    if (filters.search) {
      qb.andWhere('(p.code ILIKE :s OR p.title ILIKE :s)', { s: `%${filters.search}%` });
    }
    if (filters.areaId) qb.andWhere('p.area_id = :aid', { aid: filters.areaId });
    if (filters.status) qb.andWhere('p.workflow_status = :st', { st: filters.status });
    // Phạm vi dữ liệu: theo địa bàn được giao HOẶC đơn vị chủ quản; null = toàn tỉnh.
    if (scope) {
      qb.andWhere('(p.area_id = ANY(:areaIds::uuid[]) OR p.organization_id = :orgId)', {
        areaIds: scope.areaIds,
        orgId: scope.organizationId,
      });
    }
    qb.orderBy('p.updatedAt', 'DESC').skip(q.skip).take(q.size);

    const [entities, total] = await qb.getManyAndCount();
    const areaIds = [...new Set(entities.map((e) => e.areaId).filter(Boolean))] as string[];
    const areaRows = areaIds.length
      ? await this.repo.query('SELECT id, name FROM administrative_areas WHERE id = ANY($1::uuid[])', [areaIds])
      : [];
    const areaNameById = new Map(
      (areaRows as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
    );
    return paginated(
      entities.map((e) => ({
        ...this.serialize(e),
        areaName: e.areaId ? areaNameById.get(e.areaId) ?? null : null,
      })),
      total,
      q,
    );
  }

  async get(id: string, user: AuthUser) {
    const e = await this.getEntity(id);
    const row = await this.repo.query(
      `SELECT a.name AS area_name FROM commune_potentials p
       LEFT JOIN administrative_areas a ON a.id = p.area_id WHERE p.id = $1`,
      [id],
    );
    return { ...this.serialize(e), areaName: row?.[0]?.area_name ?? null };
  }

  private async getEntity(id: string): Promise<CommunePotential> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('DATA-001: Không tìm thấy bản khai tiềm lực HC-KT');
    return e;
  }

  // Trả về số (numeric) thay vì chuỗi để FE dùng trực tiếp.
  private serialize(e: CommunePotential) {
    const metrics: Record<string, number> = {};
    const src = e as unknown as Record<string, string>;
    for (const k of POTENTIAL_METRIC_KEYS) {
      metrics[k] = Number(src[k] ?? 0);
    }
    return {
      id: e.id,
      code: e.code,
      title: e.title,
      areaId: e.areaId,
      organizationId: e.organizationId,
      periodLabel: e.periodLabel,
      workflowStatus: e.workflowStatus,
      assessment: e.assessment,
      note: e.note,
      createdBy: e.createdBy,
      updatedAt: e.updatedAt,
      ...metrics,
    };
  }

  async create(dto: CreateCommunePotentialDto, user: AuthUser): Promise<CommunePotential> {
    const code = dto.code?.trim() || `TLHCKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dup = await this.repo.findOne({ where: { code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã bản khai ${code}`);
    const entity = this.repo.create({
      code,
      title: dto.title,
      areaId: dto.areaId ?? null,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      periodLabel: dto.periodLabel ?? null,
      workflowStatus: WorkflowStatus.DRAFT,
      assessment: dto.assessment ?? null,
      note: dto.note ?? null,
      createdBy: user.sub,
      updatedBy: user.sub,
      ...this.metricFields(dto, true),
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateCommunePotentialDto, user: AuthUser): Promise<CommunePotential> {
    const e = await this.getEntity(id);
    assertEditable(e.workflowStatus);
    if (dto.title !== undefined) e.title = dto.title;
    if (dto.areaId !== undefined) e.areaId = dto.areaId || null;
    if (dto.organizationId !== undefined) e.organizationId = dto.organizationId || null;
    if (dto.periodLabel !== undefined) e.periodLabel = dto.periodLabel || null;
    if (dto.assessment !== undefined) e.assessment = dto.assessment || null;
    if (dto.note !== undefined) e.note = dto.note || null;
    Object.assign(e, this.metricFields(dto, false));
    e.updatedBy = user.sub;
    return this.repo.save(e);
  }

  async remove(id: string, user: AuthUser): Promise<{ deleted: true }> {
    const e = await this.getEntity(id);
    if (e.workflowStatus !== WorkflowStatus.DRAFT) {
      throw new ConflictException(
        `WF-001: Chỉ xóa bản khai ở trạng thái DRAFT (hiện ${e.workflowStatus})`,
      );
    }
    await this.repo.delete({ id });
    return { deleted: true };
  }

  async submit(id: string, user: AuthUser): Promise<CommunePotential> {
    const e = await this.getEntity(id);
    assertEditable(e.workflowStatus, 'gửi duyệt');
    e.workflowStatus = WorkflowStatus.PENDING_REVIEW;
    e.updatedBy = user.sub;
    return this.repo.save(e);
  }

  async approve(id: string, user: AuthUser): Promise<CommunePotential> {
    const e = await this.getEntity(id);
    assertPendingReview(e.workflowStatus);
    assertNotSelfApprove(e.createdBy, user.sub);
    e.workflowStatus = WorkflowStatus.APPROVED;
    e.updatedBy = user.sub;
    return this.repo.save(e);
  }

  async requestChanges(id: string, reason: string | undefined, user: AuthUser): Promise<CommunePotential> {
    const e = await this.getEntity(id);
    assertPendingReview(e.workflowStatus, 'yêu cầu bổ sung');
    e.workflowStatus = WorkflowStatus.CHANGES_REQUESTED;
    e.note = reason ? [e.note, `Yêu cầu bổ sung: ${reason}`].filter(Boolean).join(' · ') : e.note;
    e.updatedBy = user.sub;
    return this.repo.save(e);
  }

  // ------- Dòng vật chất tiềm lực (KVPT) -------
  // Trả danh sách dòng vật chất kèm mã/tên chuẩn (từ material_catalog).
  async listMaterials(id: string) {
    await this.getEntity(id);
    const rows = await this.materials
      .createQueryBuilder('l')
      .leftJoin('material_catalog', 'mc', 'mc.id = l.material_catalog_id')
      .select('l.id', 'id')
      .addSelect('l.material_catalog_id', 'materialCatalogId')
      .addSelect('l.alias_used', 'aliasUsed')
      .addSelect('l.unit_id', 'unitId')
      .addSelect('l.catalog_group', 'catalogGroup')
      .addSelect('l.quantity', 'quantity')
      .addSelect('l.note', 'note')
      .addSelect('l.sort_order', 'sortOrder')
      .addSelect('mc.code', 'materialCode')
      .addSelect('mc.name', 'materialName')
      .where('l.commune_potential_id = :id', { id })
      .orderBy('l.sort_order', 'ASC')
      .addOrderBy('mc.code', 'ASC')
      .getRawMany<{
        id: string;
        materialCatalogId: string;
        aliasUsed: string | null;
        unitId: string | null;
        catalogGroup: string;
        quantity: string;
        note: string | null;
        sortOrder: number;
        materialCode: string | null;
        materialName: string | null;
      }>();
    return rows.map((r) => ({ ...r, quantity: Number(r.quantity) }));
  }

  // Ghi đè toàn bộ danh sách dòng vật chất (bulk upsert) — chỉ khi DRAFT/CHANGES_REQUESTED.
  async replaceMaterials(id: string, dto: ReplacePotentialMaterialsDto, user: AuthUser) {
    const e = await this.getEntity(id);
    assertEditable(e.workflowStatus, 'sửa danh sách vật chất');
    const keepIds = dto.materials.map((m) => m.id).filter(Boolean) as string[];
    await this.dataSource.transaction(async (trx) => {
      const mrepo = trx.getRepository(CommunePotentialMaterial);
      // Xoá dòng cũ không còn trong payload.
      const existing = await mrepo.find({ where: { communePotentialId: id } });
      const toDelete = existing.filter((row) => !keepIds.includes(row.id)).map((row) => row.id);
      if (toDelete.length) await mrepo.delete(toDelete);
      // Upsert từng dòng.
      let order = 0;
      for (const m of dto.materials) {
        const base = {
          communePotentialId: id,
          materialCatalogId: m.materialCatalogId,
          aliasUsed: m.aliasUsed ?? null,
          unitId: m.unitId ?? null,
          catalogGroup: m.catalogGroup ?? 'STANDARD',
          quantity: m.quantity != null ? String(m.quantity) : '0',
          note: m.note ?? null,
          sortOrder: m.sortOrder ?? order,
          updatedBy: user.sub,
        };
        if (m.id) {
          await mrepo.update({ id: m.id }, base);
        } else {
          await mrepo.save(mrepo.create({ ...base, createdBy: user.sub }));
        }
        order++;
      }
    });
    return this.listMaterials(id);
  }

  // Cuộn "Vật chất KVPT" cấp Tỉnh: gộp dòng vật chất của các bản khai ĐÃ DUYỆT theo
  // xã × nguồn danh mục × vật chất. Tôn trọng phạm vi dữ liệu người dùng.
  async kvptSummaryByArea(filters: { areaId?: string; catalogGroup?: string }, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.dataSource
      .createQueryBuilder()
      .select('a.id', 'areaId')
      .addSelect('a.name', 'areaName')
      .addSelect('l.catalog_group', 'catalogGroup')
      .addSelect('l.material_catalog_id', 'materialCatalogId')
      .addSelect('mc.code', 'materialCode')
      .addSelect('mc.name', 'materialName')
      .addSelect('COALESCE(SUM(l.quantity), 0)', 'totalQuantity')
      .addSelect('COUNT(DISTINCT p.id)', 'communeCount')
      .from(CommunePotentialMaterial, 'l')
      .innerJoin('commune_potentials', 'p', 'p.id = l.commune_potential_id')
      .leftJoin('administrative_areas', 'a', 'a.id = p.area_id')
      .leftJoin('material_catalog', 'mc', 'mc.id = l.material_catalog_id')
      .where('p.workflow_status = :st', { st: WorkflowStatus.APPROVED })
      .groupBy('a.id')
      .addGroupBy('a.name')
      .addGroupBy('l.catalog_group')
      .addGroupBy('l.material_catalog_id')
      .addGroupBy('mc.code')
      .addGroupBy('mc.name')
      .orderBy('a.name', 'ASC')
      .addOrderBy('l.catalog_group', 'ASC')
      .addOrderBy('mc.code', 'ASC');
    if (filters.areaId) qb.andWhere('p.area_id = :aid', { aid: filters.areaId });
    if (filters.catalogGroup) qb.andWhere('l.catalog_group = :cg', { cg: filters.catalogGroup });
    if (scope)
      qb.andWhere('(p.area_id = ANY(:areaIds::uuid[]) OR p.organization_id = :orgId)', {
        areaIds: scope.areaIds,
        orgId: scope.organizationId,
      });
    const rows = await qb.getRawMany<{
      areaId: string | null;
      areaName: string | null;
      catalogGroup: string | null;
      materialCatalogId: string | null;
      materialCode: string | null;
      materialName: string | null;
      totalQuantity: string;
      communeCount: string;
    }>();
    return rows.map((r) => ({
      areaId: r.areaId,
      areaName: r.areaName,
      catalogGroup: r.catalogGroup,
      materialCatalogId: r.materialCatalogId,
      materialCode: r.materialCode,
      materialName: r.materialName,
      totalQuantity: Number(r.totalQuantity),
      communeCount: Number(r.communeCount),
    }));
  }
}
