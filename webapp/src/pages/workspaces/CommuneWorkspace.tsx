import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { Skeleton, ErrorState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE } from '../../lib/roles';
import { useOfflineQueue } from '../../lib/offlineQueue';
import { num } from '../../lib/format';

interface Summary {
  barracks: { total: number; approved: number; pending: number; draft: number; capacity: number };
  facilities: { total: number; inUse: number; decommissioned: number };
}
interface AreaReadiness { id: string; name: string; barracksCount: number; avgCompleteness: number; incompleteCount: number; staleCount: number }
interface Readiness { areas: AreaReadiness[] }

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--ok-fg)';
  if (v >= 50) return 'var(--warn-fg)';
  return 'var(--danger-fg)';
}

// Workspace CÁN BỘ BAN CHQS XÃ — khai báo tại địa bàn: nút hành động lớn, mức hoàn chỉnh
// hồ sơ địa bàn phụ trách, trạng thái đồng bộ ngoại tuyến. KHÔNG hiển thị bản đồ/biểu đồ toàn tỉnh.
export function CommuneWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const { online, counts } = useOfflineQueue();
  const q = useQuery({
    queryKey: ['dashboard-summary', 'commune'],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: 'NORMAL' } })).data,
    refetchInterval: 60_000,
  });
  const rd = useQuery({
    queryKey: ['commune-readiness', 'commune-ws'],
    queryFn: async () => (await api.get('/dashboard/commune-readiness', { params: { staleDays: 90 } })).data as Readiness,
  });

  const areas = rd.data?.areas ?? [];
  const avgCompleteness = areas.length
    ? Math.round(areas.reduce((s, a) => s + (a.avgCompleteness ?? 0), 0) / areas.length)
    : 0;
  const incomplete = areas.reduce((s, a) => s + (a.incompleteCount ?? 0), 0);
  const stale = areas.reduce((s, a) => s + (a.staleCount ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Ban CHQS xã · Khai báo địa bàn"
        title={`Khai báo địa bàn${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.COMMUNE_USER}
      />
      <QuickActions actions={quickActionsFor('commune')} />

      {q.isLoading && <Skeleton rows={3} />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
          <KpiCard label="Doanh trại địa bàn xã" value={num(q.data.barracks.total)} unit="vị trí" icon="building" dom="asset" onClick={() => nav('/barracks')} />
          <KpiCard label="Hồ sơ nháp chưa gửi" value={num(q.data.barracks.draft)} unit="bản" icon="edit" dom="geo" onClick={() => nav('/barracks')} />
          <KpiCard label="Đang chờ cấp trên duyệt" value={num(q.data.barracks.pending)} unit="hồ sơ" icon="clock" dom="audit" onClick={() => nav('/barracks')} />
          <KpiCard label="Khả năng huy động tại chỗ" value={num(q.data.barracks.capacity)} unit="người" icon="user" dom="plan" onClick={() => nav('/local-resources')} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 22 }}>
        {/* Mức hoàn chỉnh hồ sơ địa bàn phụ trách */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Mức hoàn chỉnh hồ sơ địa bàn</div>
            <button className="btn btn-sm" onClick={() => nav('/commune-readiness')}><Icon name="chart" size={14} /> Chi tiết</button>
          </div>
          {rd.isLoading ? <Skeleton rows={2} /> : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="num" style={{ fontSize: 40, fontWeight: 800, color: scoreColor(avgCompleteness), lineHeight: 1 }}>{avgCompleteness}%</span>
                <span className="muted" style={{ fontSize: 13 }}>trung bình</span>
              </div>
              <div style={{ height: 10, borderRadius: 6, background: 'var(--color-neutral-200)', overflow: 'hidden', margin: '12px 0' }}>
                <div style={{ height: '100%', width: `${avgCompleteness}%`, background: scoreColor(avgCompleteness) }} />
              </div>
              <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
                <span>Hồ sơ chưa đầy đủ: <b className="num" style={{ color: incomplete > 0 ? 'var(--warn-fg)' : 'var(--ok-fg)' }}>{num(incomplete)}</b></span>
                <span>Quá hạn cập nhật: <b className="num" style={{ color: stale > 0 ? 'var(--danger-fg)' : 'var(--ok-fg)' }}>{num(stale)}</b></span>
              </div>
            </>
          )}
        </div>

        {/* Trạng thái đồng bộ ngoại tuyến (M26) — quan trọng với tổ khảo sát hiện trường */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Đồng bộ dữ liệu hiện trường</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', width: 10, height: 10, borderRadius: 5, background: online ? 'var(--ok-fg)' : 'var(--danger-fg)' }} />
            <b style={{ fontSize: 14 }}>{online ? 'Đang kết nối mạng' : 'Ngoại tuyến — thay đổi được lưu tạm'}</b>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <QueueStat label="Chờ đồng bộ" value={counts.pending} tone={counts.pending > 0 ? 'warn' : 'ok'} />
            <QueueStat label="Xung đột" value={counts.conflict} tone={counts.conflict > 0 ? 'danger' : 'ok'} />
            <QueueStat label="Lỗi" value={counts.failed} tone={counts.failed > 0 ? 'danger' : 'ok'} />
          </div>
          <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => nav('/field')}><Icon name="map" size={14} /> Vào khảo sát hiện trường</button>
        </div>
      </div>
    </>
  );
}

function QueueStat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : 'var(--ok-fg)';
  return (
    <div style={{ textAlign: 'center', padding: '10px 6px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
      <div className="num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}
