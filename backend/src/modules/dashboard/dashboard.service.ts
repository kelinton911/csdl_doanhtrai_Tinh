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

  // M15 — So sánh mức độ hoàn chỉnh & độ tươi hồ sơ doanh trại giữa các địa bàn cấp xã.
  // Điểm hoàn chỉnh mỗi hồ sơ = tỉ lệ 10 tiêu chí (tên/địa chỉ/địa bàn/đơn vị/sức chứa/
  // diện tích/công năng/toạ độ/có công trình/có ảnh). "Chưa cập nhật" = updated_at quá staleDays.
  async communeReadiness(staleDaysRaw?: string) {
    const staleDays = Math.min(Math.max(parseInt(staleDaysRaw ?? '90', 10) || 90, 1), 3650);
    const rows = await this.ds.query(
      `
      SELECT a.id, a.code, a.name, a.type,
        COUNT(b.id)::int AS barracks_count,
        COALESCE(ROUND(AVG(b.completeness))::int, 0) AS avg_completeness,
        COUNT(b.id) FILTER (WHERE b.completeness < 100)::int AS incomplete_count,
        COUNT(b.id) FILTER (WHERE b.updated_at < now() - make_interval(days => $1))::int AS stale_count,
        MAX(b.updated_at) AS last_updated
      FROM administrative_areas a
      LEFT JOIN (
        SELECT bx.id, bx.area_id, bx.updated_at,
          (
            ((bx.name IS NOT NULL AND bx.name <> ''))::int
            + ((bx.address IS NOT NULL AND bx.address <> ''))::int
            + (bx.area_id IS NOT NULL)::int
            + (bx.organization_id IS NOT NULL)::int
            + (bx.declared_capacity > 0)::int
            + (bx.land_area > 0)::int
            + ((bx.function IS NOT NULL AND bx.function <> ''))::int
            + (bx.location IS NOT NULL)::int
            + (EXISTS (SELECT 1 FROM facilities f WHERE f.barracks_id = bx.id))::int
            + (EXISTS (SELECT 1 FROM documents d WHERE d.entity_type = 'barracks' AND d.entity_id = bx.id::text))::int
          ) * 10 AS completeness
        FROM barracks bx
      ) b ON b.area_id = a.id
      WHERE a.status = 'ACTIVE' AND a.type IN ('COMMUNE', 'WARD', 'SPECIAL_ZONE')
      GROUP BY a.id, a.code, a.name, a.type
      ORDER BY (COUNT(b.id) = 0), avg_completeness ASC, stale_count DESC, a.code ASC
    `,
      [staleDays],
    );

    return {
      generatedAt: new Date().toISOString(),
      staleDays,
      areas: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        barracksCount: Number(r.barracks_count),
        avgCompleteness: Number(r.avg_completeness),
        incompleteCount: Number(r.incomplete_count),
        staleCount: Number(r.stale_count),
        lastUpdated: r.last_updated ?? null,
      })),
    };
  }

  // M23 — Toàn cảnh chỉ huy cấp tỉnh: tổng hợp trực quan mọi trụ cột (đất, công trình, điện/nước,
  // vật chất, đầu tư, ngân sách, cấp xã, nguồn lực, nhiệm vụ, kiểm tra, văn bản, cảnh báo).
  // Mỗi truy vấn bọc an toàn để bảng chưa tồn tại (deploy dở dang) không làm hỏng cả dashboard.
  async commandOverview() {
    const one = async (sql: string, params: unknown[] = []): Promise<Record<string, unknown>> => {
      try {
        const r = await this.ds.query(sql, params);
        return r?.[0] ?? {};
      } catch {
        return {};
      }
    };
    const many = async (sql: string): Promise<Array<Record<string, unknown>>> => {
      try {
        return await this.ds.query(sql);
      } catch {
        return [];
      }
    };
    const n = (v: unknown) => Number(v ?? 0);

    const [land, fac, barr, gen, mat, proj, disb, budY, res, tasks, insp, legal, al] = await Promise.all([
      one(`SELECT COUNT(*)::int total, COALESCE(SUM(land_area),0)::numeric area,
             COUNT(*) FILTER (WHERE dispute_status='DISPUTED')::int disputed,
             COUNT(*) FILTER (WHERE dispute_status='ENCROACHED')::int encroached FROM land_parcels`),
      one(`SELECT COUNT(*)::int total,
             COUNT(*) FILTER (WHERE condition IN ('GOOD','TOT') AND status='IN_USE')::int good,
             COUNT(*) FILTER (WHERE condition IN ('FAIR','KHA','TRUNG_BINH') AND status='IN_USE')::int fair,
             COUNT(*) FILTER (WHERE condition IN ('POOR','KEM') AND status='IN_USE')::int poor,
             COUNT(*) FILTER (WHERE status='DECOMMISSIONED')::int decommissioned FROM facilities`),
      one(`SELECT COUNT(*)::int total, COALESCE(SUM(declared_capacity),0)::int capacity,
             COUNT(*) FILTER (WHERE workflow_status='APPROVED')::int approved FROM barracks`),
      one(`SELECT COUNT(*) FILTER (WHERE kind='GENERATOR' AND status<>'DECOMMISSIONED')::int generators,
             COUNT(*) FILTER (WHERE kind='GENERATOR' AND status='FAULT')::int generators_fault,
             COUNT(*) FILTER (WHERE category='ELECTRICITY' AND status='FAULT')::int elec_fault,
             COUNT(*) FILTER (WHERE category='WATER' AND status='FAULT')::int water_fault,
             COUNT(*) FILTER (WHERE status<>'DECOMMISSIONED' AND next_maintenance_at IS NOT NULL AND next_maintenance_at<now())::int maintenance_due,
             COUNT(*) FILTER (WHERE category='ELECTRICITY' AND status<>'DECOMMISSIONED')::int elec_total,
             COUNT(*) FILTER (WHERE category='WATER' AND status<>'DECOMMISSIONED')::int water_total FROM utility_systems`),
      one(`SELECT COALESCE(SUM(sb.on_hand),0)::numeric on_hand FROM stock_balances sb
             JOIN storage_locations sl ON sl.id=sb.storage_location_id WHERE sl.workflow_status='APPROVED'`),
      one(`SELECT COUNT(*) FILTER (WHERE phase='IN_PROGRESS')::int in_progress,
             COUNT(*) FILTER (WHERE phase NOT IN ('HANDED_OVER','WARRANTY','CLOSED','CANCELLED') AND planned_end_date IS NOT NULL AND planned_end_date<now())::int delayed,
             COALESCE(SUM(total_estimate),0)::numeric total_estimate FROM projects`),
      one(`SELECT COALESCE(SUM(amount),0)::numeric disbursed FROM project_milestones WHERE kind='PAYMENT'`),
      one(`SELECT COALESCE(MAX(fiscal_year),0)::int AS y FROM budget_plans`),
      one(`SELECT COUNT(*) FILTER (WHERE status='ACTIVE')::int total,
             COUNT(*) FILTER (WHERE status='ACTIVE' AND agreement_status='SIGNED' AND agreement_valid_until IS NOT NULL AND agreement_valid_until<(now()+interval '30 days'))::int agreements_expiring FROM local_resources`),
      one(`SELECT COUNT(*) FILTER (WHERE status='IN_PROGRESS')::int in_progress,
             COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED') AND due_date IS NOT NULL AND due_date<now())::int overdue FROM tasks`),
      one(`SELECT (SELECT COUNT(*) FROM inspection_findings WHERE status NOT IN ('RESOLVED','ACCEPTED'))::int open_findings,
             (SELECT COUNT(*) FROM inspection_findings WHERE status NOT IN ('RESOLVED','ACCEPTED') AND due_date IS NOT NULL AND due_date<now())::int overdue_findings,
             (SELECT COUNT(*) FROM inspections WHERE status='IN_PROGRESS')::int in_progress`),
      one(`SELECT COUNT(*) FILTER (WHERE effective_status='EFFECTIVE')::int effective,
             COUNT(*) FILTER (WHERE effective_status='EFFECTIVE' AND expiry_date IS NOT NULL AND expiry_date<(now()+interval '60 days') AND expiry_date>=now())::int expiring_soon FROM legal_documents`),
      one(`SELECT COUNT(*) FILTER (WHERE status<>'CLOSED')::int open,
             COUNT(*) FILTER (WHERE status<>'CLOSED' AND severity IN ('HIGH','CRITICAL'))::int critical FROM alerts`),
    ]);

    const fyear = n(budY.y);
    const budPlanned = await one(`SELECT COALESCE(SUM(planned_amount),0)::numeric planned FROM budget_plans WHERE fiscal_year=$1`, [fyear]);
    const budSpent = await one(
      `SELECT COALESCE(SUM(e.amount),0)::numeric spent FROM budget_expenses e
       JOIN budget_plans p ON p.id=e.budget_plan_id WHERE p.fiscal_year=$1`,
      [fyear],
    );
    const communes = await one(
      `SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM barracks b WHERE b.area_id=a.id))::int with_data
       FROM administrative_areas a WHERE a.status='ACTIVE' AND a.type IN ('COMMUNE','WARD','SPECIAL_ZONE')`,
    );
    const alByType = await many(
      `SELECT alert_type AS type, COUNT(*)::int count FROM alerts WHERE status<>'CLOSED' GROUP BY alert_type ORDER BY count DESC LIMIT 12`,
    );

    const communeTotal = n(communes.total);
    const communeWith = n(communes.with_data);
    return {
      generatedAt: new Date().toISOString(),
      land: { total: n(land.total), totalArea: n(land.area), disputed: n(land.disputed), encroached: n(land.encroached) },
      facilities: { total: n(fac.total), good: n(fac.good), fair: n(fac.fair), poor: n(fac.poor), decommissioned: n(fac.decommissioned) },
      capacity: { barracks: n(barr.total), approved: n(barr.approved), totalCapacity: n(barr.capacity) },
      utilities: {
        electricity: { total: n(gen.elec_total), fault: n(gen.elec_fault) },
        water: { total: n(gen.water_total), fault: n(gen.water_fault) },
        generators: { total: n(gen.generators), fault: n(gen.generators_fault) },
        maintenanceDue: n(gen.maintenance_due),
      },
      materials: { onHand: n(mat.on_hand) },
      projects: { inProgress: n(proj.in_progress), delayed: n(proj.delayed), totalEstimate: n(proj.total_estimate), disbursed: n(disb.disbursed) },
      budget: { year: fyear, planned: n(budPlanned.planned), spent: n(budSpent.spent) },
      communes: { total: communeTotal, withData: communeWith, noData: Math.max(communeTotal - communeWith, 0) },
      localResources: { total: n(res.total), agreementsExpiring: n(res.agreements_expiring) },
      tasks: { inProgress: n(tasks.in_progress), overdue: n(tasks.overdue) },
      inspections: { inProgress: n(insp.in_progress), openFindings: n(insp.open_findings), overdueFindings: n(insp.overdue_findings) },
      legalDocs: { effective: n(legal.effective), expiringSoon: n(legal.expiring_soon) },
      alerts: { open: n(al.open), critical: n(al.critical), byType: alByType.map((r) => ({ type: r.type, count: n(r.count) })) },
    };
  }
}
