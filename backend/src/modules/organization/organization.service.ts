import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { CreateAreaDto } from './dto/area.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

// M02 — Organization & Area. UC-04: quản lý đơn vị và địa bàn.
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(AdministrativeArea)
    private readonly areas: Repository<AdministrativeArea>,
  ) {}

  async listAreas(q: PaginationQuery) {
    const [data, total] = await this.areas.findAndCount({
      order: { code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async createArea(dto: CreateAreaDto) {
    const existing = await this.areas.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`DATA-003: Trùng mã địa bàn ${dto.code}`);
    }
    const area = this.areas.create({
      code: dto.code,
      name: dto.name,
      type: dto.type ?? 'COMMUNE',
      status: 'ACTIVE',
    });
    return this.areas.save(area);
  }
}
