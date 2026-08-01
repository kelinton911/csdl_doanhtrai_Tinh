import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// M28 — Phân tích & phát hiện bất thường (read-only, heuristic trên dữ liệu thật):
// dự báo xuống cấp công trình, tiêu thụ điện/nước bất thường, xếp ưu tiên đầu tư,
// quét chất lượng/bất thường dữ liệu. Không lưu trạng thái, không migration.
@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private band(score: number): string {
    return score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
  }

  // Dự báo xuống cấp: điểm rủi ro theo tuổi công trình + tình trạng hiện tại.
  async degradation(limit = 30) {
    const rows = await this.ds.query(
      `SELECT f.id, f.code, f.name, f.build_year AS "buildYear", f.condition,
              b.id AS "barracksId", b.name AS "barracksName",
              (CASE WHEN f.condition IN ('POOR','KEM') THEN 55
                    WHEN f.condition IN ('FAIR','TRUNG_BINH','KHA') THEN 30 ELSE 10 END
               + LEAST(GREATEST(EXTRACT(YEAR FROM now())::int - COALESCE(f.build_year, EXTRACT(YEAR FROM now())::int), 0), 60) * 45 / 60)::int AS risk_score,
              GREATEST(EXTRACT(YEAR FROM now())::int - COALESCE(f.build_year, EXTRACT(YEAR FROM now())::int), 0) AS age
       FROM facilities f LEFT JOIN barracks b ON b.id = f.barracks_id
       WHERE f.status = 'IN_USE'
       ORDER BY risk_score DESC, age DESC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 100)],
    );
    return {
      generatedAt: new Date().toISOString(),
      items: rows.map((r: Record<string, unknown>) => ({
        id: r.id, code: r.code, name: r.name, buildYear: r.buildYear, condition: r.condition,
        barracksId: r.barracksId, barracksName: r.barracksName,
        age: Number(r.age), riskScore: Number(r.risk_score), band: this.band(Number(r.risk_score)),
      })),
    };
  }

  // Tiêu thụ điện/nước bất thường: kỳ mới nhất lệch >= 40% so với trung bình các kỳ trước.
  async consumptionAnomalies(threshold = 40) {
    const rows = await this.ds.query(
      `WITH r AS (
         SELECT ur.utility_system_id, ur.consumption, ur.reading_date,
                ROW_NUMBER() OVER (PARTITION BY ur.utility_system_id ORDER BY ur.reading_date DESC) rn
         FROM utility_readings ur WHERE ur.consumption IS NOT NULL
       )
       SELECT s.id, s.code, s.name, s.category,
              (SELECT consumption FROM r WHERE r.utility_system_id = s.id AND rn = 1) AS latest,
              (SELECT AVG(consumption) FROM r WHERE r.utility_system_id = s.id AND rn > 1) AS avg_prev
       FROM utility_systems s
       WHERE s.status <> 'DECOMMISSIONED'
         AND EXISTS (SELECT 1 FROM r WHERE r.utility_system_id = s.id AND rn = 1)
         AND EXISTS (SELECT 1 FROM r WHERE r.utility_system_id = s.id AND rn > 1)`,
    );
    const items = rows
      .map((r: Record<string, unknown>) => {
        const latest = Number(r.latest);
        const avgPrev = Number(r.avg_prev);
        const deviation = avgPrev > 0 ? Math.round(((latest - avgPrev) / avgPrev) * 100) : 0;
        return { id: r.id, code: r.code, name: r.name, category: r.category, latest, avgPrev: Math.round(avgPrev), deviation };
      })
      .filter((x: { deviation: number }) => Math.abs(x.deviation) >= threshold)
      .sort((a: { deviation: number }, b: { deviation: number }) => Math.abs(b.deviation) - Math.abs(a.deviation));
    return { generatedAt: new Date().toISOString(), threshold, items };
  }

  // Xếp ưu tiên đầu tư/sửa chữa: gộp công trình kém, doanh trại nhiều CT kém, dự án chậm/vượt vốn, đất tranh chấp.
  async priorities() {
    const safe = async (sql: string) => { try { return await this.ds.query(sql); } catch { return []; } };
    const items: Array<{ kind: string; refId: string; title: string; detail: string; score: number; route: string }> = [];

    const poorFac = await safe(
      `SELECT f.id, f.name, b.id AS barracks_id, b.name AS barracks_name FROM facilities f
       LEFT JOIN barracks b ON b.id = f.barracks_id
       WHERE f.status='IN_USE' AND f.condition IN ('POOR','KEM') LIMIT 40`,
    );
    for (const r of poorFac) items.push({ kind: 'FACILITY_POOR', refId: r.id, title: `Sửa chữa công trình: ${r.name}`, detail: r.barracks_name ?? '', score: 80, route: r.barracks_id ? `/barracks/${r.barracks_id}` : '/barracks' });

    const delayed = await safe(
      `SELECT id, name, planned_end_date FROM projects
       WHERE phase NOT IN ('HANDED_OVER','WARRANTY','CLOSED','CANCELLED')
         AND planned_end_date IS NOT NULL AND planned_end_date < now() LIMIT 40`,
    );
    for (const r of delayed) items.push({ kind: 'PROJECT_DELAYED', refId: r.id, title: `Đẩy nhanh dự án chậm: ${r.name}`, detail: `Hạn ${String(r.planned_end_date).slice(0, 10)}`, score: 75, route: `/projects/${r.id}` });

    const land = await safe(
      `SELECT id, name, dispute_status FROM land_parcels WHERE dispute_status IN ('DISPUTED','ENCROACHED') LIMIT 40`,
    );
    for (const r of land) items.push({ kind: 'LAND_DISPUTE', refId: r.id, title: `Xử lý ${r.dispute_status === 'ENCROACHED' ? 'lấn chiếm' : 'tranh chấp'} đất: ${r.name}`, detail: '', score: 85, route: `/land-parcels/${r.id}` });

    const util = await safe(
      `SELECT id, name FROM utility_systems WHERE status='FAULT' LIMIT 40`,
    );
    for (const r of util) items.push({ kind: 'UTILITY_FAULT', refId: r.id, title: `Khắc phục hạ tầng hỏng: ${r.name}`, detail: '', score: 78, route: `/utilities/${r.id}` });

    items.sort((a, b) => b.score - a.score);
    return { generatedAt: new Date().toISOString(), items: items.slice(0, 60) };
  }

  // Quét chất lượng/bất thường dữ liệu: các bản ghi thiếu/không nhất quán cần rà soát.
  async dataQuality() {
    const cnt = async (sql: string): Promise<number> => {
      try {
        const r = await this.ds.query(sql);
        return Number(r?.[0]?.c ?? 0);
      } catch {
        return 0;
      }
    };
    const [
      barracksNoLocation, barracksNoCapacity, barracksNoFacility,
      facilityNoArea, landNoLegal, budgetOverspent, resourceExpired,
      communeNoData,
    ] = await Promise.all([
      cnt(`SELECT COUNT(*)::int c FROM barracks WHERE location IS NULL`),
      cnt(`SELECT COUNT(*)::int c FROM barracks WHERE declared_capacity = 0`),
      cnt(`SELECT COUNT(*)::int c FROM barracks b WHERE NOT EXISTS (SELECT 1 FROM facilities f WHERE f.barracks_id=b.id)`),
      cnt(`SELECT COUNT(*)::int c FROM facilities WHERE status='IN_USE' AND (area IS NULL OR area = 0)`),
      cnt(`SELECT COUNT(*)::int c FROM land_parcels WHERE legal_status IN ('PENDING','NONE')`),
      cnt(`SELECT COUNT(*)::int c FROM budget_plans p WHERE p.status='APPROVED' AND p.planned_amount>0 AND (SELECT COALESCE(SUM(e.amount),0) FROM budget_expenses e WHERE e.budget_plan_id=p.id) > p.planned_amount`),
      cnt(`SELECT COUNT(*)::int c FROM local_resources WHERE status='ACTIVE' AND agreement_status='SIGNED' AND agreement_valid_until IS NOT NULL AND agreement_valid_until < now()`),
      cnt(`SELECT COUNT(*)::int c FROM administrative_areas a WHERE a.status='ACTIVE' AND a.type IN ('COMMUNE','WARD','SPECIAL_ZONE') AND NOT EXISTS (SELECT 1 FROM barracks b WHERE b.area_id=a.id)`),
    ]);
    const issues = [
      { key: 'BARRACKS_NO_LOCATION', label: 'Doanh trại chưa gắn tọa độ', count: barracksNoLocation, route: '/barracks', tone: 'warn' },
      { key: 'BARRACKS_NO_CAPACITY', label: 'Doanh trại chưa khai báo sức chứa', count: barracksNoCapacity, route: '/barracks', tone: 'warn' },
      { key: 'BARRACKS_NO_FACILITY', label: 'Doanh trại chưa có công trình', count: barracksNoFacility, route: '/barracks', tone: 'warn' },
      { key: 'FACILITY_NO_AREA', label: 'Công trình đang KT thiếu diện tích', count: facilityNoArea, route: '/barracks', tone: 'warn' },
      { key: 'LAND_NO_LEGAL', label: 'Khu đất chưa đủ hồ sơ pháp lý', count: landNoLegal, route: '/land-parcels', tone: 'danger' },
      { key: 'BUDGET_OVERSPENT', label: 'Dự toán đã vượt chi', count: budgetOverspent, route: '/budgets', tone: 'danger' },
      { key: 'RESOURCE_AGREEMENT_EXPIRED', label: 'Nguồn lực có hiệp đồng hết hiệu lực', count: resourceExpired, route: '/local-resources', tone: 'danger' },
      { key: 'COMMUNE_NO_DATA', label: 'Xã/phường chưa có hồ sơ doanh trại', count: communeNoData, route: '/commune-readiness', tone: 'warn' },
    ];
    return { generatedAt: new Date().toISOString(), issues, totalIssues: issues.reduce((s, i) => s + i.count, 0) };
  }

  async overview() {
    const [deg, anom, prio, dq] = await Promise.all([
      this.degradation(200),
      this.consumptionAnomalies(40),
      this.priorities(),
      this.dataQuality(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      highRiskFacilities: deg.items.filter((i: { band: string }) => i.band === 'HIGH').length,
      consumptionAnomalies: anom.items.length,
      priorityItems: prio.items.length,
      dataQualityIssues: dq.totalIssues,
    };
  }
}
