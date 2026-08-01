import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { dateTime } from '../lib/format';
import { TaskStatusChip, PriorityTag } from './TasksListPage';
import { CATEGORY_LABEL, STATUS_LABEL, UPDATE_KIND_LABEL } from '../lib/task';

interface Child { id: string; code: string; title: string; status: string; progressPercent: number; priority: string; dueDate: string | null }
interface Task {
  id: string; code: string; title: string; description: string | null; category: string; priority: string;
  dueDate: string | null; progressPercent: number; status: string;
  targetValue: string | null; targetUnit: string | null; resultValue: string | null; resultNote: string | null;
  assignerName: string | null; assigneeOrgName: string | null; assigneeAreaName: string | null; assigneeUserName: string | null;
  parentTaskId: string | null; parentTitle: string | null; completedAt: string | null; updatedAt: string; children: Child[];
}
interface Update { id: string; kind: string; progressPercent: number | null; note: string | null; createdAt: string }

export function TaskDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [docs, setDocs] = useState(false);
  const [progOpen, setProgOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const t = useQuery({ queryKey: ['task', id], queryFn: async () => (await api.get<Task>(`/tasks/${id}`)).data });
  const updates = useQuery({ queryKey: ['task', id, 'updates'], queryFn: async () => (await api.get<Update[]>(`/tasks/${id}/updates`)).data });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['task', id] }); qc.invalidateQueries({ queryKey: ['task', id, 'updates'] }); qc.invalidateQueries({ queryKey: ['tasks-summary'] }); };
  const act = useMutation({
    mutationFn: async (a: 'start' | 'accept' | 'reject' | 'cancel') => (await api.post(`/tasks/${id}/${a}`, a === 'reject' ? { note: 'Cần bổ sung' } : {})).data,
    onSuccess: (_d, a) => { setErr(null); refresh(); toast.success(a === 'start' ? 'Đã bắt đầu.' : a === 'accept' ? 'Đã nghiệm thu, hoàn thành.' : a === 'reject' ? 'Đã trả lại.' : 'Đã hủy.'); },
    onError: (e) => { setErr(toProblem(e).title); toast.problem(e); },
  });

  if (t.isLoading) return <Skeleton rows={6} />;
  if (t.isError || !t.data) return <ErrorState error={t.error} />;
  const d = t.data;
  const canAssign = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');
  const canExecute = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN', 'COMMUNE_USER', 'REVIEWER');
  const terminal = ['COMPLETED', 'CANCELLED'].includes(d.status);
  const overdue = d.dueDate && !terminal && new Date(d.dueDate) < new Date();
  const assignee = d.assigneeUserName || d.assigneeOrgName || d.assigneeAreaName || '—';

  const childCols: Column<Child>[] = [
    { key: 'code', header: 'Mã', render: (c) => c.code, mono: true, width: 130 },
    { key: 'title', header: 'Nội dung', render: (c) => <span style={{ fontWeight: 600 }}>{c.title}</span> },
    { key: 'prio', header: 'Ưu tiên', render: (c) => <PriorityTag p={c.priority} /> },
    { key: 'prog', header: 'Tiến độ', render: (c) => <span className="num">{c.progressPercent}%</span>, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (c) => <TaskStatusChip status={c.status} /> },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/tasks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách nhiệm vụ
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${CATEGORY_LABEL[d.category] ?? d.category}`}
        title={d.title}
        description={`Giao cho: ${assignee}${d.assignerName ? ` · Người giao: ${d.assignerName}` : ''} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <PriorityTag p={d.priority} /> <TaskStatusChip status={d.status} />
            <button className="btn" onClick={() => setDocs(true)}><Icon name="file" size={16} /> Hồ sơ</button>
            {canAssign && !terminal && <button className="btn" onClick={() => nav(`/tasks/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canExecute && d.status === 'ASSIGNED' && <button className="btn btn-primary" onClick={() => act.mutate('start')}><Icon name="chevron" size={16} /> Bắt đầu</button>}
            {canExecute && d.status === 'IN_PROGRESS' && <button className="btn btn-primary" onClick={() => setSubmitOpen(true)}><Icon name="upload" size={16} /> Nộp kết quả</button>}
            {canAssign && d.status === 'SUBMITTED' && <button className="btn" onClick={() => act.mutate('reject')}><Icon name="alert" size={16} /> Trả lại</button>}
            {canAssign && d.status === 'SUBMITTED' && <button className="btn btn-primary" onClick={() => act.mutate('accept')}><Icon name="check" size={16} /> Nghiệm thu</button>}
            {canExecute && !terminal && <button className="btn" onClick={() => setProgOpen(true)}><Icon name="edit" size={16} /> Cập nhật tiến độ</button>}
            {canAssign && !terminal && <button className="btn" onClick={() => { if (confirm('Hủy nhiệm vụ này?')) act.mutate('cancel'); }}><Icon name="logout" size={16} /> Hủy</button>}
          </div>
        }
      />

      {overdue && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}><Icon name="clock" size={18} /> Nhiệm vụ quá hạn — hạn {String(d.dueDate).slice(0, 10)}.</div>}
      {err && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }} className="field-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin nhiệm vụ</div>
          {d.parentTitle && <Field label="Thuộc kế hoạch"><button className="btn btn-sm btn-ghost" style={{ padding: 0 }} onClick={() => d.parentTaskId && nav(`/tasks/${d.parentTaskId}`)}>{d.parentTitle}</button></Field>}
          <FieldT label="Hạn hoàn thành" value={d.dueDate ? String(d.dueDate).slice(0, 10) : '—'} mono />
          <div style={{ margin: '10px 0 4px', fontSize: 12, color: 'var(--color-neutral-600)' }}>Tiến độ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-neutral-200)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${d.progressPercent}%`, background: d.progressPercent >= 100 ? 'var(--ok-fg)' : 'var(--info-fg)' }} /></span>
            <strong className="num">{d.progressPercent}%</strong>
          </div>
          {(d.targetValue || d.resultValue) && <FieldT label="Chỉ tiêu / kết quả" value={`${d.targetValue ?? '—'} → ${d.resultValue ?? '—'} ${d.targetUnit ?? ''}`} mono />}
          {d.description && <p style={{ fontSize: 13.5, marginTop: 12 }}>{d.description}</p>}
          {d.resultNote && <div style={{ marginTop: 10, padding: 10, background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 8, fontSize: 13 }}><b>Kết quả:</b> {d.resultNote}</div>}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Nhật ký cập nhật</div>
          {updates.isLoading ? <Skeleton rows={3} /> : (updates.data ?? []).length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>Chưa có cập nhật.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflow: 'auto' }} className="scrl">
              {(updates.data ?? []).map((u) => (
                <div key={u.id} style={{ borderLeft: '3px solid var(--color-accent-600)', paddingLeft: 10 }}>
                  <div style={{ fontSize: 12.5 }}><b>{UPDATE_KIND_LABEL[u.kind] ?? u.kind}</b>{u.progressPercent != null ? ` · ${u.progressPercent}%` : ''}</div>
                  {u.note && <div style={{ fontSize: 13 }}>{u.note}</div>}
                  <div className="muted num" style={{ fontSize: 11 }}>{dateTime(u.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nhiệm vụ con (cây kế hoạch) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 12px' }}>
        <div className="eyebrow">Nhiệm vụ con ({d.children.length})</div>
        {canAssign && <button className="btn btn-sm" onClick={() => nav(`/tasks/new?parent=${id}`)}><Icon name="plus" size={14} /> Thêm nhiệm vụ con</button>}
      </div>
      {d.children.length > 0 && <DataTable columns={childCols} rows={d.children} rowKey={(c) => c.id} onRowClick={(c) => nav(`/tasks/${c.id}`)} emptyTitle="Chưa có nhiệm vụ con" />}
      {d.children.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Chưa có nhiệm vụ con.</div>}

      {docs && <EvidenceDrawer entityType="task" entityId={id!} title={`Hồ sơ nhiệm vụ · ${d.code}`} onClose={() => setDocs(false)} />}
      {progOpen && <ProgressModal taskId={id!} current={d.progressPercent} onClose={() => setProgOpen(false)} onDone={() => { setProgOpen(false); refresh(); }} />}
      {submitOpen && <SubmitModal taskId={id!} onClose={() => setSubmitOpen(false)} onDone={() => { setSubmitOpen(false); refresh(); }} />}
    </>
  );
}

function ProgressModal({ taskId, current, onClose, onDone }: { taskId: string; current: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ kind: 'PROGRESS', progressPercent: String(current), note: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/tasks/${taskId}/updates`, { kind: f.kind, progressPercent: f.kind === 'PROGRESS' ? Number(f.progressPercent) : undefined, note: f.note || undefined }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Cập nhật tiến độ / trao đổi" onClose={onClose} width={440}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Loại</label><select className="input" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))}><option value="PROGRESS">Tiến độ</option><option value="COMMENT">Trao đổi</option></select></div>
        {f.kind === 'PROGRESS' && <div><label className="field-label">Tiến độ (%)</label><input className="input num" type="number" min={0} max={100} value={f.progressPercent} onChange={(e) => setF((s) => ({ ...s, progressPercent: e.target.value }))} /></div>}
        <div><label className="field-label">Ghi chú</label><textarea className="input" rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Lưu</button></div>
      </div>
    </Modal>
  );
}

function SubmitModal({ taskId, onClose, onDone }: { taskId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ resultNote: '', resultValue: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/tasks/${taskId}/submit`, { resultNote: f.resultNote || undefined, resultValue: f.resultValue ? Number(f.resultValue) : undefined }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Nộp kết quả nhiệm vụ" onClose={onClose} width={460}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Kết quả thực hiện</label><textarea className="input" rows={3} value={f.resultNote} onChange={(e) => setF((s) => ({ ...s, resultNote: e.target.value }))} /></div>
        <div><label className="field-label">Giá trị đạt được (nếu có chỉ tiêu)</label><input className="input num" type="number" value={f.resultValue} onChange={(e) => setF((s) => ({ ...s, resultValue: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Nộp kết quả</button></div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12, alignItems: 'center' }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span>{children}</span></div>);
}
function FieldT({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span></div>);
}
