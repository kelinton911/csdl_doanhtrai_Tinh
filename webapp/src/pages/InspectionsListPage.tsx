import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { TYPE_LABEL, STATUS_LABEL, statusColor } from '../lib/oversight';

interface Row {
  id: string; code: string; title: string; inspectionType: string; status: string;
  plannedDate: string | null; endDate: string | null; targetName: string | null;
  findingCount: number; openFindingCount: number;
}
interface Summary { total: number; inProgress: number; planned: number; openFindings: number; overdueFindings: number }

export function InspStatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{STATUS_LABEL[status] ?? status}</span>;
}

export function InspectionsListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const size = 15;

  const summary = useQuery({ queryKey: ['inspections-summary'], queryFn: async () => (await api.get('/inspections/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['inspections', page, search, status, type],
    queryFn: async () => (await api.get('/inspections', { params: { page, size, search: search || undefined, status: status || undefined, inspectionType: type || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 120 },
    { key: 'title', header: 'Nội dung', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted" style={{ fontSize: 11 }}>{TYPE_LABEL[r.inspectionType] ?? r.inspectionType}{r.targetName ? ` · ${r.targetName}` : ''}</div></div> },
    { key: 'planned', header: 'Ngày KH', render: (r) => r.plannedDate ?? '—', align: 'right', mono: true },
    { key: 'findings', header: 'Kiến nghị (mở/tổng)', render: (r) => <span className="num">{r.openFindingCount > 0 ? <span style={{ color: 'var(--danger-fg)', fontWeight: 700 }}>{r.openFindingCount}</span> : 0}/{r.findingCount}</span>, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (r) => <InspStatusChip status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Kiểm tra & thanh tra"
        title="Kiểm tra, thanh tra & xử lý kiến nghị"
        description="Lập kế hoạch kiểm tra, tiến hành, lập biên bản/kết luận, ghi nhận phát hiện - kiến nghị và theo dõi khắc phục."
        actions={<button className="btn btn-primary" onClick={() => nav('/audits/new')}><Icon name="plus" size={16} /> Lập cuộc kiểm tra</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng cuộc kiểm tra" value={summary.data?.total ?? 0} />
        <Kpi label="Đang tiến hành" value={summary.data?.inProgress ?? 0} />
        <Kpi label="Theo kế hoạch" value={summary.data?.planned ?? 0} />
        <Kpi label="Kiến nghị chưa xử lý" value={summary.data?.openFindings ?? 0} tone={(summary.data?.openFindings ?? 0) > 0 ? 'warn' : undefined} />
        <Kpi label="Kiến nghị quá hạn" value={summary.data?.overdueFindings ?? 0} tone={(summary.data?.overdueFindings ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, nội dung…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 170 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 150 }} value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
          <option value="">Mọi loại</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/audits/${r.id}`)} emptyTitle="Chưa có cuộc kiểm tra" emptyHint="Lập cuộc kiểm tra mới hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div></div>);
}
