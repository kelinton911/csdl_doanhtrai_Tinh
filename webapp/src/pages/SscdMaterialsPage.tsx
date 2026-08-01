import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { EDITABLE_STATUSES } from '../lib/workflow';
import { READINESS_STATES, READINESS_STATE_LABEL, readinessLabel } from '../lib/sscd';

// Trục B — Khai báo vật chất SSCĐ theo 4 mức. Cùng luồng duyệt như kho/doanh trại.
interface PlanRow {
  id: string;
  areaId: string | null;
  areaName: string | null;
  readinessState: string;
  workflowStatus: string;
  copiedFromState: string | null;
  lineCount: number;
  updatedAt: string;
}
interface AreaOpt { id: string; name: string }

export function SscdMaterialsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [areaId, setAreaId] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const size = 15;
  const canManage = can('BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN');
  const canReview = can('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const areas = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: AreaOpt[] } });
  const q = useQuery({
    queryKey: ['sscd-list', page, areaId, state, status],
    queryFn: async () => (await api.get('/readiness-materials', { params: { page, size, areaId: areaId || undefined, readinessState: state || undefined, status: status || undefined } })).data as { data: PlanRow[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'submit' | 'approve' | 'request-changes' }) =>
      api.post(`/readiness-materials/${id}/${action}`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['sscd-list'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(v.action === 'submit' ? 'Đã gửi duyệt bản SSCĐ.' : v.action === 'approve' ? 'Đã duyệt bản SSCĐ.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const columns: Column<PlanRow>[] = [
    { key: 'area', header: 'Xã/phường', render: (r) => <span style={{ fontWeight: 600 }}>{r.areaName ?? '—'}</span> },
    { key: 'state', header: 'Mức SSCĐ', render: (r) => <span className="badge" style={{ fontWeight: 700 }}>{readinessLabel(r.readinessState)}</span> },
    { key: 'copied', header: 'Nguồn', render: (r) => (r.copiedFromState ? <span className="muted" style={{ fontSize: 12 }}>↩ {readinessLabel(r.copiedFromState)}</span> : '—') },
    { key: 'lines', header: 'Số dòng', render: (r) => r.lineCount, align: 'right', mono: true },
    { key: 'wf', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); nav(`/sscd-materials/${r.id}`); }}>Mở</button>
          {canManage && EDITABLE_STATUSES.includes(r.workflowStatus) && (
            <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: 'submit' }); }}>
              <Icon name="upload" size={13} /> Gửi duyệt
            </button>
          )}
          {canReview && r.workflowStatus === 'PENDING_REVIEW' && (
            <>
              <button className="btn btn-sm" disabled={act.isPending} onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: 'request-changes' }); }}>Trả lại</button>
              <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, action: 'approve' }); }}><Icon name="check" size={13} /> Duyệt</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Sẵn sàng chiến đấu"
        title="Khai báo vật chất SSCĐ theo mức"
        description="Xã khai báo vật chất theo 4 mức Thường xuyên → Tăng cường → Cao → Toàn bộ. Khi nâng mức, sao chép từ mức liền dưới đã duyệt rồi chỉnh sửa. Chỉ huy xã duyệt; cấp Tỉnh tổng hợp."
        actions={canManage ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo bản khai báo</button> : undefined}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 240 }} value={areaId} onChange={(e) => { setPage(1); setAreaId(e.target.value); }}>
          <option value="">Tất cả xã</option>
          {(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 180 }} value={state} onChange={(e) => { setPage(1); setState(e.target.value); }}>
          <option value="">Tất cả mức</option>
          {READINESS_STATES.map((s) => <option key={s} value={s}>{READINESS_STATE_LABEL[s]}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 190 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="CHANGES_REQUESTED">Yêu cầu bổ sung</option>
          <option value="APPROVED">Đã duyệt</option>
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/sscd-materials/${r.id}`)} emptyTitle="Chưa có bản khai báo SSCĐ" />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {creating && <CreatePlanModal onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); qc.invalidateQueries({ queryKey: ['sscd-list'] }); nav(`/sscd-materials/${id}`); }} />}
    </>
  );
}

function CreatePlanModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const areas = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: AreaOpt[] } });
  const [f, setF] = useState({ areaId: '', readinessState: 'THUONG_XUYEN', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => (await api.post('/readiness-materials', { areaId: f.areaId, readinessState: f.readinessState, notes: f.notes || undefined })).data as { id: string },
    onSuccess: (d) => { toast.success('Đã tạo bản khai báo (nháp).'); onDone(d.id); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Tạo bản khai báo vật chất SSCĐ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Xã/phường</label><select className="input" value={f.areaId} onChange={(e) => setF((s) => ({ ...s, areaId: e.target.value }))}><option value="">— Chọn xã —</option>{(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="field-label">Mức SSCĐ</label><select className="input" value={f.readinessState} onChange={(e) => setF((s) => ({ ...s, readinessState: e.target.value }))}>{READINESS_STATES.map((s) => <option key={s} value={s}>{READINESS_STATE_LABEL[s]}</option>)}</select></div>
        <div><label className="field-label">Ghi chú</label><input className="input" value={f.notes} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} placeholder="Căn cứ / ghi chú" /></div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Mẹo: với mức cao hơn (Tăng cường/Cao/Toàn bộ), sau khi tạo hãy dùng "Sao chép từ mức trước" trong trang chi tiết.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.areaId || create.isPending} onClick={() => create.mutate()}>Tạo (nháp)</button></div>
      </div>
    </Modal>
  );
}
