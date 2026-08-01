import { useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { currency } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';
import { PROJECT_TYPE_LABEL, FUNDING_LABEL, PHASE_LABEL, phaseColor } from '../lib/project';

interface Row {
  id: string; code: string; name: string; projectType: string; fundingSource: string | null;
  totalEstimate: number; approvedCapital: number; disbursed: number; progressPercent: number;
  phase: string; plannedEndDate: string | null; barracksName: string | null; areaName: string | null;
}
interface Summary { total: number; totalEstimate: number; approvedCapital: number; disbursed: number; inProgress: number; delayed: number }

export function PhaseChip({ phase }: { phase: string }) {
  const c = phaseColor(phase);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{PHASE_LABEL[phase] ?? phase}</span>;
}
export function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'var(--ok-fg)' : pct >= 50 ? 'var(--info-fg)' : 'var(--warn-fg)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <span style={{ width: 70, height: 6, borderRadius: 3, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.min(pct, 100)}%`, background: color }} />
      </span>
      <strong className="num" style={{ minWidth: 34, textAlign: 'right', color }}>{pct}%</strong>
    </span>
  );
}
function isDelayed(r: { phase: string; plannedEndDate: string | null }) {
  return !!r.plannedEndDate && !['HANDED_OVER', 'WARRANTY', 'CLOSED', 'CANCELLED'].includes(r.phase) && new Date(r.plannedEndDate) < new Date();
}

export function ProjectsListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [ptype, setPtype] = useState('');
  const size = 15;

  const summary = useQuery({ queryKey: ['projects-summary'], queryFn: async () => (await api.get('/projects/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['projects', page, search, phase, ptype],
    queryFn: async () => (await api.get('/projects', { params: { page, size, search: search || undefined, phase: phase || undefined, projectType: ptype || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const exporting = useMutation({
    mutationFn: async () => {
      const all = (await api.get('/projects', { params: { page: 1, size: 1000, search: search || undefined, phase: phase || undefined, projectType: ptype || undefined } })).data.data as Row[];
      const cols: CsvColumn<Row>[] = [
        { header: 'Mã', value: (r) => r.code }, { header: 'Tên dự án', value: (r) => r.name },
        { header: 'Loại', value: (r) => PROJECT_TYPE_LABEL[r.projectType] ?? r.projectType },
        { header: 'Doanh trại', value: (r) => r.barracksName ?? '' },
        { header: 'Nguồn vốn', value: (r) => FUNDING_LABEL[r.fundingSource ?? ''] ?? '' },
        { header: 'Tổng dự toán', value: (r) => r.totalEstimate }, { header: 'Vốn duyệt', value: (r) => r.approvedCapital },
        { header: 'Đã giải ngân', value: (r) => r.disbursed }, { header: 'Tiến độ (%)', value: (r) => r.progressPercent },
        { header: 'Giai đoạn', value: (r) => PHASE_LABEL[r.phase] ?? r.phase },
      ];
      downloadCsv(`du-an-xdcb-${new Date().toISOString().slice(0, 10)}`, all, cols);
      return all.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 120 },
    { key: 'name', header: 'Tên dự án', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted" style={{ fontSize: 11 }}>{PROJECT_TYPE_LABEL[r.projectType] ?? r.projectType}{r.barracksName ? ` · ${r.barracksName}` : ''}</div></div> },
    { key: 'fund', header: 'Nguồn vốn', render: (r) => FUNDING_LABEL[r.fundingSource ?? ''] ?? '—' },
    { key: 'est', header: 'Tổng dự toán', render: (r) => currency(r.totalEstimate), align: 'right', mono: true },
    { key: 'prog', header: 'Tiến độ', render: (r) => <ProgressBar pct={r.progressPercent} />, align: 'right' },
    { key: 'phase', header: 'Giai đoạn', render: (r) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><PhaseChip phase={r.phase} />{isDelayed(r) && <span title="Chậm tiến độ" style={{ color: 'var(--danger-fg)' }}><Icon name="clock" size={14} /></span>}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Đầu tư & xây dựng"
        title="Xây dựng cơ bản & dự án đầu tư"
        description="Quản lý trọn vòng đời dự án: chủ trương → thiết kế → nhà thầu → hợp đồng → thi công → nghiệm thu → bàn giao; theo dõi dự toán, giải ngân, tiến độ."
        actions={<button className="btn btn-primary" onClick={() => nav('/projects/new')}><Icon name="plus" size={16} /> Tạo dự án</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng số dự án" value={String(summary.data?.total ?? 0)} />
        <Kpi label="Đang thi công" value={String(summary.data?.inProgress ?? 0)} />
        <Kpi label="Tổng dự toán" value={currency(summary.data?.totalEstimate ?? 0)} small />
        <Kpi label="Đã giải ngân" value={currency(summary.data?.disbursed ?? 0)} small tone="ok" />
        <Kpi label="Chậm tiến độ" value={String(summary.data?.delayed ?? 0)} tone={(summary.data?.delayed ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, tên dự án…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 190 }} value={phase} onChange={(e) => { setPage(1); setPhase(e.target.value); }}>
          <option value="">Mọi giai đoạn</option>
          {Object.entries(PHASE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={ptype} onChange={(e) => { setPage(1); setPtype(e.target.value); }}>
          <option value="">Mọi loại</option>
          {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting.isPending} onClick={() => exporting.mutate()}><Icon name="download" size={14} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/projects/${r.id}`)} emptyTitle="Chưa có dự án" emptyHint="Tạo dự án mới hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone, small }: { label: string; value: string; tone?: 'ok' | 'danger'; small?: boolean }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: small ? 17 : 26, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
