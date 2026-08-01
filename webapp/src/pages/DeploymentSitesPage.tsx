import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';
import { SITE_TYPE_LABEL, READINESS_LABEL, readinessColor, ROLE_LABEL } from '../lib/readiness';

interface Row {
  id: string; code: string; name: string; siteType: string; capacity: number;
  readiness: string; role: string; deployTimeHours: number; areaName: string | null;
}
interface Summary { sites: { total: number; ready: number; notReady: number; capacity: number } }
interface AreaAssurance { id: string; code: string; name: string; type: string; barracksCapacity: number; siteCapacity: number; totalCapacity: number; siteCount: number; readySites: number }

export function ReadyChip({ readiness }: { readiness: string }) {
  const c = readinessColor(readiness);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{READINESS_LABEL[readiness] ?? readiness}</span>;
}

export function DeploymentSitesPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [siteType, setSiteType] = useState('');
  const [readiness, setReadiness] = useState('');
  const [assureOpen, setAssureOpen] = useState(false);
  const [required, setRequired] = useState('500');
  const size = 15;

  const summary = useQuery({ queryKey: ['readiness-summary'], queryFn: async () => (await api.get('/readiness/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['deployment-sites', page, search, siteType, readiness],
    queryFn: async () => (await api.get('/readiness/sites', { params: { page, size, search: search || undefined, siteType: siteType || undefined, readiness: readiness || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });
  const assurance = useQuery({
    queryKey: ['readiness-assurance'],
    queryFn: async () => (await api.get('/readiness/assurance-by-area')).data as { areas: AreaAssurance[] },
    enabled: assureOpen,
  });

  const reqNum = Number(required) || 0;
  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 100 },
    { key: 'name', header: 'Địa điểm', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted" style={{ fontSize: 11 }}>{SITE_TYPE_LABEL[r.siteType] ?? r.siteType}{r.areaName ? ` · ${r.areaName}` : ''}</div></div> },
    { key: 'cap', header: 'Sức chứa', render: (r) => <span className="num">{num(r.capacity)}</span>, align: 'right' },
    { key: 'deploy', header: 'T.gian triển khai', render: (r) => <span className="num">{num(r.deployTimeHours)}h</span>, align: 'right' },
    { key: 'role', header: 'Vai trò', render: (r) => ROLE_LABEL[r.role] ?? r.role },
    { key: 'readiness', header: 'Sẵn sàng', render: (r) => <ReadyChip readiness={r.readiness} /> },
  ];

  const assureCols: Column<AreaAssurance>[] = [
    { key: 'name', header: 'Địa bàn', render: (a) => <div><div style={{ fontWeight: 600 }}>{a.name}</div><div className="muted num" style={{ fontSize: 11 }}>{a.code}</div></div> },
    { key: 'barr', header: 'Sức chứa doanh trại', render: (a) => num(a.barracksCapacity), align: 'right', mono: true },
    { key: 'site', header: 'Sức chứa sơ tán', render: (a) => `${num(a.siteCapacity)} (${a.siteCount} điểm, ${a.readySites} SS)`, align: 'right' },
    { key: 'total', header: 'Tổng khả năng', render: (a) => <b className="num">{num(a.totalCapacity)}</b>, align: 'right' },
    { key: 'short', header: `Thiếu hụt (cần ${num(reqNum)})`, render: (a) => {
      const short = reqNum - a.totalCapacity;
      return short > 0 ? <span className="num" style={{ color: 'var(--danger-fg)', fontWeight: 700 }}>-{num(short)}</span> : <span className="num" style={{ color: 'var(--ok-fg)' }}>đủ</span>;
    }, align: 'right' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Sẵn sàng chiến đấu"
        title="Địa điểm sơ tán · phân tán · dự bị · bố trí"
        description="Quản lý địa điểm phục vụ chuyển trạng thái & tác chiến: sức chứa, che giấu, thời gian triển khai, mức sẵn sàng; tính khả năng bảo đảm theo địa bàn."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setAssureOpen((o) => !o)}><Icon name="target" size={16} /> Khả năng bảo đảm theo địa bàn</button>
            <button className="btn btn-primary" onClick={() => nav('/readiness/sites/new')}><Icon name="plus" size={16} /> Thêm địa điểm</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng địa điểm" value={num(summary.data?.sites.total ?? 0)} />
        <Kpi label="Sẵn sàng" value={num(summary.data?.sites.ready ?? 0)} tone="ok" />
        <Kpi label="Chưa sẵn sàng" value={num(summary.data?.sites.notReady ?? 0)} tone={(summary.data?.sites.notReady ?? 0) > 0 ? 'danger' : undefined} />
        <Kpi label="Tổng sức chứa sơ tán" value={`${num(summary.data?.sites.capacity ?? 0)} người`} />
      </div>

      {assureOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: '3px solid var(--color-accent-600)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <div className="eyebrow">Khả năng bảo đảm quân số theo địa bàn (nhu cầu – khả năng – thiếu hụt)</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>Quân số cần bảo đảm/địa bàn:
              <input className="input num" style={{ width: 110 }} type="number" min={0} value={required} onChange={(e) => setRequired(e.target.value)} />
            </label>
          </div>
          <DataTable columns={assureCols} rows={assurance.data?.areas} loading={assurance.isLoading} rowKey={(a) => a.id} emptyTitle="Chưa có dữ liệu địa bàn" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, tên địa điểm…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 180 }} value={siteType} onChange={(e) => { setPage(1); setSiteType(e.target.value); }}>
          <option value="">Mọi loại địa điểm</option>
          {Object.entries(SITE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={readiness} onChange={(e) => { setPage(1); setReadiness(e.target.value); }}>
          <option value="">Mọi mức sẵn sàng</option>
          {Object.entries(READINESS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/readiness/sites/${r.id}`)} emptyTitle="Chưa có địa điểm" emptyHint="Thêm địa điểm sơ tán/bố trí hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div></div>);
}
