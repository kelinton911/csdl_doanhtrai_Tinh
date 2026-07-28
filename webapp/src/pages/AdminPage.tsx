import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { ROLE_LABEL } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState } from '../components/States';
import { dateTime } from '../lib/format';

const CATALOG_TYPES = [
  { key: 'unit-of-measure', label: 'Đơn vị tính' },
  { key: 'material-category', label: 'Nhóm vật chất' },
  { key: 'facility-type', label: 'Loại công trình' },
  { key: 'quality-grade', label: 'Cấp chất lượng' },
  { key: 'damage-cause', label: 'Nguyên nhân hư hỏng' },
  { key: 'storage-location-type', label: 'Loại kho' },
];
const ROLES = Object.keys(ROLE_LABEL);

export function AdminPage() {
  const [tab, setTab] = useState<'catalog' | 'users' | 'audit'>('catalog');
  return (
    <>
      <PageHeader eyebrow="Quản trị hệ thống" title="Quản trị danh mục & phân quyền" description="Quản lý danh mục chuẩn, tài khoản, phân quyền RBAC và nhật ký truy nguyên (append-only)." />
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        <Tab active={tab === 'catalog'} onClick={() => setTab('catalog')}>Danh mục</Tab>
        <Tab active={tab === 'users'} onClick={() => setTab('users')}>Người dùng & phân quyền</Tab>
        <Tab active={tab === 'audit'} onClick={() => setTab('audit')}>Nhật ký truy nguyên</Tab>
      </div>
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ all: 'unset', cursor: 'pointer', padding: '10px 16px', fontWeight: active ? 700 : 500, color: active ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: active ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{children}</button>;
}

interface Catalog { id: string; code: string; name: string; description: string | null; status: string; version: number }

function CatalogTab() {
  const qc = useQueryClient();
  const [type, setType] = useState('unit-of-measure');
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['catalog-admin', type], queryFn: async () => (await api.get(`/master-data/${type}`, { params: { size: 200 } })).data as { data: Catalog[] } });
  const publish = useMutation({ mutationFn: async (id: string) => api.post(`/master-data/${type}/${id}/publish`), onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-admin', type] }) });

  const columns: Column<Catalog>[] = [
    { key: 'code', header: 'Mã', render: (c) => c.code, mono: true, width: 140 },
    { key: 'name', header: 'Tên', render: (c) => <span style={{ fontWeight: 600 }}>{c.name}</span> },
    { key: 'ver', header: 'Phiên bản', render: (c) => `v${c.version}`, mono: true, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (c) => <StatusBadge status={c.status === 'PUBLISHED' ? 'PUBLISHED' : c.status === 'DRAFT' ? 'DRAFT' : 'ARCHIVED'} /> },
    { key: 'act', header: '', align: 'right', render: (c) => c.status !== 'PUBLISHED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); publish.mutate(c.id); }}><Icon name="check" size={14} /> Phát hành</button> },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 260 }} value={type} onChange={(e) => setType(e.target.value)}>
          {CATALOG_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Thêm mục</button>
      </div>
      {list.isError ? <ErrorState error={list.error} /> : <DataTable columns={columns} rows={list.data?.data} loading={list.isLoading} rowKey={(c) => c.id} emptyTitle="Chưa có mục danh mục" />}
      {creating && <CreateCatalogModal type={type} onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['catalog-admin', type] }); }} />}
    </>
  );
}

function CreateCatalogModal({ type, onClose, onDone }: { type: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: async () => api.post(`/master-data/${type}`, { code: f.code, name: f.name, description: f.description || undefined }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Thêm mục danh mục" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Mã</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
        <div><label className="field-label">Tên</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.code || !f.name || create.isPending} onClick={() => create.mutate()}>Tạo (nháp)</button></div>
      </div>
    </Modal>
  );
}

interface User { id: string; username: string; fullName: string; roles: string[]; status: string }

function UsersTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users', { params: { size: 100 } })).data as { data: User[] } });
  const columns: Column<User>[] = [
    { key: 'username', header: 'Tài khoản', render: (u) => <span className="num" style={{ fontWeight: 600 }}>{u.username}</span> },
    { key: 'name', header: 'Họ tên', render: (u) => u.fullName },
    { key: 'roles', header: 'Vai trò', render: (u) => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{u.roles.map((r) => <span key={r} style={{ fontSize: 11, background: 'var(--role-hckt-bg)', color: 'var(--role-hckt)', padding: '1px 7px', borderRadius: 5 }}>{ROLE_LABEL[r] ?? r}</span>)}</div> },
    { key: 'status', header: 'Trạng thái', render: (u) => <StatusBadge status={u.status === 'ACTIVE' ? 'ACTIVE' : 'LOCKED'} /> },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}><button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo tài khoản</button></div>
      {users.isError ? <ErrorState error={users.error} /> : <DataTable columns={columns} rows={users.data?.data} loading={users.isLoading} rowKey={(u) => u.id} emptyTitle="Chưa có người dùng" />}
      {creating && <CreateUserModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['users'] }); }} />}
    </>
  );
}

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ username: '', password: '', fullName: '', roles: ['COMMUNE_USER'] as string[] });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: async () => api.post('/users', f), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  const toggleRole = (r: string) => setF((s) => ({ ...s, roles: s.roles.includes(r) ? s.roles.filter((x) => x !== r) : [...s.roles, r] }));
  return (
    <Modal open title="Tạo tài khoản" onClose={onClose} width={520}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Tài khoản</label><input className="input" value={f.username} onChange={(e) => setF((s) => ({ ...s, username: e.target.value }))} /></div>
          <div style={{ flex: 1 }}><label className="field-label">Mật khẩu</label><input className="input" type="password" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Họ tên</label><input className="input" value={f.fullName} onChange={(e) => setF((s) => ({ ...s, fullName: e.target.value }))} /></div>
        <div>
          <label className="field-label">Vai trò (RBAC)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {ROLES.map((r) => (
              <button key={r} type="button" onClick={() => toggleRole(r)} className="btn btn-sm" style={{ background: f.roles.includes(r) ? 'var(--color-accent-600)' : 'var(--surface-1)', color: f.roles.includes(r) ? '#fff' : 'var(--color-text)', borderColor: f.roles.includes(r) ? 'var(--color-accent-600)' : 'var(--color-neutral-400)', fontSize: 12 }}>{ROLE_LABEL[r]}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.username || f.password.length < 6 || !f.fullName || f.roles.length === 0 || create.isPending} onClick={() => create.mutate()}>Tạo tài khoản</button></div>
      </div>
    </Modal>
  );
}

interface Audit { id: string; action: string; actorName: string | null; entityType: string | null; statusCode: number | null; correlationId: string | null; createdAt: string }

function AuditTab() {
  const audit = useQuery({ queryKey: ['audit'], queryFn: async () => (await api.get('/audit-logs', { params: { size: 100 } })).data as { data: Audit[] } });
  if (audit.isLoading) return <Skeleton rows={8} />;
  if (audit.isError) return <ErrorState error={audit.error} />;
  const columns: Column<Audit>[] = [
    { key: 'time', header: 'Thời điểm', render: (a) => dateTime(a.createdAt), mono: true },
    { key: 'actor', header: 'Người thực hiện', render: (a) => a.actorName ?? '—' },
    { key: 'action', header: 'Hành động', render: (a) => <span className="num" style={{ fontSize: 12 }}>{a.action}</span> },
    { key: 'status', header: 'Mã', render: (a) => <span style={{ color: (a.statusCode ?? 0) < 400 ? 'var(--ok-fg)' : 'var(--danger-fg)', fontWeight: 600 }} className="num">{a.statusCode ?? '—'}</span>, align: 'right' },
    { key: 'corr', header: 'Correlation', render: (a) => <span className="num muted" style={{ fontSize: 11 }}>{a.correlationId ? a.correlationId.slice(0, 8) : '—'}</span> },
  ];
  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} /> Nhật ký append-only — không sửa/xóa qua ứng dụng. Mọi thao tác ghi dữ liệu đều được truy vết.</p>
      <DataTable columns={columns} rows={audit.data?.data} rowKey={(a) => a.id} emptyTitle="Chưa có nhật ký" />
    </>
  );
}
