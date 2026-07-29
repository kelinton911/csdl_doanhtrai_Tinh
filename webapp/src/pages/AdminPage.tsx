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
  const [tab, setTab] = useState<'catalog' | 'orgarea' | 'users' | 'audit'>('catalog');
  return (
    <>
      <PageHeader eyebrow="Quản trị hệ thống" title="Quản trị danh mục & phân quyền" description="Quản lý danh mục chuẩn, đơn vị/địa bàn, tài khoản, phân quyền RBAC và nhật ký truy nguyên (append-only)." />
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        <Tab active={tab === 'catalog'} onClick={() => setTab('catalog')}>Danh mục</Tab>
        <Tab active={tab === 'orgarea'} onClick={() => setTab('orgarea')}>Đơn vị & địa bàn</Tab>
        <Tab active={tab === 'users'} onClick={() => setTab('users')}>Người dùng & phân quyền</Tab>
        <Tab active={tab === 'audit'} onClick={() => setTab('audit')}>Nhật ký truy nguyên</Tab>
      </div>
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'orgarea' && <OrgAreaTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}

interface OrgRow { id: string; code: string; name: string; type: string | null; status: string }
interface AreaRow { id: string; code: string; name: string; type: string | null }
const ORG_TYPE_LABEL: Record<string, string> = { PROVINCE: 'Cấp tỉnh', COMMUNE: 'Cấp xã', UNIT: 'Đơn vị' };

// E1 — Quản trị đơn vị quản lý và địa bàn hành chính (xã/phường). UC-04.
function OrgAreaTab() {
  const qc = useQueryClient();
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrgRow | null>(null);
  const [creatingArea, setCreatingArea] = useState(false);
  const orgs = useQuery({ queryKey: ['orgs-admin'], queryFn: async () => (await api.get('/organizations', { params: { size: 300 } })).data as { data: OrgRow[] } });
  const areas = useQuery({ queryKey: ['areas-admin'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 500 } })).data as { data: AreaRow[] } });

  const orgCols: Column<OrgRow>[] = [
    { key: 'code', header: 'Mã', render: (o) => o.code, mono: true, width: 120 },
    { key: 'name', header: 'Tên đơn vị', render: (o) => <span style={{ fontWeight: 600 }}>{o.name}</span> },
    { key: 'type', header: 'Cấp', render: (o) => ORG_TYPE_LABEL[o.type ?? ''] ?? o.type ?? '—' },
    { key: 'status', header: 'Trạng thái', render: (o) => <StatusBadge status={o.status === 'ACTIVE' ? 'ACTIVE' : 'LOCKED'} /> },
    { key: 'act', header: '', align: 'right', render: (o) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditingOrg(o); }}><Icon name="edit" size={14} /> Sửa</button> },
  ];
  const areaCols: Column<AreaRow>[] = [
    { key: 'code', header: 'Mã', render: (a) => a.code, mono: true, width: 120 },
    { key: 'name', header: 'Xã/phường', render: (a) => <span style={{ fontWeight: 600 }}>{a.name}</span> },
    { key: 'type', header: 'Loại', render: (a) => a.type === 'WARD' ? 'Phường' : 'Xã' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="eyebrow">Đơn vị quản lý</div>
          <button className="btn btn-sm btn-primary" onClick={() => setCreatingOrg(true)}><Icon name="plus" size={14} /> Thêm đơn vị</button>
        </div>
        {orgs.isError ? <ErrorState error={orgs.error} /> : <DataTable columns={orgCols} rows={orgs.data?.data} loading={orgs.isLoading} rowKey={(o) => o.id} emptyTitle="Chưa có đơn vị" />}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="eyebrow">Địa bàn hành chính</div>
          <button className="btn btn-sm btn-primary" onClick={() => setCreatingArea(true)}><Icon name="plus" size={14} /> Thêm xã/phường</button>
        </div>
        {areas.isError ? <ErrorState error={areas.error} /> : <DataTable columns={areaCols} rows={areas.data?.data} loading={areas.isLoading} rowKey={(a) => a.id} emptyTitle="Chưa có xã/phường" />}
      </div>
      {creatingOrg && <OrgModal onClose={() => setCreatingOrg(false)} onDone={() => { setCreatingOrg(false); qc.invalidateQueries({ queryKey: ['orgs-admin'] }); }} />}
      {editingOrg && <OrgModal org={editingOrg} onClose={() => setEditingOrg(null)} onDone={() => { setEditingOrg(null); qc.invalidateQueries({ queryKey: ['orgs-admin'] }); }} />}
      {creatingArea && <AreaModal onClose={() => setCreatingArea(false)} onDone={() => { setCreatingArea(false); qc.invalidateQueries({ queryKey: ['areas-admin'] }); }} />}
    </div>
  );
}

function OrgModal({ org, onClose, onDone }: { org?: OrgRow; onClose: () => void; onDone: () => void }) {
  const editing = !!org;
  const [f, setF] = useState({ code: org?.code ?? '', name: org?.name ?? '', type: org?.type ?? 'UNIT', status: org?.status ?? 'ACTIVE' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => editing
      ? api.put(`/organizations/${org!.id}`, { name: f.name, type: f.type, status: f.status })
      : api.post('/organizations', { code: f.code, name: f.name, type: f.type }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title={editing ? `Sửa đơn vị · ${org!.code}` : 'Thêm đơn vị'} onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!editing && <div><label className="field-label">Mã</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>}
        <div><label className="field-label">Tên đơn vị</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Cấp</label><select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}><option value="PROVINCE">Cấp tỉnh</option><option value="COMMUNE">Cấp xã</option><option value="UNIT">Đơn vị</option></select></div>
          {editing && <div style={{ flex: 1 }}><label className="field-label">Trạng thái</label><select className="input" value={f.status} onChange={(e) => setF((s) => ({ ...s, status: e.target.value }))}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng</option></select></div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={(!editing && !f.code) || !f.name || save.isPending} onClick={() => save.mutate()}>{editing ? 'Lưu' : 'Tạo đơn vị'}</button></div>
      </div>
    </Modal>
  );
}

function AreaModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name: '', type: 'COMMUNE' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: async () => api.post('/administrative-areas', { code: f.code, name: f.name, type: f.type }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Thêm xã/phường" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Mã</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
        <div><label className="field-label">Tên</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div><label className="field-label">Loại</label><select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}><option value="COMMUNE">Xã</option><option value="WARD">Phường</option></select></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.code || !f.name || save.isPending} onClick={() => save.mutate()}>Tạo</button></div>
      </div>
    </Modal>
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
  const [editing, setEditing] = useState<Catalog | null>(null);
  const list = useQuery({ queryKey: ['catalog-admin', type], queryFn: async () => (await api.get(`/master-data/${type}`, { params: { size: 200 } })).data as { data: Catalog[] } });
  const publish = useMutation({ mutationFn: async (id: string) => api.post(`/master-data/${type}/${id}/publish`), onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-admin', type] }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['catalog-admin', type] });

  const columns: Column<Catalog>[] = [
    { key: 'code', header: 'Mã', render: (c) => c.code, mono: true, width: 140 },
    { key: 'name', header: 'Tên', render: (c) => <span style={{ fontWeight: 600 }}>{c.name}</span> },
    { key: 'ver', header: 'Phiên bản', render: (c) => `v${c.version}`, mono: true, align: 'right' },
    { key: 'status', header: 'Trạng thái', render: (c) => <StatusBadge status={c.status === 'PUBLISHED' ? 'PUBLISHED' : c.status === 'DRAFT' ? 'DRAFT' : 'ARCHIVED'} /> },
    { key: 'act', header: '', align: 'right', render: (c) => c.status !== 'PUBLISHED' && (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(c); }}><Icon name="edit" size={14} /> Sửa</button>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); publish.mutate(c.id); }}><Icon name="check" size={14} /> Phát hành</button>
      </div>
    ) },
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
      {creating && <CreateCatalogModal type={type} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {editing && <EditCatalogModal type={type} item={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} />}
    </>
  );
}

function EditCatalogModal({ type, item, onClose, onDone }: { type: string; item: Catalog; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: item.name, description: item.description ?? '' });
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({ mutationFn: async () => api.put(`/master-data/${type}/${item.id}`, { name: f.name, description: f.description || undefined }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title={`Sửa mục · ${item.code}`} onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Tên</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.name || update.isPending} onClick={() => update.mutate()}>Lưu thay đổi</button></div>
      </div>
    </Modal>
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

interface User { id: string; username: string; fullName: string; roles: string[]; status: string; organizationId: string | null; dataScopes?: Array<{ type: string; refId: string }> }

function UsersTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [manage, setManage] = useState<User | null>(null);
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/users', { params: { size: 100 } })).data as { data: User[] } });
  const columns: Column<User>[] = [
    { key: 'username', header: 'Tài khoản', render: (u) => <span className="num" style={{ fontWeight: 600 }}>{u.username}</span> },
    { key: 'name', header: 'Họ tên', render: (u) => u.fullName },
    { key: 'roles', header: 'Vai trò', render: (u) => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{u.roles.map((r) => <span key={r} style={{ fontSize: 11, background: 'var(--role-hckt-bg)', color: 'var(--role-hckt)', padding: '1px 7px', borderRadius: 5 }}>{ROLE_LABEL[r] ?? r}</span>)}</div> },
    { key: 'scopes', header: 'Phạm vi', render: (u) => <span className="muted" style={{ fontSize: 12 }}>{u.dataScopes && u.dataScopes.length > 0 ? `${u.dataScopes.length} phạm vi` : 'Toàn tỉnh'}</span> },
    { key: 'status', header: 'Trạng thái', render: (u) => <StatusBadge status={u.status === 'ACTIVE' ? 'ACTIVE' : 'LOCKED'} /> },
    { key: 'act', header: '', align: 'right', render: (u) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setManage(u); }}><Icon name="shield" size={14} /> Quản lý</button> },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}><button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo tài khoản</button></div>
      {users.isError ? <ErrorState error={users.error} /> : <DataTable columns={columns} rows={users.data?.data} loading={users.isLoading} rowKey={(u) => u.id} emptyTitle="Chưa có người dùng" />}
      {creating && <CreateUserModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['users'] }); }} />}
      {manage && <UserManageModal userId={manage.id} username={manage.username} onClose={() => setManage(null)} onDone={() => qc.invalidateQueries({ queryKey: ['users'] })} />}
    </>
  );
}

interface Area { id: string; code: string; name: string }
interface Org { id: string; code: string; name: string }

// Quản lý một tài khoản: cập nhật thông tin, gán vai trò (RBAC) và phạm vi dữ liệu (data-scope type=AREA).
function UserManageModal({ userId, username, onClose, onDone }: { userId: string; username: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['user', userId], queryFn: async () => (await api.get(`/users/${userId}`)).data as User });
  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 500 } })).data as { data: Area[] } });
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: async () => (await api.get('/organizations', { params: { size: 500 } })).data as { data: Org[] } });

  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [organizationId, setOrganizationId] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);

  // Nạp giá trị hiện tại vào form lần đầu.
  if (detail.data && !seeded) {
    setFullName(detail.data.fullName);
    setStatus(detail.data.status);
    setOrganizationId(detail.data.organizationId ?? '');
    setRoles(detail.data.roles);
    setAreaIds((detail.data.dataScopes ?? []).filter((s) => s.type === 'AREA').map((s) => s.refId));
    setSeeded(true);
  }

  const done = (m: string) => { setMsg(m); setError(null); qc.invalidateQueries({ queryKey: ['user', userId] }); onDone(); };
  const fail = (e: unknown) => { setError(toProblem(e).title); setMsg(null); };

  const saveInfo = useMutation({ mutationFn: async () => api.put(`/users/${userId}`, { fullName, status, organizationId: organizationId || undefined }), onSuccess: () => done('Đã cập nhật thông tin tài khoản.'), onError: fail });
  const saveRoles = useMutation({ mutationFn: async () => api.post(`/users/${userId}/roles`, { roles }), onSuccess: () => done('Đã gán vai trò.'), onError: fail });
  const saveScopes = useMutation({ mutationFn: async () => api.post(`/users/${userId}/scopes`, { scopes: areaIds.map((refId) => ({ type: 'AREA', refId })) }), onSuccess: () => done('Đã gán phạm vi dữ liệu.'), onError: fail });

  const toggleRole = (r: string) => setRoles((s) => s.includes(r) ? s.filter((x) => x !== r) : [...s, r]);
  const toggleArea = (id: string) => setAreaIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <Modal open title={`Quản lý tài khoản · ${username}`} onClose={onClose} width={620}>
      {detail.isLoading ? <Skeleton rows={5} /> : detail.isError ? <ErrorState error={detail.error} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {msg && <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Icon name="check" size={15} /> {msg}</div>}
          {error && <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Icon name="alert" size={15} /> {error}</div>}

          {/* Thông tin */}
          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Thông tin tài khoản</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}><label className="field-label">Họ tên</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div style={{ flex: 1 }}><label className="field-label">Trạng thái</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Khóa</option></select></div>
            </div>
            <div style={{ marginTop: 8 }}><label className="field-label">Đơn vị quản lý</label>
              <select className="input" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                <option value="">— Không gán —</option>
                {(orgs.data?.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-sm btn-primary" disabled={!fullName || saveInfo.isPending} onClick={() => saveInfo.mutate()}>Lưu thông tin</button></div>
          </section>

          {/* Vai trò */}
          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Vai trò (RBAC)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ROLES.map((r) => <button key={r} type="button" onClick={() => toggleRole(r)} className="btn btn-sm" style={{ background: roles.includes(r) ? 'var(--color-accent-600)' : 'var(--surface-1)', color: roles.includes(r) ? '#fff' : 'var(--color-text)', borderColor: roles.includes(r) ? 'var(--color-accent-600)' : 'var(--color-neutral-400)', fontSize: 12 }}>{ROLE_LABEL[r]}</button>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-sm btn-primary" disabled={roles.length === 0 || saveRoles.isPending} onClick={() => saveRoles.mutate()}>Lưu vai trò</button></div>
          </section>

          {/* Phạm vi dữ liệu */}
          <section>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Phạm vi dữ liệu (data-scope)</div>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={13} /> Không chọn = xem toàn tỉnh. Chọn xã/phường để giới hạn dữ liệu người dùng chỉ thấy được.</p>
            {areas.isLoading ? <Skeleton rows={3} /> : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 160, overflow: 'auto' }}>
                {(areas.data?.data ?? []).map((a) => <button key={a.id} type="button" onClick={() => toggleArea(a.id)} className="btn btn-sm" style={{ background: areaIds.includes(a.id) ? 'var(--color-accent-600)' : 'var(--surface-1)', color: areaIds.includes(a.id) ? '#fff' : 'var(--color-text)', borderColor: areaIds.includes(a.id) ? 'var(--color-accent-600)' : 'var(--color-neutral-400)', fontSize: 12 }}>{a.name}</button>)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
              <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>{areaIds.length} xã/phường được chọn</span>
              <button className="btn btn-sm btn-primary" disabled={saveScopes.isPending} onClick={() => saveScopes.mutate()}>Lưu phạm vi</button>
            </div>
          </section>
        </div>
      )}
    </Modal>
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
  const [detailId, setDetailId] = useState<string | null>(null);
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
      <p className="muted" style={{ fontSize: 13, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} /> Nhật ký append-only — không sửa/xóa qua ứng dụng. Bấm một dòng để xem chi tiết truy nguyên.</p>
      <DataTable columns={columns} rows={audit.data?.data} rowKey={(a) => a.id} onRowClick={(a) => setDetailId(a.id)} emptyTitle="Chưa có nhật ký" />
      {detailId && <AuditDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function AuditDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['audit', id], queryFn: async () => (await api.get(`/audit-logs/${id}`)).data as Record<string, unknown> });
  return (
    <Modal open title="Chi tiết nhật ký" onClose={onClose} width={640}>
      {q.isLoading ? <Skeleton rows={6} /> : q.isError ? <ErrorState error={q.error} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(q.data ?? {}).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: 8 }}>
              <span className="muted" style={{ fontSize: 12, minWidth: 130 }}>{k}</span>
              <span className="num" style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
