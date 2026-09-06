import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionConflict } from './entities/permission-conflict.entity';
import { CreateConflictDto, UpdateConflictDto } from './dto/conflict.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

// Danh mục xung đột tách biệt trách nhiệm (SoD).
@Injectable()
export class ConflictsService {
  constructor(
    @InjectRepository(PermissionConflict)
    private readonly repo: Repository<PermissionConflict>,
  ) {}

  async list(q: PaginationQuery) {
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  // Toàn bộ cặp xung đột đang hiệu lực (dùng khi kiểm tra gán ma trận).
  async activePairs() {
    return this.repo.find({ where: { isActive: true } });
  }

  async create(dto: CreateConflictDto) {
    const [a, b] = [dto.functionCodeA, dto.functionCodeB].sort();
    const dup = await this.repo.findOne({
      where: { functionCodeA: a, functionCodeB: b },
    });
    if (dup) throw new ConflictException('DATA-003: Cặp xung đột đã tồn tại');
    return this.repo.save(
      this.repo.create({
        functionCodeA: a,
        functionCodeB: b,
        description: dto.description ?? null,
        severity: dto.severity ?? 'BLOCK',
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdateConflictDto) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy khai báo xung đột');
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.severity !== undefined) c.severity = dto.severity;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.repo.save(c);
  }

  async remove(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy khai báo xung đột');
    await this.repo.delete({ id });
    return { ok: true };
  }
}
