import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Catalog } from './entities/catalog.entity';
import { Material } from './entities/material.entity';
import { MaterialVersion } from './entities/material-version.entity';
import { AssetCatalogItem } from '../asset-catalog/entities/asset-catalog-item.entity';
import { MaterialCatalog } from '../catalog/entities/material-catalog.entity';
import { UnitOfMeasure } from '../catalog/entities/unit-of-measure.entity';
import {
  CreateCatalogDto,
  CreateMaterialDto,
  UpdateCatalogDto,
  UpdateMaterialDto,
} from './dto/master-data.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { normalizeText } from '../../common/tabular';

// Loại danh mục do module Nhóm ngành vật chất (/material-groups) sở hữu — chặn
// ghi qua đường danh mục chung để tránh 2 nguồn CRUD trên cùng bảng catalogs.
const MATERIAL_GROUP_TYPE = 'material-category';

// M03 — Master Data. UC-03 (danh mục chung) + UC-07 (danh mục vật chất).
@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(Catalog) private readonly catalogs: Repository<Catalog>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(MaterialVersion) private readonly versions: Repository<MaterialVersion>,
    @InjectRepository(AssetCatalogItem) private readonly assetItems: Repository<AssetCatalogItem>,
    @InjectRepository(MaterialCatalog) private readonly materialCatalog: Repository<MaterialCatalog>,
    @InjectRepository(UnitOfMeasure) private readonly units: Repository<UnitOfMeasure>,
  ) {}

  // Bắc cầu một mã trong danh mục Quân nhu (material_catalog) sang bảng vật chất (materials) để
  // có thể nhập kho/theo dõi tồn. Idempotent theo code; đánh dấu OUT_OF_SCOPE (ngành khác Doanh trại).
  async ensureMaterialFromCatalog(materialCatalogId: string, user: AuthUser): Promise<Material> {
    const cat = await this.materialCatalog.findOne({ where: { id: materialCatalogId } });
    if (!cat) throw new NotFoundException(`DATA-001: Không có mã danh mục ${materialCatalogId}`);

    const existing = await this.materials.findOne({ where: { code: cat.code } });
    if (existing) return existing;

    const unitCode = cat.unitId
      ? (await this.units.findOne({ where: { id: cat.unitId } }))?.code ?? null
      : null;
    const categoryCode = cat.parentId
      ? (await this.materialCatalog.findOne({ where: { id: cat.parentId } }))?.code ?? null
      : null;

    const material = await this.materials.save(
      this.materials.create({
        code: cat.code,
        name: cat.name,
        unitCode,
        categoryCode,
        status: 'PUBLISHED',
        assetCodeStatus: 'OUT_OF_SCOPE',
        attributes: { source: 'QUAN_NHU', catalogVersionId: cat.versionId, catalogCode: cat.code },
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
    await this.snapshotMaterial(material, 'IMPORT_FROM_CATALOG', user.sub);
    return material;
  }

  // Tìm liên thông một ô: gộp vật chất kho (materials/R00) + danh mục Quân nhu (material_catalog).
  // Mỗi kết quả mang materialId (nếu từ materials) hoặc materialCatalogId (nếu từ catalog) để nơi gọi
  // tự phân giải (kho: dùng materialId, hoặc bắc cầu từ materialCatalogId).
  async federatedSearch(q: string) {
    const term = (q ?? '').trim();
    if (term.length < 2) return [];
    const like = `%${term}%`;
    const nk = `%${normalizeText(term)}%`;
    const src = (code: string) => (code.startsWith('Y2') ? 'QN' : 'R00');
    const mats = await this.materials
      .createQueryBuilder('m')
      .where('(m.code ILIKE :s OR m.name ILIKE :s)', { s: like })
      .orderBy('m.code', 'ASC')
      .take(25)
      .getMany();
    // Chỉ lấy mục danh mục CHƯA có trong materials (tránh trùng vì R00 nay có ở cả 2 bảng).
    const cats = await this.materialCatalog
      .createQueryBuilder('c')
      .where('c.is_leaf = true AND (c.code ILIKE :s OR c.name ILIKE :s OR c.search_key ILIKE :nk)', { s: like, nk })
      .andWhere('c.code NOT IN (SELECT code FROM materials)')
      .orderBy('c.code', 'ASC')
      .take(25)
      .getMany();
    return [
      ...mats.map((m) => ({ code: m.code, name: m.name, unitCode: m.unitCode, materialId: m.id, materialCatalogId: null as string | null, source: src(m.code) })),
      ...cats.map((c) => ({ code: c.code, name: c.name, unitCode: null as string | null, materialId: null as string | null, materialCatalogId: c.id, source: src(c.code) })),
    ];
  }

  // Nhóm ngành vật chất chỉ được quản lý ở module riêng (material-group) — một nguồn CRUD.
  private ensureCatalogWritable(type: string) {
    if (type === MATERIAL_GROUP_TYPE) {
      throw new ConflictException(
        'DATA-004: Nhóm ngành vật chất được quản lý tại module "Nhóm ngành vật chất" (/material-groups), không tạo/sửa qua danh mục chung.',
      );
    }
  }

  // Ghi snapshot bất biến vào lịch sử phiên bản vật chất (M03) để đối chiếu/diff.
  private async snapshotMaterial(m: Material, changeType: string, userId: string) {
    const count = await this.versions.count({ where: { materialId: m.id } });
    await this.versions.save(
      this.versions.create({
        materialId: m.id,
        version: count + 1,
        changeType,
        snapshot: {
          code: m.code,
          name: m.name,
          categoryCode: m.categoryCode,
          unitCode: m.unitCode,
          spec: m.spec,
          qualityGrade: m.qualityGrade,
          defaultScale: m.defaultScale,
          attributes: m.attributes,
          status: m.status,
        },
        createdBy: userId,
      }),
    );
  }

  async getMaterialVersions(id: string) {
    await this.getMaterial(id);
    return this.versions.find({ where: { materialId: id }, order: { version: 'DESC' } });
  }

  // ------- Catalog (UC-03) -------
  async listCatalog(type: string, q: PaginationQuery) {
    const [data, total] = await this.catalogs.findAndCount({
      where: { type },
      order: { sortOrder: 'ASC', code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async createCatalog(type: string, dto: CreateCatalogDto, user: AuthUser) {
    this.ensureCatalogWritable(type);
    const dup = await this.catalogs.findOne({ where: { type, code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã "${dto.code}" trong loại ${type}`);
    return this.catalogs.save(
      this.catalogs.create({
        type,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        parentCode: dto.parentCode ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status: 'DRAFT',
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async updateCatalog(type: string, id: string, dto: UpdateCatalogDto, user: AuthUser) {
    this.ensureCatalogWritable(type);
    const c = await this.catalogs.findOne({ where: { id, type } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy mục danh mục');
    if (c.status === 'PUBLISHED') {
      throw new ConflictException('WF-001: Không sửa hồi tố bản đã phát hành; tạo phiên bản mới');
    }
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.parentCode !== undefined) c.parentCode = dto.parentCode;
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    c.updatedBy = user.sub;
    return this.catalogs.save(c);
  }

  async publishCatalog(type: string, id: string, user: AuthUser) {
    this.ensureCatalogWritable(type);
    const c = await this.catalogs.findOne({ where: { id, type } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy mục danh mục');
    if (c.status === 'PUBLISHED') {
      throw new ConflictException('WF-001: Mục danh mục đã phát hành');
    }
    c.status = 'PUBLISHED';
    c.effectiveFrom = new Date();
    c.updatedBy = user.sub;
    return this.catalogs.save(c);
  }

  // ------- Material (UC-07) -------
  async listMaterials(q: PaginationQuery, category?: string, search?: string) {
    const qb = this.materials
      .createQueryBuilder('m')
      .orderBy('m.code', 'ASC')
      .skip(q.skip)
      .take(q.size);
    if (category) qb.andWhere('m.category_code = :category', { category });
    if (search)
      qb.andWhere('(m.code ILIKE :s OR m.name ILIKE :s)', { s: `%${search}%` });
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async getMaterial(id: string) {
    const m = await this.materials.findOne({ where: { id } });
    if (!m) throw new NotFoundException('DATA-001: Không tìm thấy vật chất');
    return m;
  }

  async createMaterial(dto: CreateMaterialDto, user: AuthUser) {
    const dup = await this.materials.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã vật chất ${dto.code}`);

    // Quyết định C: định danh vật chất PHẢI lấy từ danh mục chuẩn BQP (asset_catalog_items).
    // Ngoại lệ: vật chất ngành khác không có trong phụ lục ngành Doanh trại → OUT_OF_SCOPE.
    let assetCode: string | null = dto.assetCode ?? null;
    let assetCodeStatus = 'UNMAPPED';
    let name = dto.name;
    let unitCode: string | null = dto.unitCode ?? null;
    const attributes: Record<string, unknown> = { ...(dto.attributes ?? {}) };

    if (assetCode) {
      const item = await this.assetItems.findOne({ where: { code: assetCode, status: 'ACTIVE' } });
      if (!item) {
        throw new BadRequestException(
          `DATA-002: Mã "${assetCode}" không có trong danh mục chuẩn BQP (Phụ lục CV 2837).`,
        );
      }
      if (item.domain !== 'MATERIAL') {
        throw new BadRequestException(
          `DATA-002: Mã "${assetCode}" thuộc miền ${item.domain}, không phải vật chất (MATERIAL).`,
        );
      }
      assetCodeStatus = 'MAPPED';
      // Dẫn xuất tên/ĐVT/ngữ cảnh cây từ danh mục chuẩn (không phụ thuộc frontend gửi đủ).
      if (!name) name = item.name;
      if (!unitCode) unitCode = item.unitCode;
      attributes.assetPathNames = item.pathNames;
      attributes.chapter = item.chapter;
      attributes.chapterName = item.chapterName;
      attributes.unitRaw = item.unitRaw;
    } else if (dto.outOfScope) {
      assetCodeStatus = 'OUT_OF_SCOPE';
    } else {
      throw new BadRequestException(
        'DATA-002: Vật chất phải chọn từ danh mục chuẩn BQP. Nếu thuộc ngành khác, đánh dấu "Ngoài phạm vi ngành Doanh trại".',
      );
    }

    const saved = await this.materials.save(
      this.materials.create({
        code: dto.code,
        name,
        categoryCode: dto.categoryCode ?? null,
        unitCode,
        spec: dto.spec ?? null,
        qualityGrade: dto.qualityGrade ?? null,
        defaultScale: dto.defaultScale ?? 0,
        attributes,
        assetCode,
        assetCodeStatus,
        status: 'DRAFT',
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
    await this.snapshotMaterial(saved, 'CREATE', user.sub);
    return saved;
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto, user: AuthUser) {
    const m = await this.getMaterial(id);
    if (m.status === 'PUBLISHED') {
      throw new ConflictException('WF-001: Không sửa hồi tố vật chất đã phát hành');
    }
    if (dto.name !== undefined) m.name = dto.name;
    if (dto.categoryCode !== undefined) m.categoryCode = dto.categoryCode;
    if (dto.unitCode !== undefined) m.unitCode = dto.unitCode;
    if (dto.spec !== undefined) m.spec = dto.spec;
    if (dto.qualityGrade !== undefined) m.qualityGrade = dto.qualityGrade;
    if (dto.attributes !== undefined) m.attributes = dto.attributes;
    m.updatedBy = user.sub;
    const saved = await this.materials.save(m);
    await this.snapshotMaterial(saved, 'UPDATE', user.sub);
    return saved;
  }

  async publishMaterial(id: string, user: AuthUser) {
    const m = await this.getMaterial(id);
    if (m.status === 'PUBLISHED') {
      throw new ConflictException('WF-001: Vật chất đã phát hành');
    }
    m.status = 'PUBLISHED';
    m.version = (m.version ?? 1) + 1;
    m.updatedBy = user.sub;
    const saved = await this.materials.save(m);
    await this.snapshotMaterial(saved, 'PUBLISH', user.sub);
    return saved;
  }
}
