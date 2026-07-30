import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { EDITABLE_STATUSES } from '../lib/workflow';

// Kho trạm do xã khai báo. Cùng luồng duyệt như doanh trại:
// DRAFT → (gửi duyệt) PENDING_REVIEW → (chỉ huy xã duyệt) APPROVED.
interface StorageRow {
  id: string;
  code: string;
  name: string;
  type: string | null;
  areaId: string | null;
  areaName: string | null;
  barracksName: string | null;
  workflowStatus: string;
  status: string;
  updatedAt: string;
}
interface AreaOpt { id: string; name: string }

export function StoragePage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const size = 15;
  const canManage = hasRole('BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN');
  const canReview = hasRole('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({
    queryKey: ['storage-list', page, search, status],
    queryFn: async () => (await api.get('/inventory/storage-locations', { params: { page, size, search: search || undefined, status: status || undefined } })).data as { data: StorageRow[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'submit' | 'approve' | 'request-changes' }) =>
      api.post(`/inventory/storage-locations/${id}/${action}`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['storage-list'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(v.action === 'submit' ? 'Đã gửi duyệt hồ sơ kho.' : v.action === 'approve' ? 'Đã duyệt hồ sơ kho.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const columns: Column<StorageRow>[] = [
    { key: 'code', header: 'Mã kho', render: (r) => r.code, mono: true, width: 120 },
    { key: 'name', header: 'Tên kho', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'area', header: 'Địa bàn / Doanh trại', render: (r) => r.areaName ?? r.barracksName ?? '—' },
    { key: 'wf', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {canManage && EDITABLE_STATUSES.includes(r.workflowStatus) && (
            <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'submit' })}>
              <Icon name="upload" size={13} /> Gửi duyệt
            </button>
          )}
          {canReview && r.workflowStatus === 'PENDING_REVIEW' && (
            <>
              <button className="btn btn-sm" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'request-changes' })}>Trả lại</button>
              <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'approve' })}><Icon name="check" size={13} /> Duyệt</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Khai báo địa bàn"
        title="Kho trạm"
        description="Xã khai báo kho/trạm trên địa bàn; gửi chỉ huy xã duyệt. Kho đã duyệt là dữ liệu chính thức để cấp Tỉnh nắm."
        actions={canManage ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Khai báo kho</button> : undefined}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Tìm theo mã hoặc tên kho…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="CHANGES_REQUESTED">Yêu cầu bổ sung</option>
          <option value="APPROVED">Đã duyệt</option>
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có kho trạm" />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {creating && <CreateStorageModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['storage-list'] }); }} />}
    </>
  );
}

function CreateStorageModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const type = useCatalog('storage-location-type');
  const areas = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: AreaOpt[] } });
  const [f, setF] = useState({ code: '', name: '', type: '', areaId: '' });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => api.post('/inventory/storage-locations', { code: f.code, name: f.name, type: f.type || undefined, areaId: f.areaId || undefined }),
    onSuccess: () => { toast.success('Đã khai báo kho (nháp).'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Khai báo kho / trạm" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mã kho</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="KHO-A01" /></div>
          <div style={{ flex: 2 }}><label className="field-label">Tên kho</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Loại kho</label><select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}><option value="">—</option>{type.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Địa bàn (xã/phường)</label><select className="input" value={f.areaId} onChange={(e) => setF((s) => ({ ...s, areaId: e.target.value }))}><option value="">—</option>{(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.code.length < 2 || f.name.length < 2 || create.isPending} onClick={() => create.mutate()}>Tạo (nháp)</button></div>
      </div>
    </Modal>
  );
}
