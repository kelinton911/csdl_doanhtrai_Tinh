import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import {
  AssignRolesDto,
  AssignScopesDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/user.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

// UC-02 — Quản lý người dùng, vai trò và phạm vi dữ liệu. Không xóa cứng: chỉ khóa.
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  private safe(u: User) {
    const { passwordHash: _drop, ...rest } = u;
    return rest;
  }

  async list(q: PaginationQuery) {
    const [data, total] = await this.repo.findAndCount({
      order: { username: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data.map((u) => this.safe(u)), total, q);
  }

  async get(id: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    return this.safe(u);
  }

  async create(dto: CreateUserDto) {
    const dup = await this.repo.findOne({ where: { username: dto.username } });
    if (dup) throw new ConflictException(`DATA-003: Trùng tên đăng nhập ${dto.username}`);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const saved = await this.repo.save(
      this.repo.create({
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        roles: dto.roles,
        organizationId: dto.organizationId ?? null,
        status: 'ACTIVE',
      }),
    );
    return this.safe(saved);
  }

  async update(id: string, dto: UpdateUserDto) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    if (dto.fullName !== undefined) u.fullName = dto.fullName;
    if (dto.status !== undefined) u.status = dto.status;
    if (dto.organizationId !== undefined) u.organizationId = dto.organizationId;
    return this.safe(await this.repo.save(u));
  }

  async assignRoles(id: string, dto: AssignRolesDto) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    u.roles = dto.roles;
    return this.safe(await this.repo.save(u));
  }

  async assignScopes(id: string, dto: AssignScopesDto) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    u.dataScopes = dto.scopes;
    return this.safe(await this.repo.save(u));
  }

  // UC-02: quản trị đặt lại mật khẩu và mở khóa tài khoản (không xóa cứng).
  async resetPassword(id: string, dto: ResetPasswordDto) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    u.passwordHash = await bcrypt.hash(dto.password, 10);
    u.failedAttempts = 0;
    u.lockedUntil = null;
    if (u.status === 'LOCKED') u.status = 'ACTIVE';
    await this.repo.save(u);
    return { ok: true, message: 'Đã đặt lại mật khẩu và mở khóa tài khoản.' };
  }
}
