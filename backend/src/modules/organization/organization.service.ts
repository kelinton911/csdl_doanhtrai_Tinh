import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { Organization } from '../identity/entities/organization.entity';
import { CreateAreaDto } from './dto/area.dto';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

// M02 — Organization & Area. UC-04: quản lý đơn vị và địa bàn (không có cấp huyện).
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(AdministrativeArea)
    private readonly areas: Repository<AdministrativeArea>,
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
  ) {}

  // ------- Xã/phường -------
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
    return this.areas.save(
      this.areas.create({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? 'COMMUNE',
        status: 'ACTIVE',
      }),
    );
  }

  // ------- Đơn vị -------
  async listOrganizations(q: PaginationQuery) {
    const [data, total] = await this.orgs.findAndCount({
      order: { code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const existing = await this.orgs.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`DATA-003: Trùng mã đơn vị ${dto.code}`);
    // Kiểm tra vòng lặp cây tổ chức (không cho parent trỏ về chính nó — sâu hơn ở lộ trình).
    return this.orgs.save(
      this.orgs.create({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? 'UNIT',
        parentId: dto.parentId ?? null,
        status: 'ACTIVE',
      }),
    );
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    const o = await this.orgs.findOne({ where: { id } });
    if (!o) throw new NotFoundException('DATA-001: Không tìm thấy đơn vị');
    if (dto.parentId === id) {
      throw new ConflictException('WF-001: Đơn vị không thể là cấp trên của chính nó');
    }
    if (dto.name !== undefined) o.name = dto.name;
    if (dto.type !== undefined) o.type = dto.type;
    if (dto.parentId !== undefined) o.parentId = dto.parentId;
    if (dto.status !== undefined) o.status = dto.status;
    return this.orgs.save(o);
  }
}
