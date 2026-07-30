import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Catalog } from './entities/catalog.entity';
import { Material } from './entities/material.entity';
import { MaterialVersion } from './entities/material-version.entity';
import {
  CreateMaterialGroupDto,
  MoveMaterialDto,
  UpdateMaterialGroupDto,
} from './dto/material-group.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Quản lý NHÓM VẬT CHẤT (catalogs type='material-category') — cây ngành → nhóm con,
// CRUD (sửa được cả nhóm BQP đã phát hành, đánh dấu user_edited để seeder không ghi đè),
// liên thông với vật chất trực thuộc (xem/chuyển nhóm), chặn xoá khi còn ràng buộc.
const TYPE = 'material-category';

export interface GroupNode {
  id: string;
  code: string;
  name: string;
  ordinal: string | null;
  origin: string;
  userEdited: boolean;
  parentCode: string | null;
  sortOrder: number;
  status: string;
  description: string | null;
  materialCount: number; // vật chất trực thuộc (categoryCode = code)
  totalMaterialCount: number; // gộp cả nhánh con
  childCount: number;
  children: GroupNode[];
}

@Injectable()
export class MaterialGroupService {
  constructor(
    @InjectRepository(Catalog) private readonly catalogs: Repository<Catalog>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(MaterialVersion) private readonly versions: Repository<MaterialVersion>,
  ) {}

  private view(c: Catalog): Omit<GroupNode, 'children' | 'materialCount' | 'totalMaterialCount' | 'childCount'> {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      ordinal: c.ordinal,
      origin: c.origin,
      userEdited: c.userEdited,
      parentCode: c.parentCode,
      sortOrder: c.sortOrder,
      status: c.status,
      description: c.description,
    };
  }

  // Cây nhóm + đếm vật chất trực thuộc + gộp theo nhánh. Nút có parent không tồn tại
  // (mã cha trỏ ra ngoài loại này) được coi là gốc để không mất nhánh.
  async tree(): Promise<GroupNode[]> {
    const rows = await this.catalogs.find({
      where: { type: TYPE },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });

    const counts = await this.materials
      .createQueryBuilder('m')
      .select('m.category_code', 'code')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.category_code IS NOT NULL')
      .groupBy('m.category_code')
      .getRawMany<{ code: string; cnt: string }>();
    const countByCode = new Map(counts.map((c) => [c.code, Number(c.cnt)]));

    const byCode = new Map<string, GroupNode>();
    for (const r of rows) {
      byCode.set(r.code, {
        ...this.view(r),
        materialCount: countByCode.get(r.code) ?? 0,
        totalMaterialCount: 0,
        childCount: 0,
        children: [],
      });
    }

    const roots: GroupNode[] = [];
    for (const node of byCode.values()) {
      const parent = node.parentCode ? byCode.get(node.parentCode) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    const rollup = (n: GroupNode): number => {
      let total = n.materialCount;
      for (const child of n.children) total += rollup(child);
      n.totalMaterialCount = total;
      n.childCount = n.children.length;
      return total;
    };
    roots.forEach(rollup);
    return roots;
  }

  private async getOne(id: string): Promise<Catalog> {
    const c = await this.catalogs.findOne({ where: { id, type: TYPE } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy nhóm vật chất');
    return c;
  }

  async detail(id: string) {
    const c = await this.getOne(id);
    const materialCount = await this.materials.count({ where: { categoryCode: c.code } });
    const childCount = await this.catalogs.count({ where: { type: TYPE, parentCode: c.code } });
    return { ...this.view(c), materialCount, childCount };
  }

  async create(dto: CreateMaterialGroupDto, user: AuthUser) {
    const code = (dto.code?.trim() || `GRP-${randomBytes(4).toString('hex').toUpperCase()}`).slice(0, 40);
    const dup = await this.catalogs.findOne({ where: { type: TYPE, code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã nhóm "${code}"`);
    if (dto.parentCode) {
      const parent = await this.catalogs.findOne({ where: { type: TYPE, code: dto.parentCode } });
      if (!parent) throw new BadRequestException(`DATA-001: Nhóm cha "${dto.parentCode}" không tồn tại`);
    }
    return this.catalogs.save(
      this.catalogs.create({
        type: TYPE,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        ordinal: dto.ordinal?.trim() || null,
        parentCode: dto.parentCode || null,
        sortOrder: dto.sortOrder ?? 0,
        origin: 'LOCAL',
        userEdited: true,
        status: 'PUBLISHED',
        effectiveFrom: new Date(),
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async update(id: string, dto: UpdateMaterialGroupDto, user: AuthUser) {
    const c = await this.getOne(id);
    if (dto.parentCode !== undefined) {
      const next = dto.parentCode || null;
      if (next === c.code) throw new BadRequestException('VAL-001: Nhóm không thể tự làm cha của chính nó');
      if (next) {
        const parent = await this.catalogs.findOne({ where: { type: TYPE, code: next } });
        if (!parent) throw new BadRequestException(`DATA-001: Nhóm cha "${next}" không tồn tại`);
        await this.assertNoCycle(c.code, next);
      }
      c.parentCode = next;
    }
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.ordinal !== undefined) c.ordinal = dto.ordinal?.trim() || null;
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) c.status = dto.status;
    // Đánh dấu đã sửa tay → seeder BQP sẽ KHÔNG ghi đè tên/mô tả lần chạy sau.
    c.userEdited = true;
    c.updatedBy = user.sub;
    return this.catalogs.save(c);
  }

  // Ngăn tạo vòng: đi ngược từ nhóm cha mới lên gốc, gặp lại chính nó là vòng.
  private async assertNoCycle(code: string, newParentCode: string) {
    let cursor: string | null = newParentCode;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === code) {
        throw new BadRequestException('VAL-002: Di chuyển tạo vòng lặp cha-con');
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const parent: Catalog | null = await this.catalogs.findOne({
        where: { type: TYPE, code: cursor },
        select: { parentCode: true },
      });
      cursor = parent?.parentCode ?? null;
    }
  }

  async remove(id: string) {
    const c = await this.getOne(id);
    const materialCount = await this.materials.count({ where: { categoryCode: c.code } });
    if (materialCount > 0) {
      throw new ConflictException(
        `WF-001: Nhóm còn ${materialCount} vật chất trực thuộc — chuyển vật chất sang nhóm khác trước khi xoá`,
      );
    }
    const childCount = await this.catalogs.count({ where: { type: TYPE, parentCode: c.code } });
    if (childCount > 0) {
      throw new ConflictException(
        `WF-001: Nhóm còn ${childCount} nhóm con — xoá hoặc di chuyển nhóm con trước`,
      );
    }
    await this.catalogs.delete(id);
    return { deleted: true };
  }

  // Vật chất trực thuộc một nhóm (theo categoryCode = mã nhóm).
  async materialsInGroup(id: string, q: PaginationQuery, search?: string) {
    const c = await this.getOne(id);
    const qb = this.materials
      .createQueryBuilder('m')
      .where('m.category_code = :code', { code: c.code })
      .orderBy('m.code', 'ASC')
      .skip(q.skip)
      .take(q.size);
    if (search) qb.andWhere('(m.code ILIKE :s OR m.name ILIKE :s)', { s: `%${search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { group: this.view(c), ...paginated(data, total, q) };
  }

  // Chuyển một vật chất sang nhóm khác — đổi categoryCode (cho phép cả vật chất đã phát
  // hành: đây là phân loại lại, không phải sửa hồi tố thông số). Ghi lịch sử phiên bản.
  async moveMaterial(dto: MoveMaterialDto, user: AuthUser) {
    const m = await this.materials.findOne({ where: { id: dto.materialId } });
    if (!m) throw new NotFoundException('DATA-001: Không tìm thấy vật chất');
    const target = await this.catalogs.findOne({
      where: { type: TYPE, code: dto.targetGroupCode },
    });
    if (!target) {
      throw new BadRequestException(`DATA-001: Nhóm đích "${dto.targetGroupCode}" không tồn tại`);
    }
    const from = m.categoryCode;
    m.categoryCode = target.code;
    m.updatedBy = user.sub;
    const saved = await this.materials.save(m);
    const count = await this.versions.count({ where: { materialId: m.id } });
    await this.versions.save(
      this.versions.create({
        materialId: m.id,
        version: count + 1,
        changeType: 'MOVE_GROUP',
        snapshot: {
          code: m.code,
          name: m.name,
          categoryCode: m.categoryCode,
          previousCategoryCode: from,
          unitCode: m.unitCode,
          status: m.status,
        },
        createdBy: user.sub,
      }),
    );
    return saved;
  }
}
