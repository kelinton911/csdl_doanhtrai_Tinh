import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { AlertCloseModal } from './AlertCloseModal';
import { MfaEnrollModal } from './MfaEnrollModal';
import { OfflineIndicator } from './OfflineIndicator';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { visibleNav, groupedNav } from '../lib/nav';
import { ROLE_LABEL, useAuth } from '../lib/auth';
import { scopeLabel } from '../lib/scope';
import { useTheme } from '../lib/theme';
import { dateTime } from '../lib/format';

interface SearchResult {
  barracks: Array<{ id: string; code: string; name: string }>;
  facilities: Array<{ id: string; code: string; name: string; barracks_id: string }>;
  materials: Array<{ id: string; code: string; name: string }>;
}
interface AlertLite {
  id: string;
  severity: string;
  title: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'var(--danger-fg)',
  HIGH: 'var(--danger-fg)',
  MEDIUM: 'var(--warn-fg)',
  LOW: 'var(--info-fg)',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, logout, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [closing, setClosing] = useState<{ id: string; title: string } | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const nav = visibleNav(profile?.roles ?? []);
  const navGroups = groupedNav(profile?.roles ?? []);
  const primaryRole = profile?.roles?.[0] ?? '';
  const canAct = hasRole('BARRACKS_OFFICER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND');

  const alertCount = useQuery({
    queryKey: ['alert-summary'],
    queryFn: async () => (await api.get('/alerts/summary')).data as { open: number },
    refetchInterval: 60_000,
  });
  const recentAlerts = useQuery({
    queryKey: ['alerts', 'OPEN', 'notif'],
    queryFn: async () => (await api.get('/alerts', { params: { status: 'OPEN', size: 6 } })).data as { data: AlertLite[] },
    enabled: notifOpen,
  });
  const assign = useMutation({
    mutationFn: async (id: string) => api.post(`/alerts/${id}/assign`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
      toast.success('Đã nhận xử lý cảnh báo.');
    },
    onError: (e) => toast.problem(e, 'Không nhận được cảnh báo'),
  });

  const searchResults = useQuery({
    queryKey: ['global-search', search],
    queryFn: async () => (await api.get<SearchResult>('/search', { params: { q: search } })).data,
    enabled: search.trim().length >= 2,
  });
  const totalResults =
    (searchResults.data?.barracks.length ?? 0) +
    (searchResults.data?.facilities.length ?? 0) +
    (searchResults.data?.materials.length ?? 0);

  const current = nav.find((n) => location.pathname.startsWith(n.to));

  return (
    <div
      className={`app-shell${mobileOpen ? ' nav-open' : ''}`}
      style={{ ['--sidebar-w' as string]: collapsed ? '72px' : '248px' }}
    >
      <a href="#main-content" className="skip-link">Bỏ qua tới nội dung</a>
      <div className="app-backdrop" onClick={() => setMobileOpen(false)} />
      {/* Sidebar */}
      <aside
        className="app-sidebar"
        style={{
          background: 'var(--nav-bg)',
          color: 'var(--nav-fg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: collapsed ? '18px 0' : '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid var(--nav-rule)',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--teal)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              flexShrink: 0,
            }}
          >
            DT
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.02em' }}>CSDL DOANH TRẠI</div>
              <div style={{ fontSize: 10.5, color: 'var(--nav-muted)', letterSpacing: '0.14em' }}>
                CẤP TỈNH
              </div>
            </div>
          )}
        </div>

        <nav className="scrl" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          {navGroups.map((grp, gi) => (
            <div key={grp.group} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!collapsed ? (
                <div
                  className="eyebrow"
                  style={{
                    padding: gi === 0 ? '4px 12px 4px' : '14px 12px 4px',
                    color: 'var(--nav-muted)',
                    fontSize: 10.5,
                    letterSpacing: '0.12em',
                  }}
                >
                  {grp.label}
                </div>
              ) : (
                gi > 0 && <div style={{ height: 1, background: 'var(--nav-rule)', margin: '8px 8px' }} />
              )}
              {grp.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="navitem"
                  onClick={() => setMobileOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: collapsed ? '10px 0' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 8,
                    color: isActive ? 'var(--nav-fg)' : 'var(--nav-fg-dim)',
                    background: isActive ? 'var(--nav-active)' : 'transparent',
                    borderLeft: isActive ? `3px solid var(--dom-${item.dom})` : '3px solid transparent',
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                  })}
                  title={item.label}
                >
                  <span style={{ color: `var(--dom-${item.dom})`, display: 'inline-flex' }}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="navitem hide-sm"
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: 14,
            textAlign: 'center',
            color: 'var(--nav-muted)',
            borderTop: '1px solid var(--nav-rule)',
            fontSize: 12,
          }}
        >
          {collapsed ? '»' : '« Thu gọn'}
        </button>
      </aside>

      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header
          className="app-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 20px',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--color-neutral-300)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            className="btn btn-ghost btn-sm only-mobile"
            aria-label="Mở menu điều hướng"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="grid" size={18} />
          </button>

          <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name={current?.icon ?? 'grid'} size={15} />
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{current?.label ?? 'Hệ thống'}</span>
          </div>

          <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--color-neutral-500)' }}>
              <Icon name="search" size={16} />
            </span>
            <input
              className="input"
              placeholder="Tìm doanh trại, công trình, vật chất…"
              aria-label="Tìm kiếm toàn hệ thống"
              style={{ paddingLeft: 32 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim().length >= 2 && (
              <div
                className="scrl"
                style={{ position: 'absolute', top: 42, left: 0, right: 0, background: 'var(--surface-1)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 360, overflow: 'auto', zIndex: 20 }}
              >
                {totalResults === 0 ? (
                  <div className="muted" style={{ padding: 14, fontSize: 13 }}>Không tìm thấy kết quả.</div>
                ) : (
                  <>
                    <SearchGroup title="Doanh trại" items={searchResults.data?.barracks} onPick={(id) => { setSearch(''); navigate(`/barracks/${id}`); }} />
                    <SearchGroup title="Công trình" items={(searchResults.data?.facilities ?? []).map((f) => ({ id: f.barracks_id, code: f.code, name: f.name }))} onPick={(id) => { setSearch(''); navigate(`/barracks/${id}`); }} />
                    <SearchGroup title="Vật chất" items={searchResults.data?.materials} onPick={() => { setSearch(''); navigate('/inventory'); }} />
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Bộ chọn Trạng thái Vận hành Toàn cục (3 Trạng thái: Thời bình / SSCĐ / Mô phỏng) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-neutral-100)', padding: '3px 6px', borderRadius: 8, border: '1px solid var(--color-neutral-300)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)', textTransform: 'uppercase' }}>Bối cảnh:</span>
            <select
              className="input"
              style={{ padding: '2px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', height: 28 }}
              value={window.localStorage.getItem('CSDL_OP_MODE') || 'NORMAL'}
              onChange={(e) => {
                window.localStorage.setItem('CSDL_OP_MODE', e.target.value);
                window.location.reload();
              }}
            >
              <option value="NORMAL">🟢 Thời bình (Peacetime)</option>
              <option value="SSCD">🟠 Sẵn sàng chiến đấu (SSCĐ)</option>
              <option value="SCENARIO">🔵 Mô phỏng Giả định (Scenario)</option>
            </select>
          </div>

          {/* Phạm vi dữ liệu THẬT của tài khoản (read-only). Việc lọc thực thi ở tầng server. */}
          <span
            className="hide-sm"
            title="Phạm vi dữ liệu được gán cho tài khoản (thực thi ở máy chủ)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--color-neutral-700)',
              background: 'var(--surface-1)',
              border: '1px solid var(--color-neutral-300)',
              padding: '4px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="shield" size={13} /> Phạm vi: {scopeLabel(profile)}
          </span>

          {/* Trạng thái kết nối + hàng đợi đồng bộ ngoại tuyến (M26) */}
          <OfflineIndicator />

          {/* Trung tâm cảnh báo */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-sm"
              title="Trung tâm cảnh báo"
              aria-label="Trung tâm cảnh báo"
              aria-haspopup="true"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((o) => !o)}
              style={{ position: 'relative' }}
            >
              <Icon name="bell" size={18} />
              {(alertCount.data?.open ?? 0) > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                  {alertCount.data!.open > 99 ? '99+' : alertCount.data!.open}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setNotifOpen(false)} />
                <div
                  className="card scrl"
                  role="menu"
                  style={{ position: 'absolute', top: 40, right: 0, width: 340, maxWidth: '92vw', maxHeight: 420, overflow: 'auto', zIndex: 30, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--color-neutral-200)' }}>
                    <strong style={{ fontSize: 13 }}>Cảnh báo cần xử lý ({alertCount.data?.open ?? 0})</strong>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setNotifOpen(false); navigate('/alerts'); }}>Xem tất cả</button>
                  </div>
                  {recentAlerts.isLoading ? (
                    <div className="muted" style={{ padding: 16, fontSize: 13 }}>Đang tải…</div>
                  ) : (recentAlerts.data?.data ?? []).length === 0 ? (
                    <div className="muted" style={{ padding: 16, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={16} /> Không có cảnh báo đang mở.</div>
                  ) : (
                    (recentAlerts.data?.data ?? []).map((a) => (
                      <div key={a.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-neutral-200)', borderLeft: `3px solid ${SEV_COLOR[a.severity] ?? 'var(--info-fg)'}` }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                        <div className="muted num" style={{ fontSize: 11, marginTop: 2 }}>
                          {dateTime(a.createdAt)}{a.dueAt ? ` · Hạn: ${dateTime(a.dueAt)}` : ''}
                        </div>
                        {canAct && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            {a.status === 'OPEN' && (
                              <button className="btn btn-sm" disabled={assign.isPending} onClick={() => assign.mutate(a.id)}>
                                <Icon name="user" size={13} /> Nhận
                              </button>
                            )}
                            <button className="btn btn-sm btn-primary" onClick={() => { setNotifOpen(false); setClosing({ id: a.id, title: a.title }); }}>
                              <Icon name="check" size={13} /> Đóng
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => setMfaOpen(true)} title="Bảo mật OTP" aria-label="Bảo mật OTP">
            <Icon name="shield" size={18} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggle} title="Đổi giao diện sáng/tối" aria-label="Đổi giao diện sáng/tối">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>

          <div className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid var(--color-neutral-300)' }}>
            <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{profile?.fullName}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                {ROLE_LABEL[primaryRole] ?? primaryRole}
              </div>
            </div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--role-hckt-bg)',
                color: 'var(--role-hckt)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="user" size={18} />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Đăng xuất" aria-label="Đăng xuất">
            <Icon name="logout" size={18} />
          </button>
        </header>

        <main id="main-content" className="scrl app-main" style={{ padding: 24, flex: 1, overflow: 'auto', maxWidth: 1600, width: '100%', margin: '0 auto', position: 'relative' }}>
          {(window.localStorage.getItem('CSDL_OP_MODE') || 'NORMAL') === 'SSCD' && (
            <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <Icon name="target" size={18} /> 🚨 BỐI CẢNH SẴN SÀNG CHIẾN ĐẤU (SSCĐ) — ĐÁNH GIÁ ĐỘ ĐÁP ỨNG VÀ CHÊNH LỆCH ĐỊNH MỨC SSCĐ TOÀN TỈNH
            </div>
          )}
          {(window.localStorage.getItem('CSDL_OP_MODE') || 'NORMAL') === 'SCENARIO' && (
            <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#eff6ff', border: '1px dashed #60a5fa', color: '#1d4ed8', fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <Icon name="alert" size={18} /> ⚠️ CHẾ ĐỘ MÔ PHỎNG GIẢ ĐỊNH (SCENARIO) — SỐ LIỆU MÔ PHỎNG CÁCH LY, KHÔNG GHI ĐÈ CSDL THỜI BÌNH
            </div>
          )}
          {children}
        </main>
      </div>

      <AlertCloseModal alert={closing} onClose={() => setClosing(null)} />
      {mfaOpen && <MfaEnrollModal onClose={() => setMfaOpen(false)} />}
    </div>
  );
}

function SearchGroup({
  title,
  items,
  onPick,
}: {
  title: string;
  items?: Array<{ id: string; code: string; name: string }>;
  onPick: (id: string) => void;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="eyebrow" style={{ padding: '8px 12px 4px' }}>{title}</div>
      {items.map((it) => (
        <button
          key={`${title}-${it.id}-${it.code}`}
          onClick={() => onPick(it.id)}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
          className="rowh"
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</span>
          <span className="num muted" style={{ fontSize: 11 }}>{it.code}</span>
        </button>
      ))}
    </div>
  );
}
