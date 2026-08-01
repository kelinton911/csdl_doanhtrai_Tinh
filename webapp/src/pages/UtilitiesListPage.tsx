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
import { num } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';
import { CATEGORY_LABEL, CATEGORY_COLOR, KIND_LABEL, STATUS_LABEL, statusColor } from '../lib/utility';

interface Row {
  id: string;
  code: string;
  name: string;
  category: string;
  kind: string;
  capacity: number;
  capacityUnit: string | null;
  status: string;
  autonomyHours: number;
  barracksName: string | null;
  areaName: string | null;
}

const CATS = [
  { key: '', label: 'Tất cả' },
  { key: 'ELECTRICITY', label: 'Điện' },
  { key: 'WATER', label: 'Nước' },
  { key: 'FUEL', label: 'Nhiên liệu' },
];

export function StatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.fg }} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
export function CategoryChip({ category }: { category: string }) {
  const color = CATEGORY_COLOR[category] ?? 'var(--color-neutral-500)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

// M11 — Danh sách hệ thống hạ tầng kỹ thuật (điện/nước/nhiên liệu).
export function UtilitiesListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const size = 15;

  const q = useQuery({
    queryKey: ['utilities', page, search, category, status],
    queryFn: async () =>
      (await api.get('/utilities', { params: { page, size, search: search || undefined, category: category || undefined, status: status || undefined } })).data as {
        data: Row[]; meta: { total: number };
      },
    placeholderData: keepPreviousData,
  });

  const exporting = useMutation({
    mutationFn: async () => {
      const all = (await api.get('/utilities', { params: { page: 1, size: 1000, search: search || undefined, category: category || undefined, status: status || undefined } })).data.data as Row[];
      const cols: CsvColumn<Row>[] = [
        { header: 'Mã', value: (r) => r.code },
        { header: 'Tên hệ thống', value: (r) => r.name },
        { header: 'Nhóm', value: (r) => CATEGORY_LABEL[r.category] ?? r.category },
        { header: 'Loại', value: (r) => KIND_LABEL[r.kind] ?? r.kind },
        { header: 'Công suất', value: (r) => `${r.capacity} ${r.capacityUnit ?? ''}`.trim() },
        { header: 'Tự bảo đảm (giờ)', value: (r) => r.autonomyHours },
        { header: 'Trạng thái', value: (r) => STATUS_LABEL[r.status] ?? r.status },
        { header: 'Doanh trại', value: (r) => r.barracksName ?? '' },
      ];
      downloadCsv(`ha-tang-ky-thuat-${new Date().toISOString().slice(0, 10)}`, all, cols);
      return all.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 130 },
    { key: 'name', header: 'Tên hệ thống', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'cat', header: 'Nhóm', render: (r) => <CategoryChip category={r.category} /> },
    { key: 'kind', header: 'Loại', render: (r) => KIND_LABEL[r.kind] ?? r.kind },
    { key: 'cap', header: 'Công suất', render: (r) => <span className="num">{num(r.capacity)} {r.capacityUnit ?? ''}</span>, align: 'right' },
    { key: 'auto', header: 'Tự bảo đảm', render: (r) => r.autonomyHours > 0 ? <span className="num">{num(r.autonomyHours)}h</span> : <span className="muted">—</span>, align: 'right' },
    { key: 'barr', header: 'Doanh trại', render: (r) => r.barracksName ?? (r.areaName ?? '—') },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Hạ tầng kỹ thuật"
        title="Điện · Nước · Năng lượng"
        description="Quản lý nguồn điện, trạm biến áp, máy phát, nguồn/bể nước, nhiên liệu; ghi chỉ số tiêu thụ và khả năng tự bảo đảm."
        actions={
          <button className="btn btn-primary" onClick={() => nav('/utilities/new')}>
            <Icon name="plus" size={16} /> Thêm hệ thống
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm theo mã hoặc tên…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATS.map((f) => (
            <button key={f.key} className="btn btn-sm" onClick={() => { setPage(1); setCategory(f.key); }}
              style={{ background: category === f.key ? 'var(--color-accent-600)' : 'var(--surface-1)', color: category === f.key ? '#fff' : 'var(--color-text)', borderColor: category === f.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="input" style={{ maxWidth: 180 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting.isPending} onClick={() => exporting.mutate()}><Icon name="download" size={14} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/utilities/${r.id}`)} emptyTitle="Chưa có hệ thống" emptyHint="Thêm hệ thống điện/nước/nhiên liệu hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}
