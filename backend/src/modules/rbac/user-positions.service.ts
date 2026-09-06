import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserPosition } from './entities/user-position.entity';
import { Position } from './entities/position.entity';
import {
  CreateUserPositionDto,
  EndUserPositionDto,
} from './dto/user-position.dto';
import { AuthorizationService } from './authorization.service';

// Bổ nhiệm/miễn nhiệm tài khoản vào chức vụ. Mọi thay đổi làm mới cache quyền của user.
@Injectable()
export class UserPositionsService {
  constructor(
    @InjectRepository(UserPosition)
    private readonly repo: Repository<UserPosition>,
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    private readonly authz: AuthorizationService,
  ) {}

  // Danh sách bổ nhiệm của một tài khoản (kèm tên chức vụ).
  async listByUser(userId: string) {
    const rows = await this.repo.find({
      where: { userId },
      order: { isPrimary: 'DESC', startDate: 'DESC' },
    });
    const positionIds = [...new Set(rows.map((r) => r.positionId))];
    const positions = positionIds.length
      ? await this.positions.find({ where: { id: In(positionIds) } })
      : [];
    const byId = new Map(positions.map((p) => [p.id, p]));
    return rows.map((r) => ({ ...r, position: byId.get(r.positionId) ?? null }));
  }

  async create(dto: CreateUserPositionDto) {
    const pos = await this.positions.findOne({ where: { id: dto.positionId } });
    if (!pos) throw new NotFoundException('DATA-001: Không tìm thấy chức vụ');

    // Nếu đặt làm chức vụ chính, gỡ cờ isPrimary của các bổ nhiệm khác đang hiệu lực.
    if (dto.isPrimary) {
      await this.repo.update(
        { userId: dto.userId, isActive: true },
        { isPrimary: false },
      );
    }

    const saved = await this.repo.save(
      this.repo.create({
        userId: dto.userId,
        positionId: dto.positionId,
        organizationId: dto.organizationId ?? null,
        isPrimary: dto.isPrimary ?? false,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        appointmentDoc: dto.appointmentDoc ?? null,
        notes: dto.notes ?? null,
        isActive: true,
      }),
    );
    this.authz.invalidate(dto.userId);
    return saved;
  }

  // Miễn nhiệm: đặt endDate + isActive=false (không xóa cứng).
  async end(id: string, dto: EndUserPositionDto) {
    const up = await this.repo.findOne({ where: { id } });
    if (!up) throw new NotFoundException('DATA-001: Không tìm thấy bổ nhiệm');
    up.endDate = dto.endDate ? new Date(dto.endDate) : new Date();
    up.isActive = false;
    up.isPrimary = false;
    await this.repo.save(up);
    this.authz.invalidate(up.userId);
    return { ok: true };
  }
}
