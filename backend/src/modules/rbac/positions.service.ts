import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Position } from './entities/position.entity';
import { PositionFunction } from './entities/position-function.entity';
import { AppFunction } from './entities/app-function.entity';
import { PermissionConflict } from './entities/permission-conflict.entity';
import {
  CreatePositionDto,
  SetPositionFunctionsDto,
  UpdatePositionDto,
} from './dto/position.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { ConflictSeverity } from './rbac.enums';
import { AuthorizationService } from './authorization.service';

// Quản lý chức vụ + ma trận phân quyền (position_functions), có kiểm tra SoD khi gán.
@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    @InjectRepository(PositionFunction)
    private readonly positionFunctions: Repository<PositionFunction>,
    @InjectRepository(AppFunction) private readonly functions: Repository<AppFunction>,
    @InjectRepository(PermissionConflict)
    private readonly conflicts: Repository<PermissionConflict>,
    private readonly authz: AuthorizationService,
  ) {}

  async list(q: PaginationQuery) {
    const [data, total] = await this.positions.findAndCount({
      order: { level: 'ASC', code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async get(id: string) {
    const p = await this.positions.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy chức vụ');
    return p;
  }

  async create(dto: CreatePositionDto) {
    const dup = await this.positions.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã chức vụ ${dto.code}`);
    return this.positions.save(
      this.positions.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        positionScope: dto.positionScope ?? 'UNIT',
        level: dto.level ?? 0,
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdatePositionDto) {
    const p = await this.get(id);
    if (dto.name !== undefined) p.name = dto.name;
    if (dto.description !== undefined) p.description = dto.description;
    if (dto.positionScope !== undefined) p.positionScope = dto.positionScope;
    if (dto.level !== undefined) p.level = dto.level;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
    return this.positions.save(p);
  }

  // Vô hiệu hóa (không xóa cứng) để giữ lịch sử bổ nhiệm.
  async deactivate(id: string) {
    const p = await this.get(id);
    p.isActive = false;
    await this.positions.save(p);
    this.authz.invalidateAll();
    return { ok: true };
  }

  // ----- Ma trận phân quyền -----

  // Danh sách chức năng đã gán cho chức vụ (kèm thông tin chức năng để hiển thị).
  async getFunctions(positionId: string) {
    await this.get(positionId);
    const pfs = await this.positionFunctions.find({ where: { positionId } });
    const ids = pfs.map((pf) => pf.functionId);
    const fns = ids.length
      ? await this.functions.find({ where: { id: In(ids) } })
      : [];
    const byId = new Map(fns.map((f) => [f.id, f]));
    return pfs.map((pf) => ({
      id: pf.id,
      functionId: pf.functionId,
      scope: pf.scope,
      isActive: pf.isActive,
      function: byId.get(pf.functionId) ?? null,
    }));
  }

  // Đặt lại toàn bộ ma trận cho chức vụ (thay thế). Kiểm tra SoD (BLOCK) trước khi lưu.
  async setFunctions(positionId: string, dto: SetPositionFunctionsDto) {
    await this.get(positionId);

    const functionIds = [...new Set(dto.functions.map((f) => f.functionId))];
    const fns = functionIds.length
      ? await this.functions.find({ where: { id: In(functionIds) } })
      : [];
    if (fns.length !== functionIds.length) {
      throw new BadRequestException('DATA-002: Có functionId không tồn tại');
    }

    // Kiểm tra SoD: tập mã chức năng sau khi gán không được chứa cặp BLOCK.
    const codes = new Set(fns.map((f) => f.code));
    const blocking = (await this.conflicts.find({ where: { isActive: true } })).filter(
      (c) => c.severity === ConflictSeverity.BLOCK,
    );
    for (const c of blocking) {
      if (codes.has(c.functionCodeA) && codes.has(c.functionCodeB)) {
        throw new ConflictException(
          `RBAC-SOD: Xung đột trách nhiệm giữa ${c.functionCodeA} và ${c.functionCodeB}`,
        );
      }
    }

    // Thay thế toàn bộ danh sách hiện tại.
    await this.positionFunctions.delete({ positionId });
    const rows = dto.functions.map((f) =>
      this.positionFunctions.create({
        positionId,
        functionId: f.functionId,
        scope: f.scope,
        isActive: true,
      }),
    );
    if (rows.length) await this.positionFunctions.save(rows);

    // Ma trận đổi → làm mới cache quyền của mọi user (đơn giản, an toàn).
    this.authz.invalidateAll();
    return { ok: true, count: rows.length };
  }
}
