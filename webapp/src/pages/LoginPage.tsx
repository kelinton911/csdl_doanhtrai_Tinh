import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toProblem } from '../lib/api';
import { Icon } from '../components/Icon';
import { useTheme } from '../lib/theme';

// Màn đăng nhập split-view (Frontend §6.1) — panel định danh + panel xác thực.
// Hiển thị bộ tài khoản demo/kiểm thử để hỗ trợ test & phát triển (kể cả khi chạy container Docker).
// Nếu muốn ẩn ở môi trường sản xuất thật (PROD), đặt VITE_HIDE_DEMO_ACCOUNTS=true trong .env.
const SHOW_DEMO = import.meta.env.VITE_HIDE_DEMO_ACCOUNTS !== 'true';

// Tài khoản demo — mỗi vai trò một tài khoản để kiểm thử giao diện riêng.
interface DemoAccount {
  u: string;
  p: string;
  label: string;
  desc: string;
  roleCode: string;
  badgeBg: string;
  badgeFg: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    u: 'admin',
    p: 'admin@123',
    label: 'Quản trị hệ thống',
    desc: 'Quản trị toàn quyền, cấu hình hệ thống & phân quyền người dùng',
    roleCode: 'SYS_ADMIN',
    badgeBg: 'var(--role-sys-bg)',
    badgeFg: 'var(--role-sys)',
  },
  {
    u: 'chihuy',
    p: 'admin@123',
    label: 'Chỉ huy tỉnh',
    desc: 'Lãnh đạo Bộ CHQS tỉnh, theo dõi bức tranh tổng thể & duyệt báo cáo',
    roleCode: 'PROVINCIAL_COMMAND',
    badgeBg: 'var(--role-cmd-bg)',
    badgeFg: 'var(--role-cmd)',
  },
  {
    u: 'hckt',
    p: 'admin@123',
    label: 'CB ngành doanh trại',
    desc: 'Cán bộ quản lý doanh trại, công trình, dự án & theo dõi vật chất',
    roleCode: 'BARRACKS_OFFICER',
    badgeBg: 'var(--role-hckt-bg)',
    badgeFg: 'var(--role-hckt)',
  },
  {
    u: 'xa01',
    p: 'admin@123',
    label: 'CB Ban CHQS xã',
    desc: 'Cán bộ quản lý dữ liệu Ban CHQS cấp xã / địa bàn cơ sở',
    roleCode: 'COMMUNE_USER',
    badgeBg: 'var(--role-ward-bg)',
    badgeFg: 'var(--role-ward)',
  },
  {
    u: 'kiemduyet',
    p: 'admin@123',
    label: 'Kiểm duyệt viên',
    desc: 'Thẩm định, duyệt biến động doanh trại & phiếu kiểm kê tài sản',
    roleCode: 'REVIEWER',
    badgeBg: 'var(--info-bg)',
    badgeFg: 'var(--info-fg)',
  },
  {
    u: 'kiemtra',
    p: 'admin@123',
    label: 'CB kiểm tra - thanh tra',
    desc: 'Kiểm tra, thanh tra chuyên ngành, phát hiện sai sót & chênh lệch',
    roleCode: 'AUDITOR',
    badgeBg: 'var(--role-audit-bg)',
    badgeFg: 'var(--role-audit)',
  },
  {
    u: 'baocao',
    p: 'admin@123',
    label: 'Xem báo cáo',
    desc: 'Quyền tra cứu, xem báo cáo tổng hợp & xuất dữ liệu hệ thống',
    roleCode: 'REPORT_VIEWER',
    badgeBg: 'var(--color-accent-100)',
    badgeFg: 'var(--color-accent-700)',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [username, setUsername] = useState(SHOW_DEMO ? 'admin' : '');
  const [password, setPassword] = useState(SHOW_DEMO ? 'admin@123' : '');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  // State tiện ích kiểm thử demo
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [demoTab, setDemoTab] = useState<'chips' | 'list'>('chips');
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const fillAccount = (acc: DemoAccount) => {
    setUsername(acc.u);
    setPassword(acc.p);
    showToast(`✓ Đã tự điền tài khoản [${acc.u}] vào form đăng nhập!`);
  };

  const copyText = async (text: string, label: string, keyId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
      showToast(`✓ Đã sao chép ${label}: "${text}"`);
    } catch {
      showToast(`Không thể sao chép tự động. Vui lòng chọn và copy thủ công.`);
    }
  };

  const filteredAccounts = DEMO_ACCOUNTS.filter((a) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      a.u.toLowerCase().includes(q) ||
      a.label.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      a.roleCode.toLowerCase().includes(q)
    );
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLocked(false);
    try {
      await login(username.trim(), password, otp);
      nav('/dashboard', { replace: true });
    } catch (err) {
      const p = toProblem(err);
      // 423 Locked / 429 Too Many Requests → tài khoản bị khóa tạm thời do đăng nhập sai nhiều lần.
      if (p.status === 423 || p.status === 429) {
        setLocked(true);
        setError('Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau hoặc liên hệ quản trị.');
      } else if (p.code === 'AUTH-005' || p.code === 'AUTH-006') {
        // Tài khoản đã bật OTP: hiện ô nhập mã.
        setNeedOtp(true);
        setError(p.code === 'AUTH-006' ? 'Mã OTP không đúng. Vui lòng nhập lại.' : 'Tài khoản yêu cầu mã OTP. Nhập mã 6 số từ ứng dụng Authenticator.');
      } else {
        setError(p.title);
      }
    } finally {
      setBusy(false);
    }
  }

  // Đăng nhập nhanh theo vai trò (chỉ DEV) để kiểm thử giao diện riêng của từng vai trò.
  async function loginAs(user: string) {
    const acc = DEMO_ACCOUNTS.find((a) => a.u === user);
    const pass = acc?.p || 'admin@123';
    setUsername(user);
    setPassword(pass);
    setBusy(true);
    setError(null);
    setLocked(false);
    try {
      await login(user, pass);
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError(toProblem(err).title);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 520px', background: 'var(--color-bg)' }}>
      {/* Panel định danh */}
      <div
        style={{
          background: 'var(--nav-bg)',
          color: 'var(--nav-fg)',
          padding: '56px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'var(--teal)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                fontSize: 18,
              }}
            >
              DT
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1.5, color: 'var(--nav-fg-dim)' }}>
              Bộ Chỉ huy Quân sự tỉnh
              <br />
              Cơ quan Hậu cần - Kỹ thuật
            </div>
          </div>

          <button
            type="button"
            onClick={() => nav('/')}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--teal)', border: '1px solid var(--teal)', padding: '6px 14px', fontSize: 12, fontWeight: 700 }}
          >
            ← Trang giới thiệu GeoVR 3D
          </button>
        </div>
        <div style={{ maxWidth: 620 }}>
          <div style={{ height: 2, background: 'var(--color-accent-400)', width: 96, marginBottom: 28 }} />
          <h1 style={{ fontWeight: 800, fontSize: 48, lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 24px' }}>
            HỆ THỐNG CƠ SỞ DỮ LIỆU VẬT CHẤT DOANH TRẠI CẤP TỈNH
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--nav-fg-dim)', margin: 0, maxWidth: '46ch' }}>
            Quản lý tập trung doanh trại, công trình, vật chất, kiểm kê và khả năng bảo đảm phục vụ chỉ
            huy trong chiến tranh bảo vệ Tổ quốc.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 40, borderTop: '2px solid var(--nav-rule)', paddingTop: 20, fontSize: 12, color: 'var(--nav-muted)' }}>
          <div>
            <div style={{ color: 'var(--nav-fg)', fontWeight: 700, letterSpacing: '0.1em' }}>MẠNG NỘI BỘ</div>
            Ưu tiên hạ tầng nội bộ
          </div>
          <div>
            <div style={{ color: 'var(--nav-fg)', fontWeight: 700, letterSpacing: '0.1em' }}>DỮ LIỆU GIẢ LẬP</div>
            Không phải số liệu thật
          </div>
          <div>
            <div style={{ color: 'var(--nav-fg)', fontWeight: 700, letterSpacing: '0.1em' }}>PHIÊN BẢN</div>
            1.0.0-internal
          </div>
        </div>
      </div>

      {/* Panel xác thực */}
      <form
        onSubmit={submit}
        style={{
          background: 'var(--surface-1)',
          borderLeft: '2px solid var(--color-text)',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 18,
          overflowY: 'auto',
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Đăng nhập hệ thống</div>
          <h2 style={{ fontWeight: 800, fontSize: 28, margin: 0 }}>XÁC THỰC NGƯỜI DÙNG</h2>
        </div>
        <div style={{ height: 2, background: 'var(--color-text)' }} />

        {/* Notification Toast phản hồi các thao tác copy/tự điền */}
        {toastMsg && (
          <div
            role="status"
            style={{
              background: 'var(--ok-bg)',
              color: 'var(--ok-fg)',
              border: '1px solid var(--ok-bd)',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <Icon name="check" size={16} />
            <span>{toastMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="field-label" htmlFor="acc">Tài khoản (bắt buộc)</label>
          <input id="acc" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="field-label" htmlFor="pw">Mật khẩu (bắt buộc)</label>
          <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {needOtp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="field-label" htmlFor="otp">Mã OTP (6 số)</label>
            <input id="otp" className="input num" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
        )}

        {error && (
          <div role="alert" style={{ border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, borderRadius: 6 }}>
            <Icon name={locked ? 'lock' : 'alert'} size={18} />
            {error}
          </div>
        )}

        <button className="btn btn-primary" disabled={busy || locked} style={{ justifyContent: 'center', padding: '11px 14px' }}>
          {busy ? 'Đang xác thực…' : 'Đăng nhập'}
        </button>

        {/* Danh sách tài khoản demo và công cụ copy / tự điền nhanh (dùng cho dev & testing) */}
        {SHOW_DEMO && (
          <div
            style={{
              background: 'var(--color-accent-100)',
              border: '1px solid var(--color-accent-300)',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: 12,
            }}
          >
            {/* Header & Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="user" size={15} />
                <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--color-accent-800)' }}>
                  Tài khoản Demo / Kiểm thử
                </span>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--color-accent-600)', color: '#fff', fontWeight: 700 }}>
                  DEV
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-1)', padding: 2, borderRadius: 6, border: '1px solid var(--color-neutral-300)' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${demoTab === 'chips' ? 'btn-accent' : 'btn-ghost'}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setDemoTab('chips')}
                >
                  ⚡ Thẻ nhanh
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${demoTab === 'list' ? 'btn-accent' : 'btn-ghost'}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setDemoTab('list')}
                >
                  📋 Chi tiết & Copy
                </button>
              </div>
            </div>

            {demoTab === 'chips' ? (
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginBottom: 8 }}>
                  Nhấp <b>Tự điền</b> hoặc <b>Đăng nhập</b> theo từng vai trò (mật khẩu <code>admin@123</code>):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEMO_ACCOUNTS.map((a) => (
                    <div
                      key={a.u}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'var(--surface-1)',
                        border: '1px solid var(--color-neutral-300)',
                        borderRadius: 6,
                        padding: '2px 4px 2px 8px',
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text)' }}>
                        {a.label}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 5px', fontSize: 11, color: 'var(--color-accent-700)' }}
                        onClick={() => fillAccount(a)}
                        title={`Tự điền tài khoản ${a.u} vào form`}
                      >
                        <Icon name="edit" size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => loginAs(a.u)}
                        title={`Đăng nhập ngay bằng ${a.u}`}
                        style={{ padding: '2px 8px', fontSize: 11 }}
                      >
                        Vào ngay
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Thanh tìm kiếm & lọc */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className="input"
                      style={{ padding: '4px 8px 4px 26px', fontSize: 11.5, height: 28 }}
                      placeholder="Tìm theo tên, vai trò..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                    />
                    <span style={{ position: 'absolute', left: 7, top: 6, opacity: 0.6 }}>
                      <Icon name="search" size={13} />
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => copyText('admin@123', 'Mật khẩu chung', 'pw-all')}
                    title="Copy mật khẩu chung admin@123"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    <Icon name="clipboard" size={12} /> Copy MK chung
                  </button>
                </div>

                {/* Danh sách thẻ tài khoản */}
                <div className="scrl" style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                  {filteredAccounts.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', textAlign: 'center', padding: 12 }}>
                      Không tìm thấy tài khoản phù hợp với "{filterQuery}".
                    </div>
                  ) : (
                    filteredAccounts.map((a) => (
                      <div
                        key={a.u}
                        style={{
                          background: 'var(--surface-1)',
                          border: '1px solid var(--color-neutral-300)',
                          borderRadius: 6,
                          padding: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{a.label}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: a.badgeBg,
                                  color: a.badgeFg,
                                }}
                              >
                                {a.roleCode}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 2 }}>
                              {a.desc}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => fillAccount(a)}
                              title="Tự điền vào form đăng nhập"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                            >
                              <Icon name="edit" size={12} /> Điền
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={busy}
                              onClick={() => loginAs(a.u)}
                              title="Đăng nhập ngay"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                              Vào ngay
                            </button>
                          </div>
                        </div>

                        {/* Hàng thông tin & nút Sao chép */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4, borderTop: '1px dashed var(--color-neutral-300)', fontSize: 11, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-neutral-600)' }}>Tên:</span>
                            <code style={{ background: 'var(--color-neutral-200)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{a.u}</code>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '1px 4px', height: 20, fontSize: 10.5 }}
                              onClick={() => copyText(a.u, 'Tài khoản', `u-${a.u}`)}
                              title="Sao chép tên tài khoản"
                            >
                              <Icon name={copiedKey === `u-${a.u}` ? 'check' : 'clipboard'} size={11} />
                              {copiedKey === `u-${a.u}` ? 'Đã chép' : 'Copy TK'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-neutral-600)' }}>Mật khẩu:</span>
                            <code style={{ background: 'var(--color-neutral-200)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{a.p}</code>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '1px 4px', height: 20, fontSize: 10.5 }}
                              onClick={() => copyText(a.p, 'Mật khẩu', `p-${a.u}`)}
                              title="Sao chép mật khẩu"
                            >
                              <Icon name={copiedKey === `p-${a.u}` ? 'check' : 'clipboard'} size={11} />
                              {copiedKey === `p-${a.u}` ? 'Đã chép' : 'Copy MK'}
                            </button>
                          </div>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '1px 4px', height: 20, fontSize: 10.5, color: 'var(--color-accent-700)', marginLeft: 'auto' }}
                            onClick={() => copyText(`${a.u} / ${a.p}`, 'Tài khoản & Mật khẩu', `all-${a.u}`)}
                            title="Sao chép cả tài khoản và mật khẩu"
                          >
                            <Icon name="clipboard" size={11} /> Copy cả 2
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--color-neutral-600)', borderTop: '1px solid var(--color-neutral-300)', paddingTop: 14 }}>
          <span>Máy trạm nội bộ</span>
          <button type="button" onClick={toggle} className="btn btn-ghost btn-sm">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} /> {theme === 'light' ? 'Nền tối' : 'Nền sáng'}
          </button>
        </div>
      </form>
    </div>
  );
}

