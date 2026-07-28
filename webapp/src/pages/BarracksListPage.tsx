import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';

interface Row {
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  orgName: string | null;
  landArea: number;
  declaredCapacity: number;
  facilityCount: number;
  workflowStatus: string;
  updatedAt: string;
}

const QUICK = [
  { key: '', label: 'Tất cả' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'CHANGES_REQUESTED', label: 'Yêu cầu bổ sung' },
];

// Danh sách doanh trại (Frontend §6.4) — bảng mạnh, bộ lọc nhanh, tìm kiếm.
export function BarracksListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const size = 15;

  const q = useQuery({
    queryKey: ['barracks', page, search],
    queryFn: async () =>
      (await api.get('/barracks', { params: { page, size, search: search || undefined } })).data as {
        data: Row[];
        meta: { total: number };
      },
    placeholderData: keepPreviousData,
  });

  const rows = (q.data?.data ?? []).filter((r) => !status || r.workflowStatus === status);

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 90 },
    { key: 'name', header: 'Tên doanh trại', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'area', header: 'Xã/phường', render: (r) => r.areaName ?? '—' },
    { key: 'org', header: 'Đơn vị quản lý', render: (r) => r.orgName ?? '—' },
    { key: 'land', header: 'Diện tích (m²)', render: (r) => num(r.landArea), align: 'right', mono: true },
    { key: 'fac', header: 'Số CT', render: (r) => num(r.facilityCount), align: 'right', mono: true },
    { key: 'cap', header: 'Tiếp nhận', render: (r) => num(r.declaredCapacity), align: 'right', mono: true },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Doanh trại và công trình"
        title="Danh sách doanh trại"
        description="Hồ sơ gốc của từng doanh trại: địa bàn, đơn vị quản lý, diện tích, công trình, trạng thái dữ liệu."
        actions={
          <button className="btn btn-primary" onClick={() => nav('/barracks/new')}>
            <Icon name="plus" size={16} /> Tạo hồ sơ
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Tìm theo mã hoặc tên…"
            style={{ paddingLeft: 32 }}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK.map((f) => (
            <button
              key={f.key}
              className="btn btn-sm"
              onClick={() => setStatus(f.key)}
              style={{ background: status === f.key ? 'var(--color-accent-600)' : 'var(--surface-1)', color: status === f.key ? '#fff' : 'var(--color-text)', borderColor: status === f.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            loading={q.isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/barracks/${r.id}`)}
            emptyTitle="Không tìm thấy doanh trại"
            emptyHint="Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
          />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}
