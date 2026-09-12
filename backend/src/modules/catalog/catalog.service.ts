import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CatalogVersion } from './entities/catalog-version.entity';
import { MaterialCatalog } from './entities/material-catalog.entity';
import { MaterialAlias } from './entities/material-alias.entity';
import { UnitOfMeasure } from './entities/unit-of-measure.entity';
import { CatalogVersionStatus, CATALOG_VERSION_TRANSITIONS } from '../../common/enums';
import { assertTransition } from '../../common/enums/assert-transition';
import { paginated } from '../../common/dto/pagination.dto';
import { normalizeText } from '../../common/tabular';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CompareItem,
  VersionDiff,
  assertParentExists,
  compareVersions,
  wouldCreateCycle,
} from './catalog-rules';
import {
  CompareQuery,
  CreateItemDto,
  CreateVersionDto,
  ItemQuery,
  VersionQuery,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogVersion) private readonly versions: Repository<CatalogVersion>,
    @InjectRepository(MaterialCatalog) private readonly items: Repository<MaterialCatalog>,
    @InjectRepository(MaterialAlias) private readonly aliases: Repository<MaterialAlias>,
    @InjectRepository(UnitOfMeasure) private readonly units: Repository<UnitOfMeasure>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  // ---- Versions ----
  async listVersions(q: VersionQuery) {
    const qb = this.versions.createQueryBuilder('v').orderBy('v.created_at', 'DESC').skip(q.skip).take(q.size);
    if (q.status) qb.andWhere('v.status = :status', { status: q.status });
    if (q.search) qb.andWhere('(v.version_code ILIKE :s OR v.version_name ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async createVersion(dto: CreateVersionDto, user: AuthUser): Promise<CatalogVersion> {
    const exists = await this.versions.findOne({ where: { versionCode: dto.versionCode } });
    if (exists) throw new ConflictException(`DATA-003: Phiên bản ${dto.versionCode} đã tồn tại`);
    return this.versions.save(
      this.versions.create({
        ...dto,
        status: CatalogVersionStatus.DRAFT,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  // Publish: DRAFT/VALIDATED → PUBLISHED; phiên bản PUBLISHED trước → SUPERSEDED.
  // Ghi outbox 'catalog.version.published' TRONG cùng transaction (SYS-BR / Sprint 0 GAP-7).
  async publishVersion(id: string, user: AuthUser): Promise<CatalogVersion> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(CatalogVersion);
      const version = await repo.findOne({ where: { id } });
      if (!version) throw new NotFoundException(`DATA-001: Không có phiên bản ${id}`);
      assertTransition(CATALOG_VERSION_TRANSITIONS, version.status, CatalogVersionStatus.PUBLISHED);

      // Hạ các phiên bản PUBLISHED hiện tại xuống SUPERSEDED.
      await repo
        .createQueryBuilder()
        .update()
        .set({ status: CatalogVersionStatus.SUPERSEDED, updatedBy: user?.sub ?? null })
        .where('status = :pub', { pub: CatalogVersionStatus.PUBLISHED })
        .execute();

      version.status = CatalogVersionStatus.PUBLISHED;
      version.publishedAt = new Date();
      version.publishedBy = user?.sub ?? null;
      version.updatedBy = user?.sub ?? null;
      const saved = await repo.save(version);

      await this.outbox.enqueue(m, {
        aggregateType: 'catalog_version',
        aggregateId: saved.id,
        eventType: 'catalog.version.published',
        payload: { versionCode: saved.versionCode, effectiveFrom: saved.effectiveFrom },
        correlationId: null,
      });
      return saved;
    });
  }

  // ---- Items (cây phân loại R00) ----
  async listItems(q: ItemQuery) {
    const qb = this.items.createQueryBuilder('i').orderBy('i.code', 'ASC').skip(q.skip).take(q.size);
    if (q.versionId) qb.andWhere('i.version_id = :v', { v: q.versionId });
    if (q.parentId) qb.andWhere('i.parent_id = :p', { p: q.parentId });
    // rootsOnly: lấy các nút gốc của phiên bản (parent_id IS NULL) — điểm vào cho picker duyệt cây.
    if (q.rootsOnly) qb.andWhere('i.parent_id IS NULL');
    if (q.search) {
      qb.andWhere('(i.code ILIKE :s OR i.name ILIKE :s OR i.search_key ILIKE :sn)', {
        s: `%${q.search}%`,
        sn: `%${normalizeText(q.search)}%`,
      });
    }
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async getItem(id: string): Promise<MaterialCatalog> {
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`DATA-001: Không có mã ${id}`);
    return item;
  }

  async getChildren(id: string): Promise<MaterialCatalog[]> {
    return this.items.find({ where: { parentId: id }, order: { code: 'ASC' } });
  }

  // Tất cả node LÁ dưới một nhóm (đệ quy) — phục vụ "Thêm cả nhóm" khi khai báo.
  async getLeaves(id: string): Promise<Array<{ id: string; code: string; name: string; unitId: string | null }>> {
    return this.dataSource.query(
      `WITH RECURSIVE sub AS (
         SELECT id, parent_id, is_leaf, code, name, unit_id FROM material_catalog WHERE id = $1
         UNION ALL
         SELECT c.id, c.parent_id, c.is_leaf, c.code, c.name, c.unit_id
         FROM material_catalog c JOIN sub s ON c.parent_id = s.id
       )
       SELECT id, code, name, unit_id AS "unitId" FROM sub WHERE is_leaf = true ORDER BY code LIMIT 1000`,
      [id],
    );
  }

  // BR-DT01-002/004/005 + BR-DT01-001: parent tồn tại, không vòng lặp, mã duy nhất/phiên bản.
  async createItem(dto: CreateItemDto, user: AuthUser): Promise<MaterialCatalog> {
    const version = await this.versions.findOne({ where: { id: dto.versionId } });
    if (!version) throw new NotFoundException(`DATA-001: Không có phiên bản ${dto.versionId}`);
    if (version.status === CatalogVersionStatus.PUBLISHED || version.status === CatalogVersionStatus.SUPERSEDED) {
      throw new ConflictException('DATA-003: Không thêm mã vào phiên bản đã công bố (BR-DT01-008)');
    }

    const siblings = await this.items.find({ where: { versionId: dto.versionId } });
    const nodeIds = new Set(siblings.map((s) => s.id));
    assertParentExists(nodeIds, dto.parentId ?? null);

    const dup = siblings.find((s) => s.code === dto.code);
    if (dup) throw new ConflictException(`DATA-003: Mã ${dto.code} đã tồn tại trong phiên bản (BR-DT01-001)`);

    let levelNo = 0;
    if (dto.parentId) {
      const parent = siblings.find((s) => s.id === dto.parentId)!;
      levelNo = parent.levelNo + 1;
      // node cha không còn là lá.
      if (parent.isLeaf) await this.items.update(parent.id, { isLeaf: true });
    }

    // Kiểm tra vòng lặp (mã mới chưa có id nên chỉ có ý nghĩa khi cập nhật; giữ nhất quán).
    const treeNodes = siblings.map((s) => ({ id: s.id, parentId: s.parentId }));
    if (dto.parentId && wouldCreateCycle(treeNodes, 'NEW', dto.parentId)) {
      throw new ConflictException('DATA-003: Quan hệ cha-con tạo vòng lặp (BR-DT01-004/005)');
    }

    return this.items.save(
      this.items.create({
        versionId: dto.versionId,
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId ?? null,
        unitId: dto.unitId ?? null,
        levelNo,
        isLeaf: dto.isLeaf ?? true,
        effectiveFrom: dto.effectiveFrom ?? null,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  // ---- So sánh 2 phiên bản (§3.3, TC-DT01-007) ----
  async compare(q: CompareQuery): Promise<VersionDiff> {
    const [oldItems, newItems] = await Promise.all([
      this.loadCompareItems(q.from),
      this.loadCompareItems(q.to),
    ]);
    return compareVersions(oldItems, newItems);
  }

  private async loadCompareItems(versionId: string): Promise<CompareItem[]> {
    const items = await this.items.find({ where: { versionId } });
    const codeById = new Map(items.map((i) => [i.id, i.code]));
    const unitIds = items.map((i) => i.unitId).filter((x): x is string => !!x);
    const units = unitIds.length ? await this.units.find({ where: { id: In(unitIds) } }) : [];
    const unitCodeById = new Map(units.map((u) => [u.id, u.code]));
    return items.map((i) => ({
      code: i.code,
      name: i.name,
      unitCode: i.unitId ? unitCodeById.get(i.unitId) ?? null : null,
      parentCode: i.parentId ? codeById.get(i.parentId) ?? null : null,
    }));
  }

  // ---- Tìm kiếm mã/tên/alias (GET /catalog/search) ----
  async search(q: string) {
    const like = `%${q}%`;
    const likeNorm = `%${normalizeText(q)}%`; // gõ không dấu → khớp search_key đã chuẩn hóa
    const byItem = await this.items
      .createQueryBuilder('i')
      .where('i.code ILIKE :s OR i.name ILIKE :s OR i.search_key ILIKE :sn', { s: like, sn: likeNorm })
      .orderBy('i.code', 'ASC')
      .take(50)
      .getMany();
    const byAlias = await this.aliases
      .createQueryBuilder('a')
      .where('a.alias_name ILIKE :s', { s: like })
      .andWhere('a.status = :st', { st: 'ACTIVE' })
      .take(50)
      .getMany();
    return { items: byItem, aliases: byAlias };
  }
}
