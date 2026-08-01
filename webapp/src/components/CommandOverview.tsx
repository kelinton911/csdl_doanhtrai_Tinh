import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon, type IconName } from './Icon';
import { Skeleton, ErrorState } from './States';
import { num, currency } from '../lib/format';

interface Overview {
  generatedAt: string;
  land: { total: number; totalArea: number; disputed: number; encroached: number };
  facilities: { total: number; good: number; fair: number; poor: number; decommissioned: number };
  capacity: { barracks: number; approved: number; totalCapacity: number };
  utilities: { electricity: { total: number; fault: number }; water: { total: number; fault: number }; generators: { total: number; fault: number }; maintenanceDue: number };
  materials: { onHand: number };
  projects: { inProgress: number; delayed: number; totalEstimate: number; disbursed: number };
  budget: { year: number; planned: number; spent: number };
  communes: { total: number; withData: number; noData: number };
  localResources: { total: number; agreementsExpiring: number };
  tasks: { inProgress: number; overdue: number };
  inspections: { inProgress: number; openFindings: number; overdueFindings: number };
  legalDocs: { effective: number; expiringSoon: number };
  alerts: { open: number; critical: number; byType: Array<{ type: string; count: number }> };
}

const ALERT_TYPE_LABEL: Record<string, string> = {
  FACILITY_POOR: 'Công trình chất lượng kém', BARRACKS_PENDING: 'Hồ sơ chờ duyệt', INVENTORY_VARIANCE: 'Chênh lệch kiểm kê',
  BARRACKS_STALE: 'Hồ sơ xã chưa cập nhật', LAND_DISPUTE: 'Tranh chấp/lấn chiếm đất', UTILITY_FAULT: 'Hạ tầng KT hỏng',
  UTILITY_MAINTENANCE_DUE: 'Hạ tầng quá hạn bảo dưỡng', RESOURCE_AGREEMENT_EXPIRING: 'Hiệp đồng sắp hết hạn',
  PROJECT_DELAYED: 'Dự án chậm tiến độ', PROJECT_OVER_BUDGET: 'Dự án vượt vốn', BUDGET_OVERSPENT: 'Dự toán vượt chi',
  TASK_OVERDUE: 'Nhiệm vụ quá hạn', FINDING_OVERDUE: 'Kiến nghị quá hạn', LEGALDOC_EXPIRING: 'Văn bản sắp hết hiệu lực',
};

// M23 — Toàn cảnh điều hành toàn tỉnh: tổng hợp trực quan mọi trụ cột cho người chỉ huy.
export function CommandOverview() {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['dashboard-command'],
    queryFn: async () => (await api.get<Overview>('/dashboard/command')).data,
    refetchInterval: 90_000,
  });

  if (q.isLoading) return <div style={{ marginTop: 20 }}><Skeleton rows={4} /></div>;
  if (q.isError || !q.data) return <div style={{ marginTop: 20 }}><ErrorState error={q.error} /></div>;
  const d = q.data;
  const facGoodPct = d.facilities.total ? Math.round((d.facilities.good / d.facilities.total) * 100) : 0;
  const disbPct = d.budget.planned ? Math.round((d.budget.spent / d.budget.planned) * 100) : 0;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div className="eyebrow" style={{ fontSize: 12.5 }}>Toàn cảnh điều hành toàn tỉnh</div>
        <span className="muted" style={{ fontSize: 11.5 }}>Chốt số liệu: {new Date(d.generatedAt).toLocaleString('vi-VN')}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        <Panel title="Đất quốc phòng" icon="map" onClick={() => nav('/land-parcels')} rows={[
          { label: 'Tổng khu đất', value: num(d.land.total) },
          { label: 'Tổng diện tích', value: `${num(d.land.totalArea)} m²` },
          { label: 'Tranh chấp / lấn chiếm', value: num(d.land.disputed + d.land.encroached), tone: d.land.disputed + d.land.encroached > 0 ? 'danger' : 'ok' },
        ]} />

        <Panel title="Công trình" icon="building" onClick={() => nav('/barracks')} rows={[
          { label: 'Tổng công trình (đang KT)', value: `${num(d.facilities.good + d.facilities.fair + d.facilities.poor)}/${num(d.facilities.total)}` },
          { label: 'Tỷ lệ tốt', value: `${facGoodPct}%`, tone: facGoodPct >= 70 ? 'ok' : 'warn' },
          { label: 'Xuống cấp (kém)', value: num(d.facilities.poor), tone: d.facilities.poor > 0 ? 'danger' : 'ok' },
        ]} />

        <Panel title="Năng lực bố trí" icon="user" onClick={() => nav('/barracks')} rows={[
          { label: 'Doanh trại', value: `${num(d.capacity.approved)}/${num(d.capacity.barracks)} duyệt` },
          { label: 'Sức chứa quân số', value: `${num(d.capacity.totalCapacity)} người` },
        ]} />

        <Panel title="Điện · Nước · Máy phát" icon="wrench" onClick={() => nav('/utilities')} rows={[
          { label: 'Hệ thống điện (hỏng)', value: `${num(d.utilities.electricity.total)} (${num(d.utilities.electricity.fault)})`, tone: d.utilities.electricity.fault > 0 ? 'danger' : 'ok' },
          { label: 'Hệ thống nước (hỏng)', value: `${num(d.utilities.water.total)} (${num(d.utilities.water.fault)})`, tone: d.utilities.water.fault > 0 ? 'danger' : 'ok' },
          { label: 'Máy phát (hỏng) · quá hạn BD', value: `${num(d.utilities.generators.total)}(${num(d.utilities.generators.fault)}) · ${num(d.utilities.maintenanceDue)}`, tone: d.utilities.generators.fault + d.utilities.maintenanceDue > 0 ? 'warn' : 'ok' },
        ]} />

        <Panel title="Vật chất" icon="box" onClick={() => nav('/inventory')} rows={[
          { label: 'Tồn kho hiện có (đã duyệt)', value: num(d.materials.onHand) },
        ]} />

        <Panel title="Đầu tư · XDCB" icon="building" onClick={() => nav('/projects')} rows={[
          { label: 'Đang thi công', value: num(d.projects.inProgress) },
          { label: 'Chậm tiến độ', value: num(d.projects.delayed), tone: d.projects.delayed > 0 ? 'danger' : 'ok' },
          { label: 'Tổng dự toán / đã giải ngân', value: `${currency(d.projects.totalEstimate)} · ${currency(d.projects.disbursed)}` },
        ]} />

        <Panel title={`Ngân sách ${d.budget.year || ''}`} icon="chart" onClick={() => nav('/budgets')} rows={[
          { label: 'Dự toán', value: currency(d.budget.planned) },
          { label: 'Đã chi', value: currency(d.budget.spent), tone: d.budget.spent > d.budget.planned && d.budget.planned > 0 ? 'danger' : 'ok' },
          { label: 'Tỉ lệ giải ngân', value: `${disbPct}%`, tone: disbPct > 100 ? 'danger' : undefined },
        ]} />

        <Panel title="Dữ liệu cấp xã" icon="grid" onClick={() => nav('/commune-readiness')} rows={[
          { label: 'Địa bàn xã/phường', value: num(d.communes.total) },
          { label: 'Đã có hồ sơ', value: num(d.communes.withData), tone: 'ok' },
          { label: 'Chưa có hồ sơ', value: num(d.communes.noData), tone: d.communes.noData > 0 ? 'warn' : 'ok' },
        ]} />

        <Panel title="Nguồn lực huy động" icon="target" onClick={() => nav('/local-resources')} rows={[
          { label: 'Nguồn lực sẵn sàng', value: num(d.localResources.total) },
          { label: 'Hiệp đồng sắp hết hạn', value: num(d.localResources.agreementsExpiring), tone: d.localResources.agreementsExpiring > 0 ? 'warn' : 'ok' },
        ]} />

        <Panel title="Nhiệm vụ" icon="clipboard" onClick={() => nav('/tasks')} rows={[
          { label: 'Đang thực hiện', value: num(d.tasks.inProgress) },
          { label: 'Quá hạn', value: num(d.tasks.overdue), tone: d.tasks.overdue > 0 ? 'danger' : 'ok' },
        ]} />

        <Panel title="Kiểm tra · thanh tra" icon="shield" onClick={() => nav('/audits')} rows={[
          { label: 'Đang tiến hành', value: num(d.inspections.inProgress) },
          { label: 'Kiến nghị chưa xử lý', value: num(d.inspections.openFindings), tone: d.inspections.openFindings > 0 ? 'warn' : 'ok' },
          { label: 'Kiến nghị quá hạn', value: num(d.inspections.overdueFindings), tone: d.inspections.overdueFindings > 0 ? 'danger' : 'ok' },
        ]} />

        <Panel title="Văn bản pháp quy" icon="file" onClick={() => nav('/legal-documents')} rows={[
          { label: 'Đang hiệu lực', value: num(d.legalDocs.effective) },
          { label: 'Sắp hết hiệu lực', value: num(d.legalDocs.expiringSoon), tone: d.legalDocs.expiringSoon > 0 ? 'warn' : 'ok' },
        ]} />
      </div>

      {/* Cảnh báo khẩn theo loại */}
      <div className="card" style={{ padding: 16, marginTop: 14, borderLeft: `4px solid ${d.alerts.critical > 0 ? 'var(--danger-fg)' : 'var(--ok-fg)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="eyebrow">Cảnh báo đang mở: {num(d.alerts.open)} · trọng yếu: <span style={{ color: 'var(--danger-fg)' }}>{num(d.alerts.critical)}</span></div>
          <button className="btn btn-sm" onClick={() => nav('/alerts')}><Icon name="bell" size={14} /> Trung tâm cảnh báo</button>
        </div>
        {d.alerts.byType.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Không có cảnh báo đang mở.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.alerts.byType.map((t) => (
              <span key={t.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)', borderRadius: 14, padding: '3px 10px' }}>
                {ALERT_TYPE_LABEL[t.type] ?? t.type}
                <b className="num" style={{ color: 'var(--danger-fg)' }}>{t.count}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, icon, onClick, rows }: { title: string; icon: IconName; onClick: () => void; rows: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }> }) {
  return (
    <div className="card rowh" onClick={onClick} style={{ padding: 14, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: 'var(--color-accent-600)' }}><Icon name={icon} size={16} /></span>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
        <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-400)' }}><Icon name="chevron" size={14} /></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span className="muted">{r.label}</span>
            <span className="num" style={{ fontWeight: 700, color: r.tone === 'danger' ? 'var(--danger-fg)' : r.tone === 'warn' ? 'var(--warn-fg)' : r.tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
