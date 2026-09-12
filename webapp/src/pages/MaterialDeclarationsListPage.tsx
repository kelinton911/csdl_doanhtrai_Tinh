import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { Pagination } from '../components/Pagination';
import { ListToolbar, QuickFilter } from '../components/ListToolbar';
import { useAuth } from '../lib/auth';
import { useDeclarations, type Declaration } from '../lib/materialDeclarations';

const STATUS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { key: 'CHANGES_REQUESTED', label: 'Yêu cầu bổ sung' },
  { key: 'APPROVED', label: 'Đã duyệt' },
];
const DECLARERS = ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'COMMUNE_USER', 'UNIT_USER'];
const PAGE_SIZE = 20;

// Danh sách bản khai báo vật chất — tìm kiếm/lọc/sắp xếp/phân trang + thao tác nhanh.
export function MaterialDeclarationsListPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const q = useDeclarations();
  const all = q.data ?? [];

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const [page, setPage] = useState(1);

  const periods = useMemo(
    () => Array.from(new Set(all.map((r) => r.periodLabel).filter(Boolean))) as string[],
    [all],
  );
  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of all) by[r.workflowStatus] = (by[r.workflowStatus] ?? 0) + 1;
    return by;
  }, [all]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = all.filter((r) => {
      if (status && r.workflowStatus !== status) return false;
      if (period && r.periodLabel !== period) return false;
      if (term && !(`${r.code} ${r.title}`.toLowerCase().includes(term))) return false;
      return true;
    });
    rows.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title, 'vi') : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return rows;
  }, [all, status, period, search, sort]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Reset trang khi bộ lọc thu hẹp quá số trang hiện tại.
  if (page > 1 && pageRows.length === 0 && filtered.length > 0) setPage(1);

  const duplicate = useMutation({
    mutationFn: async (r: Declaration) =>
      (await api.post(`/material-declarations/${r.id}/duplicate`, { title: `${r.title} (bản sao)`, periodLabel: r.periodLabel ?? undefined })).data as { id: string },
    onSuccess: (d) => { toast.success('Đã nhân bản.'); nav(`/material-declarations/${d.id}/edit`); },
    onError: (e) => toast.problem(e, 'Nhân bản thất bại'),
  });
  const remove = useMutation({
    mutationFn: async (r: Declaration) => api.delete(`/material-declarations/${r.id}`),
    onSuccess: () => { toast.success('Đã xóa bản nháp.'); qc.invalidateQueries({ queryKey: ['material-declarations'] }); },
    onError: (e) => toast.problem(e, 'Xóa thất bại'),
  });

  const columns: Column<Declaration>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 150 },
    { key: 'title', header: 'Tên bản khai báo', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'period', header: 'Kỳ', render: (r) => r.periodLabel ?? '—', width: 120 },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} />, width: 150 },
    { key: 'updated', header: 'Cập nhật', render: (r) => new Date(r.updatedAt).toLocaleDateString('vi-VN'), width: 110 },
    {
      key: 'actions', header: '', align: 'right', width: 120,
      render: (r) =>
        hasRole(...DECLARERS) ? (
          <span style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" title="Nhân bản" disabled={duplicate.isPending} onClick={() => duplicate.mutate(r)}><Icon name="clipboard" size={14} /></button>
            {r.workflowStatus === 'DRAFT' && (
              <button className="btn btn-ghost btn-sm" title="Xóa nháp" disabled={remove.isPending} onClick={() => { if (confirm(`Xóa bản nháp "${r.title}"?`)) remove.mutate(r); }}>✕</button>
            )}
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Khai báo vật chất (xã/đơn vị)"
        title="Bản khai báo vật chất"
        description="Đơn vị cấp cơ sở khai báo vật chất theo danh mục chuẩn. Toàn quyền nhập khi chưa duyệt; duyệt xong khóa."
        actions={
          hasRole(...DECLARERS) ? (
            <button className="btn btn-primary" onClick={() => nav('/material-declarations/new')}>
              <Icon name="plus" size={16} /> Tạo bản khai báo
            </button>
          ) : null
        }
      />

      {/* Dải thống kê theo trạng thái */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Tổng" value={all.length} />
        {STATUS.slice(1).map((s) => <Stat key={s.key} label={s.label} value={stats[s.key] ?? 0} />)}
      </div>

      <ListToolbar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Tìm theo mã / tên bản khai báo…"
        filters={
          <>
            <QuickFilter value={status} options={STATUS} onChange={(v) => { setStatus(v); setPage(1); }} />
            {periods.length > 0 && (
              <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} style={{ minWidth: 130 }}>
                <option value="">Mọi kỳ</option>
                {periods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value as 'updated' | 'title')} style={{ minWidth: 150 }}>
              <option value="updated">Sắp xếp: Mới cập nhật</option>
              <option value="title">Sắp xếp: Tên A→Z</option>
            </select>
          </>
        }
      />

      {q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pageRows}
            loading={q.isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/material-declarations/${r.id}`)}
            emptyTitle="Không có bản khai báo phù hợp"
            emptyHint="Điều chỉnh bộ lọc hoặc bấm 'Tạo bản khai báo'."
          />
          {filtered.length > PAGE_SIZE && (
            <Pagination page={page} size={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }} className="num">{value}</div>
    </div>
  );
}
