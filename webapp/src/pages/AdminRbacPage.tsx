import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState } from '../components/States';
import { dateTime } from '../lib/format';

// ===== Kiểu dữ liệu API (khớp modules/rbac backend) =====
interface Position { id: string; code: string; name: string; description: string | null; positionScope: string; level: number; isActive: boolean }
interface AppFunction { id: string; code: string; name: string; description: string | null; module: string; actionType: string; isCritical: boolean; isActive: boolean }
interface PositionFunctionRow { id: string; functionId: string; scope: string; isActive: boolean; function: AppFunction | null }
interface UserRow { id: string; username: string; fullName: string; roles: string[] }
interface UserPositionRow { id: string; userId: string; positionId: string; organizationId: string | null; startDate: string; endDate: string | null; isPrimary: boolean; appointmentDoc: string | null; isActive: boolean; position: Position | null }
interface GrantRow { id: string; userId: string; functionCode: string; scope: string; expiresAt: string | null; reason: string | null; isRevoked: boolean; grantedAt: string; revokedReason: string | null }
interface ConflictRow { id: string; functionCodeA: string; functionCodeB: string; description: string | null; severity: string; isActive: boolean }
interface Org { id: string; code: string; name: string }

const SCOPES = [
  { v: 'SELF', l: 'Cá nhân' },
  { v: 'UNIT', l: 'Đơn vị' },
  { v: 'PROVINCE', l: 'Toàn tỉnh' },
  { v: 'ALL', l: 'Toàn hệ thống' },
];
const POS_SCOPE_LABEL: Record<string, string> = { UNIT: 'Đơn vị', PROVINCE: 'Cấp tỉnh', SYSTEM: 'Hệ thống' };
const ACTION_LABEL: Record<string, string> = { VIEW: 'Xem', CREATE: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xóa', APPROVE: 'Duyệt', EXPORT: 'Xuất', IMPORT: 'Nhập' };
const scopeLabel = (v: string) => SCOPES.find((s) => s.v === v)?.l ?? v;

export function AdminRbacPage() {
  const [tab, setTab] = useState<'positions' | 'appointments' | 'grants' | 'conflicts'>('positions');
  return (
    <>
      <PageHeader eyebrow="Quản trị hệ thống" title="Chức vụ & phân quyền (RBAC)" description="Quản lý chức vụ, ma trận phân quyền theo chức năng, bổ nhiệm tài khoản, cấp quyền lẻ và xung đột tách biệt trách nhiệm (SoD)." />
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        <Tab active={tab === 'positions'} onClick={() => setTab('positions')}>Chức vụ & ma trận quyền</Tab>
        <Tab active={tab === 'appointments'} onClick={() => setTab('appointments')}>Bổ nhiệm</Tab>
        <Tab active={tab === 'grants'} onClick={() => setTab('grants')}>Cấp quyền lẻ</Tab>
        <Tab active={tab === 'conflicts'} onClick={() => setTab('conflicts')}>Xung đột (SoD)</Tab>
      </div>
      {tab === 'positions' && <PositionsTab />}
      {tab === 'appointments' && <AppointmentsTab />}
      {tab === 'grants' && <GrantsTab />}
      {tab === 'conflicts' && <ConflictsTab />}
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ all: 'unset', cursor: 'pointer', padding: '10px 16px', fontWeight: active ? 700 : 500, color: active ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: active ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{children}</button>;
}

// ============ TAB 1: Chức vụ + ma trận phân quyền ============
function PositionsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [matrix, setMatrix] = useState<Position | null>(null);
  const positions = useQuery({ queryKey: ['rbac-positions'], queryFn: async () => (await api.get('/rbac/positions', { params: { size: 200 } })).data as { data: Position[] } });
  const deactivate = useMutation({ mutationFn: async (id: string) => api.delete(`/rbac/positions/${id}`), onSuccess: () => { toast.success('Đã vô hiệu hóa chức vụ.'); qc.invalidateQueries({ queryKey: ['rbac-positions'] }); }, onError: (e) => toast.problem(e, 'Không vô hiệu hóa được') });

  const columns: Column<Position>[] = [
    { key: 'code', header: 'Mã', render: (p) => <span className="num" style={{ fontWeight: 600 }}>{p.code}</span>, mono: true, width: 180 },
    { key: 'name', header: 'Chức vụ', render: (p) => <span style={{ fontWeight: 600 }}>{p.name}</span> },
    { key: 'scope', header: 'Phạm vi', render: (p) => POS_SCOPE_LABEL[p.positionScope] ?? p.positionScope },
    { key: 'level', header: 'Cấp', render: (p) => p.level, align: 'right', mono: true, width: 70 },
    { key: 'status', header: 'Trạng thái', render: (p) => <StatusBadge status={p.isActive ? 'ACTIVE' : 'LOCKED'} /> },
    { key: 'act', header: '', align: 'right', render: (p) => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setMatrix(p); }}><Icon name="shield" size={14} /> Phân quyền</button>
        {p.isActive && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm(`Vô hiệu hóa chức vụ ${p.name}?`)) deactivate.mutate(p.id); }}><Icon name="lock" size={14} /></button>}
      </div>
    ) },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Thêm chức vụ</button>
      </div>
      {positions.isError ? <ErrorState error={positions.error} /> : <DataTable columns={columns} rows={positions.data?.data} loading={positions.isLoading} rowKey={(p) => p.id} emptyTitle="Chưa có chức vụ" />}
      {creating && <PositionModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['rbac-positions'] }); }} />}
      {matrix && <MatrixModal position={matrix} onClose={() => setMatrix(null)} />}
    </>
  );
}

function PositionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name: '', description: '', positionScope: 'UNIT', level: 0 });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: async () => api.post('/rbac/positions', { code: f.code, name: f.name, description: f.description || undefined, positionScope: f.positionScope, level: Number(f.level) || 0 }), onSuccess: () => { toast.success('Đã tạo chức vụ.'); onDone(); }, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Thêm chức vụ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mã</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value.toUpperCase() }))} placeholder="VD: TRO_LY_DOANH_TRAI" /></div>
          <div style={{ width: 120 }}><label className="field-label">Cấp (số)</label><input className="input" type="number" value={f.level} onChange={(e) => setF((s) => ({ ...s, level: Number(e.target.value) }))} /></div>
        </div>
        <div><label className="field-label">Tên chức vụ</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div><label className="field-label">Phạm vi chức vụ</label><select className="input" value={f.positionScope} onChange={(e) => setF((s) => ({ ...s, positionScope: e.target.value }))}><option value="UNIT">Đơn vị</option><option value="PROVINCE">Cấp tỉnh</option><option value="SYSTEM">Hệ thống</option></select></div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.code || !f.name || save.isPending} onClick={() => save.mutate()}>Tạo chức vụ</button></div>
      </div>
    </Modal>
  );
}

// Ma trận: chọn chức năng + scope cho một chức vụ. Lưu thay thế toàn bộ (server kiểm SoD).
function MatrixModal({ position, onClose }: { position: Position; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Map functionId -> scope đã chọn.
  const [sel, setSel] = useState<Map<string, string>>(new Map());
  const [seeded, setSeeded] = useState(false);
  const allFns = useQuery({ queryKey: ['rbac-functions-all'], queryFn: async () => (await api.get('/rbac/functions/all')).data as AppFunction[] });
  const current = useQuery({ queryKey: ['rbac-position-functions', position.id], queryFn: async () => (await api.get(`/rbac/positions/${position.id}/functions`)).data as PositionFunctionRow[] });

  if (current.data && !seeded) {
    setSel(new Map(current.data.map((r) => [r.functionId, r.scope])));
    setSeeded(true);
  }

  const save = useMutation({
    mutationFn: async () => api.put(`/rbac/positions/${position.id}/functions`, { functions: [...sel.entries()].map(([functionId, scope]) => ({ functionId, scope })) }),
    onSuccess: () => { toast.success('Đã lưu ma trận phân quyền.'); qc.invalidateQueries({ queryKey: ['rbac-position-functions', position.id] }); onClose(); },
    onError: (e) => setError(toProblem(e).title),
  });

  const toggle = (fnId: string, defaultScope: string) => setSel((m) => { const n = new Map(m); n.has(fnId) ? n.delete(fnId) : n.set(fnId, defaultScope); return n; });
  const setScope = (fnId: string, scope: string) => setSel((m) => { const n = new Map(m); n.set(fnId, scope); return n; });

  // Nhóm chức năng theo module.
  const groups = new Map<string, AppFunction[]>();
  for (const fn of allFns.data ?? []) { const g = groups.get(fn.module) ?? []; g.push(fn); groups.set(fn.module, g); }

  return (
    <Modal open title={`Phân quyền · ${position.name}`} onClose={onClose} width={720}>
      {error && <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Icon name="alert" size={15} /> {error}</div>}
      {allFns.isLoading || current.isLoading ? <Skeleton rows={8} /> : allFns.isError ? <ErrorState error={allFns.error} /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={13} /> Tích chọn chức năng và đặt phạm vi. Cặp chức năng xung đột (SoD) sẽ bị server chặn khi lưu.</span>
            <span className="muted" style={{ fontSize: 12 }}>Đã chọn: <b>{sel.size}</b></span>
          </div>
          <div style={{ maxHeight: '52vh', overflow: 'auto', border: '1px solid var(--color-neutral-300)', borderRadius: 8 }}>
            {[...groups.entries()].map(([mod, fns]) => (
              <div key={mod}>
                <div style={{ position: 'sticky', top: 0, background: 'var(--surface-2, #f5f5f5)', padding: '6px 12px', fontWeight: 700, fontSize: 12, borderBottom: '1px solid var(--color-neutral-200)' }}>{mod}</div>
                {fns.map((fn) => {
                  const checked = sel.has(fn.id);
                  return (
                    <div key={fn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid var(--color-neutral-100)' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(fn.id, 'UNIT')} aria-label={fn.name} />
                      <span style={{ flex: 1, fontSize: 13 }}>
                        {fn.name} {fn.isCritical && <span title="Chức năng nhạy cảm" style={{ color: 'var(--danger-fg)', fontSize: 11 }}>●</span>}
                        <span className="num muted" style={{ fontSize: 11, marginLeft: 6 }}>{fn.code}</span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', minWidth: 42 }}>{ACTION_LABEL[fn.actionType] ?? fn.actionType}</span>
                      <select className="input" style={{ width: 130, padding: '3px 6px', fontSize: 12 }} value={sel.get(fn.id) ?? 'UNIT'} disabled={!checked} onChange={(e) => setScope(fn.id, e.target.value)}>
                        {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Lưu ma trận ({sel.size})</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ============ TAB 2: Bổ nhiệm (User-Positions) ============
function UserPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const users = useQuery({ queryKey: ['rbac-users'], queryFn: async () => (await api.get('/users', { params: { size: 200 } })).data as { data: UserRow[] } });
  return (
    <select className="input" style={{ maxWidth: 320 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Chọn tài khoản —</option>
      {(users.data?.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.username} · {u.fullName}</option>)}
    </select>
  );
}

function AppointmentsTab() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ['rbac-user-positions', userId], enabled: !!userId, queryFn: async () => (await api.get('/rbac/user-positions', { params: { userId } })).data as UserPositionRow[] });
  const end = useMutation({ mutationFn: async (id: string) => api.put(`/rbac/user-positions/${id}/end`, {}), onSuccess: () => { toast.success('Đã miễn nhiệm.'); qc.invalidateQueries({ queryKey: ['rbac-user-positions', userId] }); }, onError: (e) => toast.problem(e, 'Không miễn nhiệm được') });

  const columns: Column<UserPositionRow>[] = [
    { key: 'pos', header: 'Chức vụ', render: (r) => <span style={{ fontWeight: 600 }}>{r.position?.name ?? r.positionId}</span> },
    { key: 'primary', header: 'Chính', render: (r) => r.isPrimary ? <span style={{ fontSize: 11, background: 'var(--color-accent-600)', color: '#fff', padding: '1px 7px', borderRadius: 5 }}>Chức vụ chính</span> : '' },
    { key: 'start', header: 'Từ ngày', render: (r) => dateTime(r.startDate), mono: true },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'LOCKED'} /> },
    { key: 'act', header: '', align: 'right', render: (r) => r.isActive && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm('Miễn nhiệm chức vụ này?')) end.mutate(r.id); }}>Miễn nhiệm</button> },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div><label className="field-label">Tài khoản</label><UserPicker value={userId} onChange={setUserId} /></div>
        {userId && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Bổ nhiệm chức vụ</button>}
      </div>
      {!userId ? <div className="muted" style={{ padding: '32px 8px', textAlign: 'center' }}>Chọn tài khoản để xem/bổ nhiệm chức vụ.</div>
        : list.isError ? <ErrorState error={list.error} /> : <DataTable columns={columns} rows={list.data} loading={list.isLoading} rowKey={(r) => r.id} emptyTitle="Tài khoản chưa được bổ nhiệm chức vụ" />}
      {adding && <AppointModal userId={userId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['rbac-user-positions', userId] }); }} />}
    </>
  );
}

function AppointModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ positionId: '', organizationId: '', isPrimary: false, appointmentDoc: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const positions = useQuery({ queryKey: ['rbac-positions'], queryFn: async () => (await api.get('/rbac/positions', { params: { size: 200 } })).data as { data: Position[] } });
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: async () => (await api.get('/organizations', { params: { size: 200 } })).data as { data: Org[] } });
  const save = useMutation({ mutationFn: async () => api.post('/rbac/user-positions', { userId, positionId: f.positionId, organizationId: f.organizationId || undefined, isPrimary: f.isPrimary, appointmentDoc: f.appointmentDoc || undefined, notes: f.notes || undefined }), onSuccess: () => { toast.success('Đã bổ nhiệm.'); onDone(); }, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Bổ nhiệm chức vụ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Chức vụ</label>
          <select className="input" value={f.positionId} onChange={(e) => setF((s) => ({ ...s, positionId: e.target.value }))}>
            <option value="">— Chọn chức vụ —</option>
            {(positions.data?.data ?? []).filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name} ({POS_SCOPE_LABEL[p.positionScope] ?? p.positionScope})</option>)}
          </select>
        </div>
        <div><label className="field-label">Đơn vị bổ nhiệm (tùy chọn)</label>
          <select className="input" value={f.organizationId} onChange={(e) => setF((s) => ({ ...s, organizationId: e.target.value }))}>
            <option value="">— Không gán (cấp tỉnh/hệ thống) —</option>
            {(orgs.data?.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Số quyết định bổ nhiệm (tùy chọn)</label><input className="input" value={f.appointmentDoc} onChange={(e) => setF((s) => ({ ...s, appointmentDoc: e.target.value }))} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={f.isPrimary} onChange={(e) => setF((s) => ({ ...s, isPrimary: e.target.checked }))} /> Đặt làm chức vụ chính</label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.positionId || save.isPending} onClick={() => save.mutate()}>Bổ nhiệm</button></div>
      </div>
    </Modal>
  );
}

// ============ TAB 3: Cấp quyền lẻ (Grants) ============
function GrantsTab() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ['rbac-grants', userId], enabled: !!userId, queryFn: async () => (await api.get('/rbac/permission-grants', { params: { userId } })).data as GrantRow[] });
  const revoke = useMutation({ mutationFn: async (id: string) => api.post(`/rbac/permission-grants/${id}/revoke`, { reason: 'Thu hồi qua quản trị' }), onSuccess: () => { toast.success('Đã thu hồi quyền.'); qc.invalidateQueries({ queryKey: ['rbac-grants', userId] }); }, onError: (e) => toast.problem(e, 'Không thu hồi được') });

  const columns: Column<GrantRow>[] = [
    { key: 'fn', header: 'Chức năng', render: (g) => <span className="num" style={{ fontWeight: 600 }}>{g.functionCode}</span> },
    { key: 'scope', header: 'Phạm vi', render: (g) => scopeLabel(g.scope) },
    { key: 'exp', header: 'Hết hạn', render: (g) => g.expiresAt ? dateTime(g.expiresAt) : <span className="muted">Không hạn</span>, mono: true },
    { key: 'status', header: 'Trạng thái', render: (g) => g.isRevoked ? <StatusBadge status="LOCKED" /> : <StatusBadge status="ACTIVE" /> },
    { key: 'act', header: '', align: 'right', render: (g) => !g.isRevoked && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm('Thu hồi quyền lẻ này?')) revoke.mutate(g.id); }}>Thu hồi</button> },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div><label className="field-label">Tài khoản</label><UserPicker value={userId} onChange={setUserId} /></div>
        {userId && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Cấp quyền lẻ</button>}
      </div>
      {!userId ? <div className="muted" style={{ padding: '32px 8px', textAlign: 'center' }}>Chọn tài khoản để xem/cấp quyền lẻ.</div>
        : list.isError ? <ErrorState error={list.error} /> : <DataTable columns={columns} rows={list.data} loading={list.isLoading} rowKey={(g) => g.id} emptyTitle="Chưa có quyền cấp lẻ" />}
      {adding && <GrantModal userId={userId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['rbac-grants', userId] }); }} />}
    </>
  );
}

function GrantModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ functionCode: '', scope: 'UNIT', expiresAt: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const fns = useQuery({ queryKey: ['rbac-functions-all'], queryFn: async () => (await api.get('/rbac/functions/all')).data as AppFunction[] });
  const save = useMutation({ mutationFn: async () => api.post('/rbac/permission-grants', { userId, functionCode: f.functionCode, scope: f.scope, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : undefined, reason: f.reason || undefined }), onSuccess: () => { toast.success('Đã cấp quyền lẻ.'); onDone(); }, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Cấp quyền lẻ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Chức năng</label>
          <select className="input" value={f.functionCode} onChange={(e) => setF((s) => ({ ...s, functionCode: e.target.value }))}>
            <option value="">— Chọn chức năng —</option>
            {(fns.data ?? []).map((fn) => <option key={fn.id} value={fn.code}>{fn.module} · {fn.name} ({fn.code})</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Phạm vi</label><select className="input" value={f.scope} onChange={(e) => setF((s) => ({ ...s, scope: e.target.value }))}>{SCOPES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Hết hạn (tùy chọn)</label><input className="input" type="date" value={f.expiresAt} onChange={(e) => setF((s) => ({ ...s, expiresAt: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Lý do (tùy chọn)</label><input className="input" value={f.reason} onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.functionCode || save.isPending} onClick={() => save.mutate()}>Cấp quyền</button></div>
      </div>
    </Modal>
  );
}

// ============ TAB 4: Xung đột (SoD) ============
function ConflictsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['rbac-conflicts'], queryFn: async () => (await api.get('/rbac/permission-conflicts', { params: { size: 200 } })).data as { data: ConflictRow[] } });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/rbac/permission-conflicts/${id}`), onSuccess: () => { toast.success('Đã xóa khai báo xung đột.'); qc.invalidateQueries({ queryKey: ['rbac-conflicts'] }); }, onError: (e) => toast.problem(e, 'Không xóa được') });

  const columns: Column<ConflictRow>[] = [
    { key: 'a', header: 'Chức năng A', render: (c) => <span className="num">{c.functionCodeA}</span> },
    { key: 'b', header: 'Chức năng B', render: (c) => <span className="num">{c.functionCodeB}</span> },
    { key: 'sev', header: 'Mức', render: (c) => c.severity === 'BLOCK' ? <span style={{ fontSize: 11, background: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '1px 7px', borderRadius: 5 }}>Chặn</span> : <span style={{ fontSize: 11, background: 'var(--role-hckt-bg)', color: 'var(--role-hckt)', padding: '1px 7px', borderRadius: 5 }}>Cảnh báo</span> },
    { key: 'desc', header: 'Mô tả', render: (c) => <span className="muted" style={{ fontSize: 12 }}>{c.description ?? '—'}</span> },
    { key: 'act', header: '', align: 'right', render: (c) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm('Xóa khai báo xung đột này?')) remove.mutate(c.id); }}>Xóa</button> },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} /> Cặp chức năng "Chặn" không được gán đồng thời cho một chức vụ (tách biệt trách nhiệm).</span>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Khai báo xung đột</button>
      </div>
      {list.isError ? <ErrorState error={list.error} /> : <DataTable columns={columns} rows={list.data?.data} loading={list.isLoading} rowKey={(c) => c.id} emptyTitle="Chưa có khai báo SoD" />}
      {creating && <ConflictModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['rbac-conflicts'] }); }} />}
    </>
  );
}

function ConflictModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ functionCodeA: '', functionCodeB: '', severity: 'BLOCK', description: '' });
  const [error, setError] = useState<string | null>(null);
  const fns = useQuery({ queryKey: ['rbac-functions-all'], queryFn: async () => (await api.get('/rbac/functions/all')).data as AppFunction[] });
  const save = useMutation({ mutationFn: async () => api.post('/rbac/permission-conflicts', { functionCodeA: f.functionCodeA, functionCodeB: f.functionCodeB, severity: f.severity, description: f.description || undefined }), onSuccess: () => { toast.success('Đã khai báo xung đột.'); onDone(); }, onError: (e) => setError(toProblem(e).title) });
  const options = fns.data ?? [];
  return (
    <Modal open title="Khai báo xung đột (SoD)" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Chức năng A</label><select className="input" value={f.functionCodeA} onChange={(e) => setF((s) => ({ ...s, functionCodeA: e.target.value }))}><option value="">— Chọn —</option>{options.map((fn) => <option key={fn.id} value={fn.code}>{fn.module} · {fn.name} ({fn.code})</option>)}</select></div>
        <div><label className="field-label">Chức năng B</label><select className="input" value={f.functionCodeB} onChange={(e) => setF((s) => ({ ...s, functionCodeB: e.target.value }))}><option value="">— Chọn —</option>{options.map((fn) => <option key={fn.id} value={fn.code}>{fn.module} · {fn.name} ({fn.code})</option>)}</select></div>
        <div><label className="field-label">Mức</label><select className="input" value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}><option value="BLOCK">Chặn (không cho gán đồng thời)</option><option value="WARN">Cảnh báo</option></select></div>
        <div><label className="field-label">Mô tả (tùy chọn)</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.functionCodeA || !f.functionCodeB || f.functionCodeA === f.functionCodeB || save.isPending} onClick={() => save.mutate()}>Khai báo</button></div>
      </div>
    </Modal>
  );
}
