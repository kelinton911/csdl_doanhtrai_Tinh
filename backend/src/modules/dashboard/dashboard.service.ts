import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Tổng hợp số liệu cho dashboard chỉ huy (Frontend §6.2). Đọc trực tiếp CSDL.
// Báo cáo chính thức đọc snapshot (M12); dashboard là tổng quan thời gian thực.
@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async summary(mode?: string) {
    const m = ['NORMAL', 'SSCD', 'SCENARIO'].includes(mode ?? '') ? (mode as string) : 'NORMAL';
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

    // Cảnh báo trọng yếu đang mở (bảng có thể chưa tồn tại ở lần chạy đầu — bọc an toàn).
    let criticalAlerts = 0;
    try {
      const [al] = await this.ds.query(
        `SELECT COUNT(*)::int AS c FROM alerts WHERE status <> 'CLOSED' AND severity IN ('HIGH','CRITICAL')`,
      );
      criticalAlerts = al?.c ?? 0;
    } catch {
      criticalAlerts = 0;
    }

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

    // Chế độ hiển thị (Frontend §6.2): SSCĐ nhấn mức sẵn sàng; Tình huống giả định
    // đưa dữ liệu mô phỏng (scenario=true) vào tổng hợp, tách khỏi số liệu thực (NORMAL).
    if (m === 'SSCD') {
      const notReady = total - barracks.approved;
      if (notReady > 0)
        topIssues.unshift({ severity: 'warn', title: 'Hồ sơ chưa sẵn sàng chiến đấu (chưa duyệt)', count: notReady });
    } else if (m === 'SCENARIO') {
      try {
        const [sim] = await this.ds.query(
          `SELECT COUNT(*)::int AS c FROM damage_events WHERE scenario = true AND status <> 'RESOLVED'`,
        );
        if (sim?.c > 0) {
          topIssues.unshift({ severity: 'danger', title: 'Thiệt hại mô phỏng theo tình huống giả định', count: sim.c });
          criticalAlerts += sim.c;
        }
      } catch {
        /* bảng có thể chưa tồn tại — bỏ qua an toàn */
      }
    }

    return {
      mode: m,
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
      criticalAlerts,
      charts: {
        facilitiesByCondition: byCondition,
        barracksByStatus: byStatus,
      },
      topIssues,
    };
  }

  // Tổng hợp TIỀM LỰC hậu cần - kỹ thuật theo địa bàn (xã/phường/đặc khu): gom doanh trại,
  // công trình, sức chứa, diện tích, tồn kho về từng administrative_area. Dùng subquery theo
  // area để tránh nhân dòng khi join nhiều bảng.
  //
  // CHỈ tính DỮ LIỆU ĐÃ DUYỆT (workflow_status='APPROVED') vì tiềm lực là CƠ SỞ để cấp Tỉnh
  // quản lý/báo cáo/xây dựng kế hoạch bảo đảm — phải dùng dữ liệu sạch chỉ huy xã đã duyệt,
  // không lẫn hồ sơ nháp/chờ duyệt. Kho gắn địa bàn trực tiếp (area_id) HOẶC qua doanh trại.
  async potentialByArea() {
    const rows = await this.ds.query(`
      SELECT
        a.id, a.code, a.name, a.type,
        (SELECT COUNT(*) FROM barracks b WHERE b.area_id = a.id AND b.workflow_status = 'APPROVED')::int AS barracks_count,
        (SELECT COALESCE(SUM(b.declared_capacity), 0) FROM barracks b WHERE b.area_id = a.id AND b.workflow_status = 'APPROVED')::int AS capacity,
        (SELECT COALESCE(SUM(b.land_area), 0) FROM barracks b WHERE b.area_id = a.id AND b.workflow_status = 'APPROVED')::numeric AS land_area,
        (SELECT COUNT(*) FROM facilities f JOIN barracks b ON b.id = f.barracks_id
           WHERE b.area_id = a.id AND b.workflow_status = 'APPROVED')::int AS facility_count,
        (SELECT COUNT(*) FROM facilities f JOIN barracks b ON b.id = f.barracks_id
           WHERE b.area_id = a.id AND b.workflow_status = 'APPROVED' AND f.condition = 'KEM' AND f.status = 'IN_USE')::int AS poor_facilities,
        (SELECT COALESCE(SUM(sb.on_hand), 0) FROM stock_balances sb
           JOIN storage_locations sl ON sl.id = sb.storage_location_id
           LEFT JOIN barracks b2 ON b2.id = sl.barracks_id
           WHERE sl.workflow_status = 'APPROVED'
             AND (sl.area_id = a.id OR b2.area_id = a.id))::numeric AS stock_on_hand
      FROM administrative_areas a
      WHERE a.status = 'ACTIVE'
      ORDER BY a.code ASC
    `);

    // Tồn kho ở kho đã duyệt nhưng KHÔNG gắn địa bàn/doanh trại → không quy được về địa bàn.
    const [unallocated] = await this.ds.query(`
      SELECT COALESCE(SUM(sb.on_hand), 0)::numeric AS stock_on_hand
      FROM stock_balances sb
      JOIN storage_locations sl ON sl.id = sb.storage_location_id
      WHERE sl.workflow_status = 'APPROVED' AND sl.barracks_id IS NULL AND sl.area_id IS NULL
    `);

    return {
      generatedAt: new Date().toISOString(),
      areas: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        barracksCount: Number(r.barracks_count),
        capacity: Number(r.capacity),
        landArea: Number(r.land_area),
        facilityCount: Number(r.facility_count),
        poorFacilities: Number(r.poor_facilities),
        stockOnHand: Number(r.stock_on_hand),
      })),
      unallocatedStockOnHand: Number(unallocated?.stock_on_hand ?? 0),
    };
  }
}
