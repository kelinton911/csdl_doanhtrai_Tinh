import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { Organization } from '../identity/entities/organization.entity';
import { CreateAreaDto, ListAreaQuery } from './dto/area.dto';
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
  // Hỗ trợ lọc theo cấp (PROVINCE/COMMUNE), theo tỉnh (provinceCode) và tìm kiếm mã/tên
  // để form doanh trại dựng cascade Tỉnh → Xã (không còn trộn lẫn các cấp trong 1 danh sách).
  async listAreas(q: ListAreaQuery) {
    // Bộ lọc chung (cấp/tỉnh) áp cho mọi nhánh; tìm kiếm là OR trên mã và tên.
    const base: FindOptionsWhere<AdministrativeArea> = {};
    if (q.level) base.level = q.level;
    if (q.provinceCode) base.provinceCode = q.provinceCode;
    const where: FindOptionsWhere<AdministrativeArea> | FindOptionsWhere<AdministrativeArea>[] =
      q.search
        ? [
            { ...base, code: ILike(`%${q.search}%`) },
            { ...base, name: ILike(`%${q.search}%`) },
          ]
        : base;
    const [data, total] = await this.areas.findAndCount({
      where,
      // PROVINCE trước COMMUNE, sau đó theo mã để danh sách ổn định.
      order: { level: 'DESC', code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  // Chi tiết 1 địa bàn (dùng cho ô chọn xã hiển thị nhãn + suy ra tỉnh khi sửa hồ sơ).
  async getArea(id: string) {
    const a = await this.areas.findOne({ where: { id } });
    if (!a) throw new NotFoundException('DATA-001: Không tìm thấy địa bàn');
    return a;
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
