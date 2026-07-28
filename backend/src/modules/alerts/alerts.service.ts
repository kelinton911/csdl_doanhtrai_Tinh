import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Alert } from './alert.entity';
import { AlertStatus } from '../../common/workflow';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// M13 — Alert & Notification. UC-18: phát hiện, gom trùng, giao việc, đóng cảnh báo.
@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private readonly repo: Repository<Alert>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: { status?: string; severity?: string }) {
    const where: Record<string, string> = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { severity: 'DESC', createdAt: 'DESC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async summary() {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('a.status != :closed', { closed: AlertStatus.CLOSED })
      .groupBy('a.severity')
      .getRawMany();
    const bySeverity: Record<string, number> = {};
    let open = 0;
    for (const r of rows) { bySeverity[r.severity] = Number(r.count); open += Number(r.count); }
    return { open, bySeverity };
  }

  async assign(id: string, assigneeId: string | undefined, user: AuthUser) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('DATA-001: Không tìm thấy cảnh báo');
    if (a.status === AlertStatus.CLOSED) throw new ConflictException('WF-001: Cảnh báo đã đóng');
    a.assigneeId = assigneeId ?? user.sub;
    a.status = AlertStatus.ASSIGNED;
    if (!a.dueAt) a.dueAt = new Date(Date.now() + 3 * 24 * 3600 * 1000); // SLA 3 ngày
    return this.repo.save(a);
  }

  async close(id: string, resolution: string | undefined) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('DATA-001: Không tìm thấy cảnh báo');
    if (a.status === AlertStatus.CLOSED) throw new ConflictException('WF-001: Cảnh báo đã đóng');
    if (!resolution) throw new ConflictException('WF-002: Đóng cảnh báo phải có kết quả xử lý');
    a.status = AlertStatus.CLOSED;
    a.resolution = resolution;
    a.closedAt = new Date();
    return this.repo.save(a);
  }

  // Rule engine đơn giản: sinh cảnh báo từ dữ liệu hiện có, gom trùng theo (type, entity).
  async generate() {
    const found: Array<Partial<Alert>> = [];

    const poor = await this.ds.query(
      `SELECT f.id, f.name, b.name AS barracks FROM facilities f JOIN barracks b ON b.id=f.barracks_id
       WHERE f.condition='KEM' AND f.status='IN_USE' LIMIT 40`,
    );
    for (const r of poor) found.push({ alertType: 'FACILITY_POOR', severity: 'HIGH', title: `Công trình chất lượng kém: ${r.name}`, description: `Thuộc ${r.barracks}`, entityType: 'facility', entityId: r.id });

    const pending = await this.ds.query(
      `SELECT id, name FROM barracks WHERE workflow_status='PENDING_REVIEW' LIMIT 40`,
    );
    for (const r of pending) found.push({ alertType: 'BARRACKS_PENDING', severity: 'MEDIUM', title: `Hồ sơ chờ duyệt: ${r.name}`, entityType: 'barracks', entityId: r.id });

    const variance = await this.ds.query(
      `SELECT sb.id, m.name FROM stock_balances sb JOIN materials m ON m.id=sb.material_id
       WHERE sb.last_counted IS NOT NULL AND ABS(sb.last_counted - sb.on_hand) > 40 LIMIT 40`,
    );
    for (const r of variance) found.push({ alertType: 'INVENTORY_VARIANCE', severity: 'MEDIUM', title: `Chênh lệch kiểm kê lớn: ${r.name}`, entityType: 'stock_balance', entityId: r.id });

    let created = 0;
    for (const a of found) {
      const dup = await this.repo.findOne({ where: { alertType: a.alertType!, entityId: a.entityId ?? undefined, status: AlertStatus.OPEN } as never });
      if (dup) continue;
      await this.repo.save(this.repo.create({ ...a, status: AlertStatus.OPEN }));
      created++;
    }
    return { generated: created, scanned: found.length };
  }
}
