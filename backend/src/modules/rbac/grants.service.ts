import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPermissionGrant } from './entities/user-permission-grant.entity';
import { CreateGrantDto, RevokeGrantDto } from './dto/grant.dto';
import { AuthorizationService } from './authorization.service';

// Cấp/thu hồi quyền lẻ cho tài khoản. Mọi thay đổi làm mới cache quyền của user.
@Injectable()
export class GrantsService {
  constructor(
    @InjectRepository(UserPermissionGrant)
    private readonly repo: Repository<UserPermissionGrant>,
    private readonly authz: AuthorizationService,
  ) {}

  async listByUser(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { grantedAt: 'DESC' },
    });
  }

  async create(dto: CreateGrantDto, grantedById: string) {
    const saved = await this.repo.save(
      this.repo.create({
        userId: dto.userId,
        functionCode: dto.functionCode,
        scope: dto.scope,
        organizationId: dto.organizationId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reason: dto.reason ?? null,
        grantedById,
        grantedAt: new Date(),
        isRevoked: false,
      }),
    );
    this.authz.invalidate(dto.userId);
    return saved;
  }

  async revoke(id: string, dto: RevokeGrantDto, revokedById: string) {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('DATA-001: Không tìm thấy quyền cấp lẻ');
    g.isRevoked = true;
    g.revokedAt = new Date();
    g.revokedById = revokedById;
    g.revokedReason = dto.reason ?? null;
    await this.repo.save(g);
    this.authz.invalidate(g.userId);
    return { ok: true };
  }
}
