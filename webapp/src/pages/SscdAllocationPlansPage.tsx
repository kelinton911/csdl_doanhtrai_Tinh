import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { EDITABLE_STATUSES } from '../lib/workflow';
import { num } from '../lib/format';
import { SSCD_ALLOCATION_STATES, READINESS_STATE_LABEL } from '../lib/sscd';

// Feature 03 — Phương án phân cấp lượng vật chất SSCĐ của cấp Tỉnh (top-down). 3 tab theo trạng
// thái (Tăng cường/Cao/Toàn bộ) = 3 bảng riêng.
interface PlanRow {
  id: string;
  readinessState: string;
  title: string;
  periodLabel: string | null;
  workflowStatus: string;
  lineCount: number;
  totalQuantity: number;
  updatedAt: string;
}

export function SscdAllocationPlansPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { can } = useAuth();
  const [state, setState] = useState<string>(SSCD_ALLOCATION_STATES[0]);
  const [creating, setCreating] = useState(false);
  const canManage = can('PROVINCIAL_COMMAND', 'SYS_ADMIN');
  const canReview = can('REVIEWER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({
    queryKey: ['sscd-alloc-list', state],
    queryFn: async () =>
      (await api.get('/readiness-allocations', { params: { readinessState: state, size: 100 } }))
        .data as { data: PlanRow[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'submit' | 'approve' | 'request-changes' }) =>
      api.post(`/readiness-allocations/${id}/${action}`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['sscd-alloc-list'] });
      toast.success(v.action === 'submit' ? 'Đã gửi duyệt phương án.' : v.action === 'approve' ? 'Đã duyệt phương án.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const columns: Column<PlanRow>[] = [
    { key: 'title', header: 'Tên phương án', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'period', header: 'Kỳ', render: (r) => r.periodLabel ?? '—' },
    { key: 'lines', header: 'Số dòng', render: (r) => num(r.lineCount), align: 'right', mono: true },
    { key: 'total', header: 'Tổng lượng', render: (r) => num(r.totalQuantity), align: 'right', mono: true },
    { key: 'wf', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); nav(`/sscd-allocations/${r.id}`); }}>Mở</button>
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
        eyebrow="Sẵn sàng chiến đấu — Phương án cấp Tỉnh"
        title="Phương án phân cấp lượng vật chất SSCĐ"
        description="Cơ quan HC-KT Tỉnh xây dựng phương án phân cấp lượng (kho Tỉnh / xã / trung đoàn địa phương / căn cứ) theo quy định Quân khu. Mỗi trạng thái SSCĐ là một bảng riêng."
        actions={canManage ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo phương án</button> : undefined}
      />

      {/* Tab theo trạng thái = 3 bảng riêng. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {SSCD_ALLOCATION_STATES.map((s) => (
          <button
            key={s}
            className={`btn ${state === s ? 'btn-primary' : ''}`}
            onClick={() => setState(s)}
          >
            {READINESS_STATE_LABEL[s]}
          </button>
        ))}
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <DataTable
          columns={columns}
          rows={q.data?.data}
          loading={q.isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/sscd-allocations/${r.id}`)}
          emptyTitle={`Chưa có phương án "${READINESS_STATE_LABEL[state]}"`}
        />
      )}

      {creating && (
        <CreateAllocationModal
          defaultState={state}
          onClose={() => setCreating(false)}
          onDone={(id) => { setCreating(false); qc.invalidateQueries({ queryKey: ['sscd-alloc-list'] }); nav(`/sscd-allocations/${id}`); }}
        />
      )}
    </>
  );
}

function CreateAllocationModal({ defaultState, onClose, onDone }: { defaultState: string; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ readinessState: defaultState, title: '', regulationRef: '', periodLabel: String(new Date().getFullYear()) });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/readiness-allocations', {
        readinessState: f.readinessState,
        title: f.title.trim(),
        regulationRef: f.regulationRef || undefined,
        periodLabel: f.periodLabel || undefined,
      })).data as { id: string },
    onSuccess: (d) => { toast.success('Đã tạo phương án (nháp).'); onDone(d.id); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Tạo phương án phân cấp lượng SSCĐ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Trạng thái SSCĐ</label><select className="input" value={f.readinessState} onChange={(e) => setF((s) => ({ ...s, readinessState: e.target.value }))}>{SSCD_ALLOCATION_STATES.map((s) => <option key={s} value={s}>{READINESS_STATE_LABEL[s]}</option>)}</select></div>
        <div><label className="field-label">Tên phương án</label><input className="input" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} placeholder="VD: Phương án SSCĐ Tăng cường — 2026" /></div>
        <div><label className="field-label">Kỳ/năm hiệu lực</label><input className="input" value={f.periodLabel} onChange={(e) => setF((s) => ({ ...s, periodLabel: e.target.value }))} placeholder="2026" /></div>
        <div><label className="field-label">Căn cứ / chỉ lệnh Quân khu</label><input className="input" value={f.regulationRef} onChange={(e) => setF((s) => ({ ...s, regulationRef: e.target.value }))} placeholder="Số văn bản / chỉ lệnh" /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.title.trim().length < 3 || create.isPending} onClick={() => create.mutate()}>Tạo (nháp)</button></div>
      </div>
    </Modal>
  );
}
