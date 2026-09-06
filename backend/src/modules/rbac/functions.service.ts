import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppFunction } from './entities/app-function.entity';
import { CreateFunctionDto, UpdateFunctionDto } from './dto/function.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

// Danh mục chức năng hạt mịn (RBAC). Chủ yếu do seed sinh; cho phép quản trị bổ sung.
@Injectable()
export class FunctionsService {
  constructor(
    @InjectRepository(AppFunction) private readonly repo: Repository<AppFunction>,
  ) {}

  async list(q: PaginationQuery, module?: string) {
    const [data, total] = await this.repo.findAndCount({
      where: module ? { module } : {},
      order: { module: 'ASC', code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  // Toàn bộ chức năng (không phân trang) để dựng ma trận phân quyền ở UI.
  async all() {
    return this.repo.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async create(dto: CreateFunctionDto) {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã chức năng ${dto.code}`);
    return this.repo.save(
      this.repo.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        module: dto.module,
        actionType: dto.actionType ?? 'VIEW',
        isCritical: dto.isCritical ?? false,
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdateFunctionDto) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('DATA-001: Không tìm thấy chức năng');
    if (dto.name !== undefined) f.name = dto.name;
    if (dto.description !== undefined) f.description = dto.description;
    if (dto.actionType !== undefined) f.actionType = dto.actionType;
    if (dto.isCritical !== undefined) f.isCritical = dto.isCritical;
    if (dto.isActive !== undefined) f.isActive = dto.isActive;
    return this.repo.save(f);
  }
}
