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

// Ngưỡng "chưa cập nhật" cho hồ sơ doanh trại (M15): mặc định 90 ngày.
const STALE_BARRACKS_DAYS = Number(process.env.BARRACKS_STALE_DAYS ?? 90);

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

    // M15 — Hồ sơ doanh trại (đặc biệt cấp xã) chưa cập nhật quá STALE_DAYS ngày.
    const stale = await this.ds.query(
      `SELECT b.id, b.name, a.name AS area FROM barracks b
       LEFT JOIN administrative_areas a ON a.id=b.area_id
       WHERE b.updated_at < now() - make_interval(days => $1) LIMIT 40`,
      [STALE_BARRACKS_DAYS],
    );
    for (const r of stale) found.push({ alertType: 'BARRACKS_STALE', severity: 'MEDIUM', title: `Hồ sơ chưa cập nhật > ${STALE_BARRACKS_DAYS} ngày: ${r.name}`, description: r.area ? `Địa bàn ${r.area}` : undefined, entityType: 'barracks', entityId: r.id });

    // M04 — Khu đất quốc phòng có tranh chấp/lấn chiếm (bảng có thể chưa tồn tại lần chạy đầu).
    try {
      const land = await this.ds.query(
        `SELECT p.id, p.name, p.dispute_status, a.name AS area FROM land_parcels p
         LEFT JOIN administrative_areas a ON a.id = p.area_id
         WHERE p.dispute_status IN ('DISPUTED','ENCROACHED') LIMIT 40`,
      );
      for (const r of land)
        found.push({
          alertType: 'LAND_DISPUTE',
          severity: 'HIGH',
          title: `Khu đất ${r.dispute_status === 'ENCROACHED' ? 'bị lấn chiếm' : 'có tranh chấp'}: ${r.name}`,
          description: r.area ? `Địa bàn ${r.area}` : undefined,
          entityType: 'land_parcel',
          entityId: r.id,
        });
    } catch {
      /* bảng chưa tồn tại — bỏ qua an toàn */
    }

    // M11 — Hạ tầng kỹ thuật: hỏng hóc (FAULT) hoặc quá hạn bảo dưỡng.
    try {
      const util = await this.ds.query(
        `SELECT u.id, u.name, u.category, u.status, u.next_maintenance_at, b.name AS barracks
         FROM utility_systems u LEFT JOIN barracks b ON b.id = u.barracks_id
         WHERE u.status = 'FAULT'
            OR (u.status <> 'DECOMMISSIONED' AND u.next_maintenance_at IS NOT NULL AND u.next_maintenance_at < now())
         LIMIT 40`,
      );
      for (const r of util) {
        const overdue = r.status !== 'FAULT';
        found.push({
          alertType: overdue ? 'UTILITY_MAINTENANCE_DUE' : 'UTILITY_FAULT',
          severity: overdue ? 'MEDIUM' : 'HIGH',
          title: overdue ? `Hạ tầng quá hạn bảo dưỡng: ${r.name}` : `Hạ tầng kỹ thuật hỏng: ${r.name}`,
          description: r.barracks ? `Thuộc ${r.barracks}` : undefined,
          entityType: 'utility_system',
          entityId: r.id,
        });
      }
    } catch {
      /* bảng chưa tồn tại — bỏ qua an toàn */
    }

    // M16 — Nguồn lực huy động: biên bản hiệp đồng hết/sắp hết hiệu lực (trong 30 ngày).
    try {
      const res = await this.ds.query(
        `SELECT r.id, r.name, r.agreement_valid_until, a.name AS area FROM local_resources r
         LEFT JOIN administrative_areas a ON a.id = r.area_id
         WHERE r.status = 'ACTIVE' AND r.agreement_status = 'SIGNED'
           AND r.agreement_valid_until IS NOT NULL
           AND r.agreement_valid_until < (now() + interval '30 days') LIMIT 40`,
      );
      for (const r of res) {
        const expired = new Date(r.agreement_valid_until) < new Date();
        found.push({
          alertType: 'RESOURCE_AGREEMENT_EXPIRING',
          severity: expired ? 'HIGH' : 'MEDIUM',
          title: `${expired ? 'Hiệp đồng hết hiệu lực' : 'Hiệp đồng sắp hết hiệu lực'}: ${r.name}`,
          description: [r.area ? `Địa bàn ${r.area}` : null, `Hạn ${String(r.agreement_valid_until).slice(0, 10)}`].filter(Boolean).join(' · '),
          entityType: 'local_resource',
          entityId: r.id,
        });
      }
    } catch {
      /* bảng chưa tồn tại — bỏ qua an toàn */
    }

    // M13 — Dự án XDCB: chậm tiến độ (quá hạn kế hoạch, chưa bàn giao) hoặc vượt dự toán/vốn.
    try {
      const proj = await this.ds.query(
        `SELECT p.id, p.name, p.planned_end_date, p.approved_capital, p.phase,
                (SELECT COALESCE(SUM(m.amount),0) FROM project_milestones m WHERE m.project_id = p.id AND m.kind='PAYMENT') AS disbursed
         FROM projects p
         WHERE p.phase NOT IN ('HANDED_OVER','WARRANTY','CLOSED','CANCELLED')
         LIMIT 60`,
      );
      for (const r of proj) {
        const delayed = r.planned_end_date && new Date(r.planned_end_date) < new Date();
        const overBudget = Number(r.approved_capital) > 0 && Number(r.disbursed) > Number(r.approved_capital);
        if (delayed) found.push({ alertType: 'PROJECT_DELAYED', severity: 'HIGH', title: `Dự án chậm tiến độ: ${r.name}`, description: `Hạn kế hoạch ${String(r.planned_end_date).slice(0, 10)}`, entityType: 'project', entityId: r.id });
        if (overBudget) found.push({ alertType: 'PROJECT_OVER_BUDGET', severity: 'HIGH', title: `Dự án vượt vốn được duyệt: ${r.name}`, entityType: 'project', entityId: r.id });
      }
    } catch {
      /* bảng chưa tồn tại — bỏ qua an toàn */
    }

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
