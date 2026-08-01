import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState } from '../components/States';
import { currency, dateTime, num } from '../lib/format';

interface Req { id: string; code: string; title: string; priority: string; estimatedCost: string; plannedDays: number; status: string; createdBy: string | null; barracksId: string | null; acceptanceNote: string | null; assigneeName: string | null }
interface Damage { id: string; entityType: string; entityId: string; severity: string; description: string | null; estimatedLoss: string; status: string; scenario: boolean; occurredAt: string }
interface Barracks { id: string; name: string }

const PRIORITY: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Thấp', color: 'var(--color-neutral-600)' },
  NORMAL: { label: 'Bình thường', color: 'var(--info-fg)' },
  HIGH: { label: 'Cao', color: 'var(--warn-fg)' },
  URGENT: { label: 'Khẩn', color: 'var(--danger-fg)' },
};
const SEVERITY: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Nhẹ', color: 'var(--color-neutral-600)' },
  MEDIUM: { label: 'Vừa', color: 'var(--info-fg)' },
  HIGH: { label: 'Nặng', color: 'var(--warn-fg)' },
  CRITICAL: { label: 'Nghiêm trọng', color: 'var(--danger-fg)' },
};

export function MaintenancePage() {
  const [tab, setTab] = useState<'requests' | 'damages'>('requests');
  return (
    <>
      <PageHeader eyebrow="Sửa chữa - khôi phục" title="Sửa chữa và khôi phục" description="Ghi nhận hư hỏng, lập yêu cầu sửa chữa, theo dõi phê duyệt và nghiệm thu. Kinh phí định dạng tiền tệ vi-VN." />
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>Yêu cầu sửa chữa</TabBtn>
        <TabBtn active={tab === 'damages'} onClick={() => setTab('damages')}>Ghi nhận hư hỏng</TabBtn>
      </div>
      {tab === 'requests' ? <RequestsTab /> : <DamagesTab />}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ all: 'unset', cursor: 'pointer', padding: '10px 16px', fontWeight: active ? 700 : 500, color: active ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: active ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{children}</button>;
}

function RequestsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Req | null>(null);
  const q = useQuery({ queryKey: ['maint-requests'], queryFn: async () => (await api.get('/maintenance-requests', { params: { size: 100 } })).data as { data: Req[] } });

  const columns: Column<Req>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 110 },
    { key: 'title', header: 'Nội dung', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'prio', header: 'Ưu tiên', render: (r) => <span style={{ color: PRIORITY[r.priority]?.color, fontWeight: 600 }}>{PRIORITY[r.priority]?.label ?? r.priority}</span> },
    { key: 'cost', header: 'Kinh phí', render: (r) => currency(r.estimatedCost), align: 'right', mono: true },
    { key: 'days', header: 'Số ngày', render: (r) => num(r.plannedDays), align: 'right', mono: true },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Lập yêu cầu</button>
      </div>
      {q.isError ? <ErrorState error={q.error} /> : <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => setDetail(r)} emptyTitle="Chưa có yêu cầu sửa chữa" />}
      {creating && <CreateReqModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['maint-requests'] }); }} />}
      {detail && <ReqDetailModal req={detail} onClose={() => setDetail(null)} onChanged={() => qc.invalidateQueries({ queryKey: ['maint-requests'] })} />}
    </>
  );
}

const LIFECYCLE = ['DRAFT', 'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'ACCEPTED', 'CLOSED'];

const ACT_LABEL: Record<string, string> = { submit: 'Đã trình thẩm định.', approve: 'Đã phê duyệt yêu cầu.', start: 'Đã bắt đầu thực hiện.', accept: 'Đã nghiệm thu.', close: 'Đã đóng yêu cầu.' };

function ReqDetailModal({ req, onClose, onChanged }: { req: Req; onClose: () => void; onChanged: () => void }) {
  const { profile, can } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(false);
  const [assignee, setAssignee] = useState(req.assigneeName ?? '');
  // Lấy bản chi tiết mới nhất từ server (GET /maintenance-requests/:id) khi mở modal — phản ánh
  // đúng trạng thái/assignee/nghiệm thu hiện tại, kể cả khi người khác vừa thay đổi. Hiển thị ngay
  // dữ liệu dòng list (initialData) rồi làm mới. Các hành động ghi thẳng kết quả vào cache.
  const detailQ = useQuery({
    queryKey: ['maint-request', req.id],
    queryFn: async () => (await api.get(`/maintenance-requests/${req.id}`)).data as Req,
    initialData: req,
  });
  const cur = detailQ.data ?? req;
  const act = useMutation({
    mutationFn: async (action: string) => {
      const body = action === 'accept' ? { note: 'Nghiệm thu đạt yêu cầu' } : action === 'start' ? { assigneeName: assignee || undefined } : {};
      return (await api.post(`/maintenance-requests/${req.id}/${action}`, body)).data as Req;
    },
    onSuccess: (d, action) => { qc.setQueryData(['maint-request', req.id], d); setError(null); onChanged(); toast.success(ACT_LABEL[action] ?? 'Đã cập nhật yêu cầu.'); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });
  const isCreator = profile?.id === cur.createdBy;
  const step = LIFECYCLE.indexOf(cur.status);

  return (
    <Modal open title={`${cur.code} — ${cur.title}`} onClose={onClose} width={560}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        {LIFECYCLE.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: i <= step ? 'var(--teal)' : 'var(--color-neutral-300)', flexShrink: 0 }} />
            {i < LIFECYCLE.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? 'var(--teal)' : 'var(--color-neutral-300)' }} />}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <StatusBadge status={cur.status} />
        <span className="num" style={{ fontWeight: 700 }}>{currency(cur.estimatedCost)}</span>
      </div>
      {cur.assigneeName && <div className="muted" style={{ marginBottom: 8, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="user" size={14} /> Kỹ thuật viên: <b>{cur.assigneeName}</b></div>}
      {cur.acceptanceNote && <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>Nghiệm thu: {cur.acceptanceNote}</div>}

      {cur.status === 'APPROVED' && (
        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Phân công kỹ thuật viên (khi bắt đầu)</label>
          <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Họ tên KTV hoặc đơn vị thi công" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => setEvidence(true)}><Icon name="file" size={15} /> Tài liệu/Ảnh</button>
        {cur.status === 'DRAFT' && <button className="btn btn-primary" onClick={() => act.mutate('submit')}>Trình thẩm định</button>}
        {cur.status === 'PROPOSED' && can('PROVINCIAL_COMMAND', 'BARRACKS_OFFICER') && !isCreator && <button className="btn btn-primary" onClick={() => act.mutate('approve')}>Phê duyệt</button>}
        {cur.status === 'PROPOSED' && isCreator && <span className="muted" style={{ fontSize: 12 }}>Người lập không tự duyệt</span>}
        {cur.status === 'APPROVED' && <button className="btn btn-primary" onClick={() => act.mutate('start')}>Bắt đầu thực hiện</button>}
        {cur.status === 'IN_PROGRESS' && <button className="btn btn-primary" onClick={() => act.mutate('accept')}>Nghiệm thu</button>}
        {cur.status === 'ACCEPTED' && <button className="btn" onClick={() => act.mutate('close')}>Đóng yêu cầu</button>}
      </div>
      {evidence && <EvidenceDrawer entityType="maintenance-request" entityId={cur.id} title={`Tài liệu sửa chữa · ${cur.code}`} onClose={() => setEvidence(false)} />}
    </Modal>
  );
}

function CreateReqModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', title: '', barracksId: '', priority: 'NORMAL', estimatedCost: '', plannedDays: '', assigneeName: '' });
  const [error, setError] = useState<string | null>(null);
  const barracks = useQuery({ queryKey: ['barracks-all'], queryFn: async () => (await api.get('/barracks', { params: { size: 200 } })).data as { data: Barracks[] } });
  const create = useMutation({
    mutationFn: async () => api.post('/maintenance-requests', { code: f.code, title: f.title, barracksId: f.barracksId || undefined, priority: f.priority, estimatedCost: f.estimatedCost ? Number(f.estimatedCost) : undefined, plannedDays: f.plannedDays ? Number(f.plannedDays) : undefined, assigneeName: f.assigneeName || undefined }),
    onSuccess: () => { toast.success('Đã lập yêu cầu sửa chữa (nháp).'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open title="Lập yêu cầu sửa chữa" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Mã yêu cầu</label><input className="input" value={f.code} onChange={set('code')} placeholder="SC-2026-001" /></div>
        <div><label className="field-label">Nội dung</label><input className="input" value={f.title} onChange={set('title')} placeholder="Sửa chữa…" /></div>
        <div><label className="field-label">Doanh trại</label><select className="input" value={f.barracksId} onChange={set('barracksId')}><option value="">— Chọn —</option>{(barracks.data?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Ưu tiên</label><select className="input" value={f.priority} onChange={set('priority')}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Số ngày</label><input className="input num" type="number" value={f.plannedDays} onChange={set('plannedDays')} /></div>
        </div>
        <div><label className="field-label">Kinh phí dự kiến (đồng)</label><input className="input num" type="number" value={f.estimatedCost} onChange={set('estimatedCost')} placeholder="0" /></div>
        <div><label className="field-label">Kỹ thuật viên/nhà thầu (tùy chọn)</label><input className="input" value={f.assigneeName} onChange={set('assigneeName')} placeholder="Họ tên KTV hoặc đơn vị thi công" /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!f.code || !f.title || create.isPending} onClick={() => create.mutate()}><Icon name="check" size={15} /> Lưu nháp</button>
        </div>
      </div>
    </Modal>
  );
}

function DamagesTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Damage | null>(null);
  const [docDamage, setDocDamage] = useState<Damage | null>(null);
  const q = useQuery({ queryKey: ['damages'], queryFn: async () => (await api.get('/damage-events', { params: { size: 100 } })).data as { data: Damage[] } });
  const verify = useMutation({
    mutationFn: async (id: string) => api.post(`/damage-events/${id}/verify`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['damages'] }); toast.success('Đã xác minh sự kiện hư hỏng.'); },
    onError: (e) => toast.problem(e, 'Không xác minh được'),
  });

  const columns: Column<Damage>[] = [
    { key: 'occurred', header: 'Thời điểm', render: (d) => dateTime(d.occurredAt), mono: true },
    { key: 'desc', header: 'Mô tả', render: (d) => <span style={{ fontWeight: 600 }}>{d.description ?? '—'}</span> },
    { key: 'sev', header: 'Mức độ', render: (d) => <span style={{ color: SEVERITY[d.severity]?.color, fontWeight: 600 }}>{SEVERITY[d.severity]?.label ?? d.severity}</span> },
    { key: 'loss', header: 'Ước tính', render: (d) => currency(d.estimatedLoss), align: 'right', mono: true },
    { key: 'scenario', header: 'Loại', render: (d) => d.scenario ? <span style={{ color: 'var(--warn-fg)', fontSize: 12 }}>Mô phỏng</span> : <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}>Thực</span> },
    { key: 'status', header: 'Trạng thái', render: (d) => d.status === 'VERIFIED' ? <StatusBadge status="APPROVED" /> : <span style={{ display: 'inline-flex', gap: 6 }}><StatusBadge status="PENDING_REVIEW" /></span> },
    { key: 'act', header: '', align: 'right', render: (d) => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setDocDamage(d); }} title="Ảnh minh chứng"><Icon name="file" size={14} /></button>
        {d.status !== 'VERIFIED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(d); }}><Icon name="edit" size={14} /> Sửa</button>}
        {d.status !== 'VERIFIED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); verify.mutate(d.id); }}><Icon name="check" size={14} /> Xác minh</button>}
      </div>
    ) },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Ghi nhận hư hỏng</button>
      </div>
      {q.isError ? <ErrorState error={q.error} /> : <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(d) => d.id} emptyTitle="Chưa ghi nhận hư hỏng" />}
      {creating && <CreateDamageModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['damages'] }); }} />}
      {editing && <EditDamageModal damage={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['damages'] }); }} />}
      {docDamage && <EvidenceDrawer entityType="damage-event" entityId={docDamage.id} title="Ảnh & minh chứng hư hỏng" onClose={() => setDocDamage(null)} />}
    </>
  );
}

// E3 — Sửa sự kiện hư hỏng khi chưa xác minh (M09/UC-13).
function EditDamageModal({ damage, onClose, onDone }: { damage: Damage; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ severity: damage.severity, description: damage.description ?? '', estimatedLoss: String(damage.estimatedLoss ?? '') });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.put(`/damage-events/${damage.id}`, { severity: f.severity, description: f.description || undefined, estimatedLoss: f.estimatedLoss ? Number(f.estimatedLoss) : undefined }),
    onSuccess: () => { toast.success('Đã lưu sự kiện hư hỏng.'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Sửa sự kiện hư hỏng" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mức độ</label><select className="input" value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Ước tính thiệt hại (đồng)</label><input className="input num" type="number" value={f.estimatedLoss} onChange={(e) => setF((s) => ({ ...s, estimatedLoss: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Lưu thay đổi</button></div>
      </div>
    </Modal>
  );
}

function CreateDamageModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ entityId: '', severity: 'MEDIUM', description: '', estimatedLoss: '', scenario: false });
  const [error, setError] = useState<string | null>(null);
  const barracks = useQuery({ queryKey: ['barracks-all'], queryFn: async () => (await api.get('/barracks', { params: { size: 200 } })).data as { data: Barracks[] } });
  const create = useMutation({
    mutationFn: async () => api.post('/damage-events', { entityType: 'barracks', entityId: f.entityId, severity: f.severity, description: f.description || undefined, estimatedLoss: f.estimatedLoss ? Number(f.estimatedLoss) : undefined, scenario: f.scenario }),
    onSuccess: () => { toast.success('Đã ghi nhận hư hỏng.'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Ghi nhận hư hỏng" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Doanh trại bị ảnh hưởng</label><select className="input" value={f.entityId} onChange={(e) => setF((s) => ({ ...s, entityId: e.target.value }))}><option value="">— Chọn —</option>{(barracks.data?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mức độ</label><select className="input" value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Ước tính thiệt hại (đồng)</label><input className="input num" type="number" value={f.estimatedLoss} onChange={(e) => setF((s) => ({ ...s, estimatedLoss: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} placeholder="Nguyên nhân, hiện trạng…" /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={f.scenario} onChange={(e) => setF((s) => ({ ...s, scenario: e.target.checked }))} /> Dữ liệu mô phỏng (tình huống giả định)
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!f.entityId || create.isPending} onClick={() => create.mutate()}><Icon name="check" size={15} /> Ghi nhận</button>
        </div>
      </div>
    </Modal>
  );
}
