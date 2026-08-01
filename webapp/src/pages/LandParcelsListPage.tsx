import { useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';
import { USAGE_LABEL, LEGAL_LABEL, DISPUTE_LABEL, disputeColor } from '../lib/landParcel';

interface Row {
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  orgName: string | null;
  landArea: number;
  usageStatus: string;
  legalStatus: string;
  disputeStatus: string;
  workflowStatus: string;
  markerCount: number;
  updatedAt: string;
}

const QUICK = [
  { key: '', label: 'Tất cả' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'CHANGES_REQUESTED', label: 'Yêu cầu bổ sung' },
];

function DisputeChip({ status }: { status: string }) {
  const c = disputeColor(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.fg }} />
      {DISPUTE_LABEL[status] ?? status}
    </span>
  );
}

// M04 — Danh sách hồ sơ khu đất quốc phòng.
export function LandParcelsListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dispute, setDispute] = useState('');
  const size = 15;

  const q = useQuery({
    queryKey: ['land-parcels', page, search, dispute],
    queryFn: async () =>
      (await api.get('/land-parcels', { params: { page, size, search: search || undefined, disputeStatus: dispute || undefined } })).data as {
        data: Row[];
        meta: { total: number };
      },
    placeholderData: keepPreviousData,
  });

  const rows = (q.data?.data ?? []).filter((r) => !status || r.workflowStatus === status);

  const exporting = useMutation({
    mutationFn: async () => {
      const all = (await api.get('/land-parcels', { params: { page: 1, size: 1000, search: search || undefined, disputeStatus: dispute || undefined } })).data.data as Row[];
      const filtered = all.filter((r) => !status || r.workflowStatus === status);
      const cols: CsvColumn<Row>[] = [
        { header: 'Mã', value: (r) => r.code },
        { header: 'Tên khu đất', value: (r) => r.name },
        { header: 'Xã/phường', value: (r) => r.areaName ?? '' },
        { header: 'Đơn vị quản lý', value: (r) => r.orgName ?? '' },
        { header: 'Diện tích (m2)', value: (r) => r.landArea },
        { header: 'Hiện trạng', value: (r) => USAGE_LABEL[r.usageStatus] ?? r.usageStatus },
        { header: 'Pháp lý', value: (r) => LEGAL_LABEL[r.legalStatus] ?? r.legalStatus },
        { header: 'Tranh chấp', value: (r) => DISPUTE_LABEL[r.disputeStatus] ?? r.disputeStatus },
        { header: 'Số mốc giới', value: (r) => r.markerCount },
        { header: 'Trạng thái', value: (r) => r.workflowStatus },
      ];
      downloadCsv(`khu-dat-quoc-phong-${new Date().toISOString().slice(0, 10)}`, filtered, cols);
      return filtered.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 110 },
    { key: 'name', header: 'Tên khu đất', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'area', header: 'Xã/phường', render: (r) => r.areaName ?? '—' },
    { key: 'land', header: 'Diện tích (m²)', render: (r) => num(r.landArea), align: 'right', mono: true },
    { key: 'usage', header: 'Hiện trạng', render: (r) => USAGE_LABEL[r.usageStatus] ?? r.usageStatus },
    { key: 'legal', header: 'Pháp lý', render: (r) => LEGAL_LABEL[r.legalStatus] ?? r.legalStatus },
    { key: 'dispute', header: 'Tranh chấp', render: (r) => <DisputeChip status={r.disputeStatus} /> },
    { key: 'markers', header: 'Mốc', render: (r) => num(r.markerCount), align: 'right', mono: true, width: 60 },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Đất & địa điểm"
        title="Hồ sơ khu đất quốc phòng"
        description="Quản lý khu đất, ranh giới, mốc giới, nguồn gốc & hồ sơ pháp lý, tình trạng tranh chấp/lấn chiếm."
        actions={
          <button className="btn btn-primary" onClick={() => nav('/land-parcels/new')}>
            <Icon name="plus" size={16} /> Tạo hồ sơ khu đất
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Tìm theo mã hoặc tên khu đất…"
            style={{ paddingLeft: 32 }}
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
        <select className="input" style={{ maxWidth: 200 }} value={dispute} onChange={(e) => { setPage(1); setDispute(e.target.value); }}>
          <option value="">Mọi tình trạng đất</option>
          <option value="NONE">Bình thường</option>
          <option value="DISPUTED">Có tranh chấp</option>
          <option value="ENCROACHED">Bị lấn chiếm</option>
        </select>
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
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting.isPending} onClick={() => exporting.mutate()} title="Xuất kết quả đang lọc ra CSV">
          <Icon name="download" size={14} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
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
            onRowClick={(r) => nav(`/land-parcels/${r.id}`)}
            emptyTitle="Không tìm thấy khu đất"
            emptyHint="Thử đổi bộ lọc hoặc tạo hồ sơ khu đất mới."
          />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}
