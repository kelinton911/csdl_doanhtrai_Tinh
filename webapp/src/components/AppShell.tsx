import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { visibleNav } from '../lib/nav';
import { ROLE_LABEL, useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const nav = visibleNav(profile?.roles ?? []);
  const primaryRole = profile?.roles?.[0] ?? '';

  const current = nav.find((n) => location.pathname.startsWith(n.to));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${collapsed ? 72 : 248}px 1fr`, minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          background: 'var(--nav-bg)',
          color: 'var(--nav-fg)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
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
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="navitem"
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
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="navitem"
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
              placeholder="Tìm doanh trại, công trình, vật chất, hồ sơ…"
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Chọn phạm vi dữ liệu */}
          <select className="input" style={{ width: 'auto', maxWidth: 200 }} defaultValue="all" title="Phạm vi dữ liệu">
            <option value="all">Phạm vi: Toàn tỉnh</option>
            <option value="unit">Đơn vị trực thuộc</option>
            <option value="commune">Xã/phường</option>
          </select>

          {/* Trạng thái kết nối */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--ok-fg)',
              background: 'var(--ok-bg)',
              border: '1px solid var(--ok-bd)',
              padding: '4px 8px',
              borderRadius: 6,
            }}
            title="Kết nối máy chủ nội bộ ổn định"
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok-fg)' }} />
            Trực tuyến
          </span>

          <button className="btn btn-ghost btn-sm" title="Cảnh báo">
            <Icon name="bell" size={18} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggle} title="Đổi giao diện sáng/tối">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid var(--color-neutral-300)' }}>
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
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Đăng xuất">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main className="scrl" style={{ padding: 24, flex: 1, overflow: 'auto', maxWidth: 1600, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
