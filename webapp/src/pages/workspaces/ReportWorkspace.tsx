import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { Skeleton, ErrorState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE } from '../../lib/roles';
import { num } from '../../lib/format';

interface Summary {
  barracks: { total: number; approved: number; capacity: number };
  facilities: { total: number; inUse: number };
  materials: { total: number };
  dataConfirmedRatio: number;
}
interface Overview { highRiskFacilities: number; consumptionAnomalies: number; priorityItems: number; dataQualityIssues: number }

const REPORT_LINKS: Array<{ label: string; hint: string; icon: 'chart' | 'file' | 'target' }> = [
  { label: 'Tổng hợp doanh trại', hint: 'Danh mục & trạng thái hồ sơ toàn tỉnh', icon: 'file' },
  { label: 'Tồn kho vật chất', hint: 'Số dư tồn kho theo kho/địa bàn', icon: 'chart' },
  { label: 'Chất lượng công trình', hint: 'Cơ cấu chất lượng & xuống cấp', icon: 'target' },
];

// Workspace NGƯỜI XEM BÁO CÁO — CHỈ ĐỌC: các chỉ số then chốt, phân tích/dự báo và lối
// tắt sang mẫu báo cáo. Không có nút tạo/sửa dữ liệu.
export function ReportWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const sum = useQuery({
    queryKey: ['dashboard-summary', 'report'],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: 'NORMAL' } })).data,
    refetchInterval: 120_000,
  });
  const ov = useQuery({
    queryKey: ['analytics-overview', 'report'],
    queryFn: async () => (await api.get<Overview>('/analytics/overview')).data,
    refetchInterval: 120_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="Người xem báo cáo · Chỉ đọc"
        title={`Bảng tin báo cáo${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.REPORT_VIEWER}
      />
      <QuickActions actions={quickActionsFor('report')} />

      {sum.isLoading && <Skeleton rows={4} />}
      {sum.isError && <ErrorState error={sum.error} />}
      {sum.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
          <KpiCard label="Tỷ lệ xác nhận dữ liệu" value={`${num(sum.data.dataConfirmedRatio)}%`} icon="check" dom="cap" />
          <KpiCard label="Tổng số doanh trại" value={num(sum.data.barracks.total)} unit="hồ sơ" icon="building" dom="asset" hint={`${sum.data.barracks.approved} đã duyệt`} />
          <KpiCard label="Công trình đang khai thác" value={num(sum.data.facilities.inUse)} unit={`/ ${num(sum.data.facilities.total)}`} icon="grid" dom="stock" />
          <KpiCard label="Danh mục vật chất chuẩn" value={num(sum.data.materials.total)} unit="mã" icon="box" dom="report" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 22 }}>
        {/* Chỉ số phân tích / cảnh báo sớm (chỉ đọc) */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Phân tích & cảnh báo sớm</div>
            <button className="btn btn-sm" onClick={() => nav('/analytics')}><Icon name="chart" size={14} /> Mở phân tích</button>
          </div>
          {ov.isLoading ? <Skeleton rows={2} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MiniStat label="Công trình rủi ro cao" value={ov.data?.highRiskFacilities ?? 0} tone={(ov.data?.highRiskFacilities ?? 0) > 0 ? 'danger' : 'ok'} />
              <MiniStat label="Tiêu thụ bất thường" value={ov.data?.consumptionAnomalies ?? 0} tone={(ov.data?.consumptionAnomalies ?? 0) > 0 ? 'warn' : 'ok'} />
              <MiniStat label="Việc cần ưu tiên" value={ov.data?.priorityItems ?? 0} tone="neutral" />
              <MiniStat label="Vấn đề chất lượng dữ liệu" value={ov.data?.dataQualityIssues ?? 0} tone={(ov.data?.dataQualityIssues ?? 0) > 0 ? 'warn' : 'ok'} />
            </div>
          )}
        </div>

        {/* Lối tắt sang các mẫu báo cáo */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Mẫu báo cáo có sẵn</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REPORT_LINKS.map((r) => (
              <button key={r.label} className="rowh" onClick={() => nav('/reports')} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
                <span style={{ color: 'var(--dom-report)' }}><Icon name={r.icon} size={18} /></span>
                <span>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.label}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.hint}</div>
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-400)' }}><Icon name="chevron" size={16} /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'danger' | 'neutral' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
      <div className="num" style={{ fontSize: 24, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
    </div>
  );
}
