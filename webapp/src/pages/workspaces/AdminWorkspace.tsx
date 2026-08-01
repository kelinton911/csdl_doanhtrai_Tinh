import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { DataTable, type Column } from '../../components/DataTable';
import { Skeleton, ErrorState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE, ROLE_LABEL, ROLE_ICON, ROLE_ACCENT, HUMAN_ROLES } from '../../lib/roles';
import { num, dateTime } from '../../lib/format';

interface User { id: string; username: string; fullName: string; roles: string[]; status: string }
interface Summary {
  barracks: { total: number };
  facilities: { total: number };
  materials: { total: number };
}
interface Audit { id: string; action: string; actorName: string | null; statusCode: number | null; createdAt: string }

// Workspace QUẢN TRỊ HỆ THỐNG — trung tâm vận hành: người dùng theo vai trò, cảnh báo,
// khối lượng dữ liệu, nhật ký truy nguyên. Kèm công cụ "kiểm thử giao diện theo vai trò".
export function AdminWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const { setViewAsRole } = useAuth();

  const users = useQuery({ queryKey: ['users', 'admin-ws'], queryFn: async () => (await api.get('/users', { params: { size: 200 } })).data as { data: User[] } });
  const alerts = useQuery({ queryKey: ['alert-summary'], queryFn: async () => (await api.get('/alerts/summary')).data as { open: number } });
  const sum = useQuery({ queryKey: ['dashboard-summary', 'admin'], queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: 'NORMAL' } })).data });
  const audit = useQuery({ queryKey: ['audit', 'admin-ws'], queryFn: async () => (await api.get('/audit-logs', { params: { page: 1, size: 6 } })).data as { data: Audit[] } });

  const all = users.data?.data ?? [];
  const locked = all.filter((u) => u.status !== 'ACTIVE').length;
  const byRole = HUMAN_ROLES.concat('SYS_ADMIN').map((r) => ({ role: r, count: all.filter((u) => u.roles.includes(r)).length }));
  const dataManaged = (sum.data?.barracks.total ?? 0) + (sum.data?.facilities.total ?? 0) + (sum.data?.materials.total ?? 0);

  const auditCols: Column<Audit>[] = [
    { key: 'time', header: 'Thời điểm', render: (a) => dateTime(a.createdAt), mono: true, width: 160 },
    { key: 'actor', header: 'Người thực hiện', render: (a) => a.actorName ?? '—' },
    { key: 'action', header: 'Hành động', render: (a) => <span className="num" style={{ fontSize: 12 }}>{a.action}</span> },
    { key: 'status', header: 'Mã', align: 'right', render: (a) => <span className="num" style={{ color: (a.statusCode ?? 0) < 400 ? 'var(--ok-fg)' : 'var(--danger-fg)', fontWeight: 600 }}>{a.statusCode ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Quản trị hệ thống · Vận hành"
        title={`Bảng điều khiển quản trị${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.SYS_ADMIN}
      />
      <QuickActions actions={quickActionsFor('admin')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        <KpiCard label="Tài khoản người dùng" value={users.isLoading ? '…' : num(all.length)} unit="tài khoản" icon="user" dom="admin" onClick={() => nav('/admin')} />
        <KpiCard label="Tài khoản bị khóa" value={users.isLoading ? '…' : num(locked)} icon="lock" dom="repair" hint={locked ? 'Cần xử lý' : 'Không có'} onClick={() => nav('/admin')} />
        <KpiCard label="Cảnh báo đang mở" value={alerts.isLoading ? '…' : num(alerts.data?.open ?? 0)} icon="bell" dom="audit" onClick={() => nav('/alerts')} />
        <KpiCard label="Bản ghi dữ liệu quản lý" value={sum.isLoading ? '…' : num(dataManaged)} unit="bản ghi" icon="grid" dom="stock" hint="DT · công trình · vật chất" />
      </div>

      {/* Công cụ kiểm thử: nhảy vào giao diện của từng vai trò (quyền vẫn là quản trị). */}
      <div className="card" style={{ padding: 18, marginTop: 22, borderLeft: '4px solid var(--role-accent)' }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Kiểm thử giao diện theo vai trò</div>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
          Bấm để xem hệ thống dưới góc nhìn một vai trò (điều hướng, workspace và màu sắc đổi theo). Mọi thao tác vẫn dùng quyền quản trị nên bạn test được đầy đủ. Thoát bằng nút «Thoát xem như» ở đầu trang.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {HUMAN_ROLES.map((r) => {
            const color = `var(--dom-${ROLE_ACCENT[r]})`;
            return (
              <button
                key={r}
                onClick={() => { setViewAsRole(r); nav('/dashboard'); }}
                className="rowh"
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--color-neutral-200)', borderRadius: 8, borderLeft: `4px solid ${color}` }}
              >
                <span style={{ color }}><Icon name={ROLE_ICON[r]} size={18} /></span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{ROLE_LABEL[r]}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-400)' }}><Icon name="chevron" size={15} /></span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 22 }}>
        {/* Người dùng theo vai trò */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Người dùng theo vai trò</div>
            <button className="btn btn-sm" onClick={() => nav('/admin')}><Icon name="shield" size={14} /> Quản lý</button>
          </div>
          {users.isLoading ? <Skeleton rows={4} /> : users.isError ? <ErrorState error={users.error} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byRole.map((r) => (
                <div key={r.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: 'var(--color-neutral-100)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: `var(--dom-${ROLE_ACCENT[r.role]})` }}><Icon name={ROLE_ICON[r.role]} size={15} /></span>
                    {ROLE_LABEL[r.role] ?? r.role}
                  </span>
                  <b className="num">{r.count}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nhật ký truy nguyên gần đây */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Nhật ký truy nguyên gần đây</div>
            <button className="btn btn-sm" onClick={() => nav('/admin')}><Icon name="lock" size={14} /> Xem đầy đủ</button>
          </div>
          {audit.isError ? <ErrorState error={audit.error} /> : (
            <DataTable columns={auditCols} rows={audit.data?.data} loading={audit.isLoading} rowKey={(a) => a.id} emptyTitle="Chưa có nhật ký" />
          )}
        </div>
      </div>
    </>
  );
}
