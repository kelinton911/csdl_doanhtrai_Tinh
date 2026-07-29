import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Catalog } from './entities/catalog.entity';
import { Material } from './entities/material.entity';
import { MaterialVersion } from './entities/material-version.entity';
import {
  CreateCatalogDto,
  CreateMaterialDto,
  UpdateCatalogDto,
  UpdateMaterialDto,
} from './dto/master-data.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// M03 — Master Data. UC-03 (danh mục chung) + UC-07 (danh mục vật chất).
@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(Catalog) private readonly catalogs: Repository<Catalog>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(MaterialVersion) private readonly versions: Repository<MaterialVersion>,
  ) {}

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
    const saved = await this.materials.save(
      this.materials.create({
        code: dto.code,
        name: dto.name,
        categoryCode: dto.categoryCode ?? null,
        unitCode: dto.unitCode ?? null,
        spec: dto.spec ?? null,
        qualityGrade: dto.qualityGrade ?? null,
        defaultScale: dto.defaultScale ?? 0,
        attributes: dto.attributes ?? {},
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
