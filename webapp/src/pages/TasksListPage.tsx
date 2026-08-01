import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { CATEGORY_LABEL, PRIORITY_LABEL, priorityColor, STATUS_LABEL, statusColor } from '../lib/task';

interface Row {
  id: string; code: string; title: string; category: string; priority: string;
  dueDate: string | null; progressPercent: number; status: string; parentTaskId: string | null; assignee: string | null;
}
interface Summary { total: number; inProgress: number; submitted: number; completed: number; overdue: number }

export function TaskStatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{STATUS_LABEL[status] ?? status}</span>;
}
export function PriorityTag({ p }: { p: string }) {
  return <span style={{ color: priorityColor(p), fontWeight: 700, fontSize: 12 }}>{PRIORITY_LABEL[p] ?? p}</span>;
}
function isOverdue(r: { dueDate: string | null; status: string }) {
  return !!r.dueDate && !['COMPLETED', 'CANCELLED'].includes(r.status) && new Date(r.dueDate) < new Date();
}

export function TasksListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const size = 15;

  const summary = useQuery({ queryKey: ['tasks-summary'], queryFn: async () => (await api.get('/tasks/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['tasks', page, search, status, mine],
    queryFn: async () => (await api.get('/tasks', { params: { page, size, search: search || undefined, status: status || undefined, mine: mine ? 'true' : undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span>{r.parentTaskId && <span className="muted" title="Nhiệm vụ con">↳ </span>}{r.code}</span>, mono: true, width: 120 },
    { key: 'title', header: 'Nội dung', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted" style={{ fontSize: 11 }}>{CATEGORY_LABEL[r.category] ?? r.category}{r.assignee ? ` · ${r.assignee}` : ''}</div></div> },
    { key: 'prio', header: 'Ưu tiên', render: (r) => <PriorityTag p={r.priority} /> },
    { key: 'due', header: 'Hạn', render: (r) => r.dueDate ? <span className="num" style={{ color: isOverdue(r) ? 'var(--danger-fg)' : undefined, fontWeight: isOverdue(r) ? 700 : 400 }}>{r.dueDate}{isOverdue(r) && ' ⚠'}</span> : <span className="muted">—</span>, align: 'right', mono: true },
    { key: 'prog', header: 'Tiến độ', render: (r) => <span className="num">{r.progressPercent}%</span>, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (r) => <TaskStatusChip status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tham mưu & điều hành"
        title="Kế hoạch công tác & giao nhiệm vụ"
        description="Lập kế hoạch công tác, giao nhiệm vụ xuống đơn vị/địa bàn, theo dõi tiến độ, chỉ tiêu và nghiệm thu kết quả."
        actions={<button className="btn btn-primary" onClick={() => nav('/tasks/new')}><Icon name="plus" size={16} /> Giao nhiệm vụ</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng nhiệm vụ" value={summary.data?.total ?? 0} />
        <Kpi label="Đang thực hiện" value={summary.data?.inProgress ?? 0} />
        <Kpi label="Chờ nghiệm thu" value={summary.data?.submitted ?? 0} tone={(summary.data?.submitted ?? 0) > 0 ? 'warn' : undefined} />
        <Kpi label="Hoàn thành" value={summary.data?.completed ?? 0} tone="ok" />
        <Kpi label="Quá hạn" value={summary.data?.overdue ?? 0} tone={(summary.data?.overdue ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, nội dung…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 180 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => { setPage(1); setMine((m) => !m); }} style={{ background: mine ? 'var(--color-accent-600)' : 'var(--surface-1)', color: mine ? '#fff' : 'var(--color-text)', borderColor: mine ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}>
          <Icon name="user" size={14} /> Của tôi
        </button>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/tasks/${r.id}`)} emptyTitle="Không có nhiệm vụ" emptyHint="Giao nhiệm vụ mới hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div></div>);
}
