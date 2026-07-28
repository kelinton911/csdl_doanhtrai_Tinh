import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility } from './entities/facility.entity';
import { Barracks } from '../barracks/entities/barracks.entity';
import {
  CreateFacilityDto,
  DecommissionDto,
  UpdateFacilityDto,
} from './dto/facility.dto';
import { FacilityStatus } from './facility-status';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// M05 — Facilities. UC-07: quản lý công trình và hạ tầng kỹ thuật.
@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility) private readonly repo: Repository<Facility>,
    @InjectRepository(Barracks)
    private readonly barracks: Repository<Barracks>,
  ) {}

  async listByBarracks(barracksId: string, q: PaginationQuery) {
    await this.ensureBarracks(barracksId);
    const [data, total] = await this.repo.findAndCount({
      where: { barracksId },
      order: { code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async get(id: string): Promise<Facility> {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('DATA-001: Không tìm thấy công trình');
    return f;
  }

  async create(
    barracksId: string,
    dto: CreateFacilityDto,
    user: AuthUser,
  ): Promise<Facility> {
    await this.ensureBarracks(barracksId);
    const dup = await this.repo.findOne({ where: { barracksId, code: dto.code } });
    if (dup) {
      throw new ConflictException(
        `DATA-003: Trùng mã công trình ${dto.code} trong doanh trại`,
      );
    }
    const entity = this.repo.create({
      barracksId,
      code: dto.code,
      name: dto.name,
      type: dto.type ?? null,
      area: (dto.area ?? 0).toString(),
      declaredCapacity: dto.declaredCapacity ?? 0,
      buildYear: dto.buildYear ?? null,
      condition: dto.condition ?? null,
      status: dto.status ?? FacilityStatus.IN_USE,
      location: dto.location ?? null,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateFacilityDto,
    user: AuthUser,
  ): Promise<Facility> {
    const f = await this.get(id);
    // Công trình đã ngừng khai thác không sửa trực tiếp.
    if (f.status === FacilityStatus.DECOMMISSIONED) {
      throw new ConflictException(
        'WF-001: Công trình đã ngừng khai thác, không thể sửa',
      );
    }
    if (dto.name !== undefined) f.name = dto.name;
    if (dto.type !== undefined) f.type = dto.type;
    if (dto.area !== undefined) f.area = dto.area.toString();
    if (dto.declaredCapacity !== undefined) f.declaredCapacity = dto.declaredCapacity;
    if (dto.buildYear !== undefined) f.buildYear = dto.buildYear;
    if (dto.condition !== undefined) f.condition = dto.condition;
    if (dto.status !== undefined) f.status = dto.status;
    if (dto.location !== undefined) f.location = dto.location;
    f.updatedBy = user.sub;
    return this.repo.save(f);
  }

  // UC-06 (backend §UC-06): ngừng khai thác thay cho xóa cứng.
  async decommission(
    id: string,
    _dto: DecommissionDto,
    user: AuthUser,
  ): Promise<Facility> {
    const f = await this.get(id);
    if (f.status === FacilityStatus.DECOMMISSIONED) {
      throw new ConflictException('WF-001: Công trình đã ở trạng thái ngừng khai thác');
    }
    f.status = FacilityStatus.DECOMMISSIONED;
    f.updatedBy = user.sub;
    return this.repo.save(f);
  }

  private async ensureBarracks(barracksId: string): Promise<void> {
    const exists = await this.barracks.existsBy({ id: barracksId });
    if (!exists) {
      throw new NotFoundException('DATA-001: Không tìm thấy doanh trại');
    }
  }
}
