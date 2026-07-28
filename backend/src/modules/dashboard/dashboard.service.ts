import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Tổng hợp số liệu cho dashboard chỉ huy (Frontend §6.2). Đọc trực tiếp CSDL.
// Báo cáo chính thức đọc snapshot (M12); dashboard là tổng quan thời gian thực.
@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async summary() {
    const [barracks] = await this.ds.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE workflow_status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE workflow_status = 'PENDING_REVIEW')::int AS pending,
        COUNT(*) FILTER (WHERE workflow_status = 'DRAFT')::int AS draft,
        COALESCE(SUM(declared_capacity), 0)::int AS capacity,
        COALESCE(SUM(land_area), 0)::numeric AS land_area
      FROM barracks
    `);
    const [facilities] = await this.ds.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'IN_USE')::int AS in_use,
        COUNT(*) FILTER (WHERE status = 'DECOMMISSIONED')::int AS decommissioned
      FROM facilities
    `);
    const byCondition = await this.ds.query(`
      SELECT COALESCE(condition, 'CHUA_DANH_GIA') AS condition, COUNT(*)::int AS count
      FROM facilities GROUP BY 1 ORDER BY 2 DESC
    `);
    const byStatus = await this.ds.query(`
      SELECT workflow_status AS status, COUNT(*)::int AS count
      FROM barracks GROUP BY 1
    `);
    const [materials] = await this.ds.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published
      FROM materials
    `);

    const total = barracks.total || 0;
    const dataConfirmedRatio = total ? Math.round((barracks.approved / total) * 100) : 0;

    // 5 vấn đề cần xử lý (Frontend §6.2) — suy ra từ dữ liệu.
    const topIssues: Array<{ severity: string; title: string; count: number }> = [];
    const [poor] = await this.ds.query(
      `SELECT COUNT(*)::int AS c FROM facilities WHERE condition = 'POOR' AND status = 'IN_USE'`,
    );
    if (poor.c > 0)
      topIssues.push({ severity: 'danger', title: 'Công trình chất lượng kém đang khai thác', count: poor.c });
    if (barracks.pending > 0)
      topIssues.push({ severity: 'warn', title: 'Hồ sơ doanh trại chờ kiểm duyệt', count: barracks.pending });
    if (barracks.draft > 0)
      topIssues.push({ severity: 'info', title: 'Hồ sơ doanh trại còn ở trạng thái nháp', count: barracks.draft });
    const [noFac] = await this.ds.query(
      `SELECT COUNT(*)::int AS c FROM barracks b WHERE NOT EXISTS (SELECT 1 FROM facilities f WHERE f.barracks_id = b.id)`,
    );
    if (noFac.c > 0)
      topIssues.push({ severity: 'warn', title: 'Doanh trại chưa khai báo công trình', count: noFac.c });

    return {
      generatedAt: new Date().toISOString(),
      barracks: {
        total,
        approved: barracks.approved,
        pending: barracks.pending,
        draft: barracks.draft,
        capacity: barracks.capacity,
        landArea: Number(barracks.land_area),
      },
      facilities: {
        total: facilities.total,
        inUse: facilities.in_use,
        decommissioned: facilities.decommissioned,
      },
      materials: { total: materials.total, published: materials.published },
      dataConfirmedRatio,
      criticalAlerts: 0,
      charts: {
        facilitiesByCondition: byCondition,
        barracksByStatus: byStatus,
      },
      topIssues,
    };
  }
}
