import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';

interface Overview { highRiskFacilities: number; consumptionAnomalies: number; priorityItems: number; dataQualityIssues: number }
interface Deg { id: string; code: string; name: string; buildYear: number | null; condition: string | null; barracksId: string | null; barracksName: string | null; age: number; riskScore: number; band: string }
interface Anom { id: string; code: string; name: string; category: string; latest: number; avgPrev: number; deviation: number }
interface Prio { kind: string; refId: string; title: string; detail: string; score: number; route: string }
interface DQ { issues: Array<{ key: string; label: string; count: number; route: string; tone: string }>; totalIssues: number }

const TABS = ['Ưu tiên đầu tư/xử lý', 'Dự báo xuống cấp', 'Tiêu thụ bất thường', 'Chất lượng dữ liệu'] as const;
const BAND_COLOR: Record<string, string> = { HIGH: 'var(--danger-fg)', MEDIUM: 'var(--warn-fg)', LOW: 'var(--ok-fg)' };
const BAND_LABEL: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
const CAT_LABEL: Record<string, string> = { ELECTRICITY: 'Điện', WATER: 'Nước', FUEL: 'Nhiên liệu' };
const KIND_LABEL: Record<string, string> = { FACILITY_POOR: 'Công trình', PROJECT_DELAYED: 'Dự án', LAND_DISPUTE: 'Đất đai', UTILITY_FAULT: 'Hạ tầng' };

export function AnalyticsPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ưu tiên đầu tư/xử lý');

  const overview = useQuery({ queryKey: ['analytics-overview'], queryFn: async () => (await api.get('/analytics/overview')).data as Overview, refetchInterval: 120_000 });
  const prio = useQuery({ queryKey: ['analytics-priorities'], queryFn: async () => (await api.get('/analytics/priorities')).data as { items: Prio[] }, enabled: tab === 'Ưu tiên đầu tư/xử lý' });
  const deg = useQuery({ queryKey: ['analytics-degradation'], queryFn: async () => (await api.get('/analytics/degradation', { params: { limit: 40 } })).data as { items: Deg[] }, enabled: tab === 'Dự báo xuống cấp' });
  const anom = useQuery({ queryKey: ['analytics-anomalies'], queryFn: async () => (await api.get('/analytics/consumption-anomalies')).data as { threshold: number; items: Anom[] }, enabled: tab === 'Tiêu thụ bất thường' });
  const dq = useQuery({ queryKey: ['analytics-dq'], queryFn: async () => (await api.get('/analytics/data-quality')).data as DQ, enabled: tab === 'Chất lượng dữ liệu' });

  const degCols: Column<Deg>[] = [
    { key: 'name', header: 'Công trình', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted num" style={{ fontSize: 11 }}>{r.code}{r.barracksName ? ` · ${r.barracksName}` : ''}</div></div> },
    { key: 'year', header: 'Năm XD', render: (r) => r.buildYear ?? '—', align: 'right', mono: true },
    { key: 'age', header: 'Tuổi (năm)', render: (r) => num(r.age), align: 'right', mono: true },
    { key: 'risk', header: 'Điểm rủi ro', render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <span style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--color-neutral-200)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${r.riskScore}%`, background: BAND_COLOR[r.band] }} /></span>
        <b className="num" style={{ color: BAND_COLOR[r.band], minWidth: 30, textAlign: 'right' }}>{r.riskScore}</b>
      </span>
    ), align: 'right' },
    { key: 'band', header: 'Mức', render: (r) => <span style={{ color: BAND_COLOR[r.band], fontWeight: 700, fontSize: 12.5 }}>{BAND_LABEL[r.band]}</span> },
  ];
  const anomCols: Column<Anom>[] = [
    { key: 'name', header: 'Hệ thống', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted num" style={{ fontSize: 11 }}>{r.code} · {CAT_LABEL[r.category] ?? r.category}</div></div> },
    { key: 'avg', header: 'TB kỳ trước', render: (r) => num(r.avgPrev), align: 'right', mono: true },
    { key: 'latest', header: 'Kỳ mới nhất', render: (r) => num(r.latest), align: 'right', mono: true },
    { key: 'dev', header: 'Độ lệch', render: (r) => <b className="num" style={{ color: Math.abs(r.deviation) >= 60 ? 'var(--danger-fg)' : 'var(--warn-fg)' }}>{r.deviation > 0 ? '+' : ''}{r.deviation}%</b>, align: 'right' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Phân tích & dự báo"
        title="Phân tích, dự báo & cảnh báo sớm"
        description="Heuristic trên dữ liệu thật toàn hệ: dự báo xuống cấp, tiêu thụ bất thường, xếp ưu tiên đầu tư và rà soát chất lượng dữ liệu. Chỉ hỗ trợ ra quyết định — quyết định thuộc người chỉ huy."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Công trình rủi ro cao" value={overview.data?.highRiskFacilities ?? 0} tone={(overview.data?.highRiskFacilities ?? 0) > 0 ? 'danger' : undefined} onClick={() => setTab('Dự báo xuống cấp')} />
        <Kpi label="Tiêu thụ bất thường" value={overview.data?.consumptionAnomalies ?? 0} tone={(overview.data?.consumptionAnomalies ?? 0) > 0 ? 'warn' : undefined} onClick={() => setTab('Tiêu thụ bất thường')} />
        <Kpi label="Việc cần ưu tiên" value={overview.data?.priorityItems ?? 0} onClick={() => setTab('Ưu tiên đầu tư/xử lý')} />
        <Kpi label="Vấn đề chất lượng dữ liệu" value={overview.data?.dataQualityIssues ?? 0} tone={(overview.data?.dataQualityIssues ?? 0) > 0 ? 'warn' : undefined} onClick={() => setTab('Chất lượng dữ liệu')} />
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={{ all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, whiteSpace: 'nowrap', fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{t}</button>)}
      </div>

      {tab === 'Ưu tiên đầu tư/xử lý' && (
        prio.isLoading ? <Skeleton rows={5} /> : prio.isError ? <ErrorState error={prio.error} /> : (prio.data?.items ?? []).length === 0 ? <EmptyState icon="check" title="Không có việc ưu tiên nổi cộm" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(prio.data?.items ?? []).map((p, i) => (
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
        )
      )}

      {tab === 'Dự báo xuống cấp' && (
        <DataTable columns={degCols} rows={deg.data?.items} loading={deg.isLoading} rowKey={(r) => r.id} onRowClick={(r) => r.barracksId && nav(`/barracks/${r.barracksId}`)} emptyTitle="Không có công trình rủi ro" />
      )}

      {tab === 'Tiêu thụ bất thường' && (
        anom.isLoading ? <Skeleton rows={5} /> : (anom.data?.items ?? []).length === 0 ? <EmptyState icon="check" title="Không phát hiện tiêu thụ bất thường" hint={`Ngưỡng lệch ±${anom.data?.threshold ?? 40}% so với trung bình kỳ trước.`} /> : (
          <DataTable columns={anomCols} rows={anom.data?.items} rowKey={(r) => r.id} onRowClick={(r) => nav(`/utilities/${r.id}`)} emptyTitle="Không có bất thường" />
        )
      )}

      {tab === 'Chất lượng dữ liệu' && (
        dq.isLoading ? <Skeleton rows={5} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {(dq.data?.issues ?? []).map((iss) => {
              const color = iss.tone === 'danger' ? 'var(--danger-fg)' : 'var(--warn-fg)';
              return (
                <button key={iss.key} className="card rowh" onClick={() => nav(iss.route)} style={{ padding: 14, cursor: 'pointer', textAlign: 'left', borderLeft: `4px solid ${iss.count > 0 ? color : 'var(--ok-fg)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{iss.label}</span>
                    <b className="num" style={{ fontSize: 20, color: iss.count > 0 ? color : 'var(--ok-fg)' }}>{num(iss.count)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </>
  );
}

function Kpi({ label, value, tone, onClick }: { label: string; value: number; tone?: 'warn' | 'danger'; onClick?: () => void }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : 'var(--color-text)';
  return (
    <button className="card rowh" onClick={onClick} style={{ padding: 14, cursor: 'pointer', textAlign: 'left' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div>
    </button>
  );
}
