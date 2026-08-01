import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { Skeleton, ErrorState, EmptyState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE } from '../../lib/roles';
import { num } from '../../lib/format';

interface Summary {
  barracks: { total: number; approved: number; pending: number; draft: number; capacity: number };
  facilities: { total: number; inUse: number; decommissioned: number };
  materials: { total: number; published: number };
  criticalAlerts: number;
}
interface Prio { kind: string; refId: string; title: string; detail: string; score: number; route: string }

const KIND_LABEL: Record<string, string> = {
  FACILITY_POOR: 'Công trình', PROJECT_DELAYED: 'Dự án', LAND_DISPUTE: 'Đất đai', UTILITY_FAULT: 'Hạ tầng',
};

// Workspace CÁN BỘ NGÀNH DOANH TRẠI — trung tâm nghiệp vụ: doanh trại/công trình/kho trạm,
// hồ sơ chờ xử lý và danh sách việc ưu tiên (từ heuristic). Thiên về "việc của tôi".
export function OfficerWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['dashboard-summary', 'officer'],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: 'NORMAL' } })).data,
    refetchInterval: 60_000,
  });
  const prio = useQuery({
    queryKey: ['analytics-priorities', 'officer'],
    queryFn: async () => (await api.get('/analytics/priorities')).data as { items: Prio[] },
  });

  const items = (prio.data?.items ?? []).slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow="Cán bộ ngành doanh trại · Nghiệp vụ"
        title={`Bàn làm việc nghiệp vụ${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.BARRACKS_OFFICER}
      />
      <QuickActions actions={quickActionsFor('officer')} />

      {q.isLoading && <Skeleton rows={4} />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
          <KpiCard label="Công trình đang khai thác" value={num(q.data.facilities.inUse)} unit={`/ ${num(q.data.facilities.total)}`} icon="grid" dom="asset" trend={{ dir: 'flat', text: `${q.data.facilities.decommissioned} ngừng KT` }} onClick={() => nav('/barracks')} />
          <KpiCard label="Hồ sơ chờ phê duyệt" value={num(q.data.barracks.pending)} unit="hồ sơ" icon="clock" dom="audit" onClick={() => nav('/approvals')} />
          <KpiCard label="Hồ sơ nháp cần hoàn thiện" value={num(q.data.barracks.draft)} unit="bản" icon="edit" dom="cmd" onClick={() => nav('/barracks')} />
          <KpiCard label="Danh mục vật chất chuẩn" value={num(q.data.materials.total)} unit="mã" icon="box" dom="stock" onClick={() => nav('/materials')} />
          <KpiCard label="Yêu cầu sửa chữa / cảnh báo" value={num(q.data.criticalAlerts)} icon="wrench" dom="repair" onClick={() => nav('/maintenance')} />
          <KpiCard label="Sức chứa quân số quản lý" value={num(q.data.barracks.capacity)} unit="người" icon="user" dom="plan" />
        </div>
      )}

      <div className="card" style={{ padding: 18, marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="eyebrow">Việc ưu tiên xử lý</div>
          <button className="btn btn-sm" onClick={() => nav('/analytics')}><Icon name="chart" size={14} /> Xem phân tích đầy đủ</button>
        </div>
        {prio.isLoading ? <Skeleton rows={4} /> : prio.isError ? <ErrorState error={prio.error} /> : items.length === 0 ? (
          <EmptyState icon="check" title="Không có việc ưu tiên nổi cộm" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((p, i) => (
              <button key={i} className="rowh" onClick={() => nav(p.route)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--color-neutral-200)', borderRadius: 8, gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent-700)', background: 'var(--color-neutral-100)', padding: '2px 8px', borderRadius: 10 }}>{KIND_LABEL[p.kind] ?? p.kind}</span>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.title}</span>
                  {p.detail && <span className="muted" style={{ fontSize: 12 }}>{p.detail}</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b className="num" style={{ color: 'var(--danger-fg)' }}>{p.score}</b><Icon name="chevron" size={15} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
