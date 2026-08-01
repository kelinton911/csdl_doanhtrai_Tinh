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
import { FUNDING_LABEL, BUDGET_STATUS_LABEL, budgetStatusColor } from '../lib/budget';

interface Row {
  id: string; code: string; name: string; fiscalYear: number; fundingSource: string | null;
  plannedAmount: number; allocated: number; spent: number; status: string; orgName: string | null;
}
interface Summary { byYear: Array<{ fiscalYear: number; plans: number; planned: number; spent: number }> }

export function BudgetStatusChip({ status }: { status: string }) {
  const c = budgetStatusColor(status);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{BUDGET_STATUS_LABEL[status] ?? status}</span>;
}
export function SpendBar({ spent, planned }: { spent: number; planned: number }) {
  const pct = planned > 0 ? Math.round((spent / planned) * 100) : 0;
  const over = pct > 100;
  const color = over ? 'var(--danger-fg)' : pct >= 80 ? 'var(--warn-fg)' : 'var(--ok-fg)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <span style={{ width: 72, height: 6, borderRadius: 3, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.min(pct, 100)}%`, background: color }} />
      </span>
      <strong className="num" style={{ minWidth: 40, textAlign: 'right', color }}>{pct}%</strong>
    </span>
  );
}

export function BudgetsListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const size = 15;

  const summary = useQuery({ queryKey: ['budgets-summary'], queryFn: async () => (await api.get('/budgets/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['budgets', page, search, year, status],
    queryFn: async () => (await api.get('/budgets', { params: { page, size, search: search || undefined, fiscalYear: year || undefined, status: status || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const curYear = summary.data?.byYear?.[0];
  const exporting = useMutation({
    mutationFn: async () => {
      const all = (await api.get('/budgets', { params: { page: 1, size: 1000, search: search || undefined, fiscalYear: year || undefined, status: status || undefined } })).data.data as Row[];
      const cols: CsvColumn<Row>[] = [
        { header: 'Mã', value: (r) => r.code }, { header: 'Tên dự toán', value: (r) => r.name },
        { header: 'Niên độ', value: (r) => r.fiscalYear }, { header: 'Nguồn vốn', value: (r) => FUNDING_LABEL[r.fundingSource ?? ''] ?? '' },
        { header: 'Dự toán', value: (r) => r.plannedAmount }, { header: 'Đã phân bổ', value: (r) => r.allocated }, { header: 'Đã chi', value: (r) => r.spent },
        { header: 'Trạng thái', value: (r) => BUDGET_STATUS_LABEL[r.status] ?? r.status },
      ];
      downloadCsv(`ngan-sach-doanh-trai-${new Date().toISOString().slice(0, 10)}`, all, cols);
      return all.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 130 },
    { key: 'name', header: 'Tên dự toán', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted num" style={{ fontSize: 11 }}>Niên độ {r.fiscalYear} · {FUNDING_LABEL[r.fundingSource ?? ''] ?? '—'}</div></div> },
    { key: 'planned', header: 'Dự toán', render: (r) => currency(r.plannedAmount), align: 'right', mono: true },
    { key: 'alloc', header: 'Đã phân bổ', render: (r) => currency(r.allocated), align: 'right', mono: true },
    { key: 'spend', header: 'Giải ngân/Dự toán', render: (r) => <SpendBar spent={r.spent} planned={r.plannedAmount} />, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (r) => <BudgetStatusChip status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tài chính doanh trại"
        title="Kế hoạch & ngân sách"
        description="Dự toán theo niên độ, phân bổ hạn mức, theo dõi giải ngân và đối chiếu dự toán/thực chi. Dữ liệu tài chính giới hạn theo quyền."
        actions={<button className="btn btn-primary" onClick={() => nav('/budgets/new')}><Icon name="plus" size={16} /> Tạo dự toán</button>}
      />

      {curYear && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Kpi label={`Dự toán ${curYear.fiscalYear}`} value={currency(curYear.planned)} small />
          <Kpi label={`Đã chi ${curYear.fiscalYear}`} value={currency(curYear.spent)} small tone="ok" />
          <Kpi label="Tỉ lệ giải ngân" value={`${curYear.planned > 0 ? Math.round((curYear.spent / curYear.planned) * 100) : 0}%`} tone={curYear.spent > curYear.planned ? 'danger' : undefined} />
          <Kpi label={`Số dự toán ${curYear.fiscalYear}`} value={String(curYear.plans)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, tên dự toán…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <input className="input num" style={{ width: 120 }} placeholder="Niên độ" value={year} onChange={(e) => { setPage(1); setYear(e.target.value); }} />
        <select className="input" style={{ maxWidth: 170 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(BUDGET_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting.isPending} onClick={() => exporting.mutate()}><Icon name="download" size={14} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/budgets/${r.id}`)} emptyTitle="Chưa có dự toán" emptyHint="Tạo dự toán ngân sách hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone, small }: { label: string; value: string; tone?: 'ok' | 'danger'; small?: boolean }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: small ? 17 : 26, fontWeight: 800, color }}>{value}</div></div>);
}
