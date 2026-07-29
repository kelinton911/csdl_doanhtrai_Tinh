import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { toProblem } from '../lib/api';
import { Icon } from '../components/Icon';
import { useTheme } from '../lib/theme';

// Màn đăng nhập split-view (Frontend §6.1) — panel định danh + panel xác thực.
// Chỉ điền sẵn tài khoản demo ở môi trường phát triển; PROD để trống, không lộ thông tin.
const IS_DEV = import.meta.env.DEV;

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [username, setUsername] = useState(IS_DEV ? 'admin' : '');
  const [password, setPassword] = useState(IS_DEV ? 'admin@123' : '');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

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
          padding: '56px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Đăng nhập hệ thống</div>
          <h2 style={{ fontWeight: 800, fontSize: 28, margin: 0 }}>XÁC THỰC NGƯỜI DÙNG</h2>
        </div>
        <div style={{ height: 2, background: 'var(--color-text)' }} />

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

        {IS_DEV && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', background: 'var(--color-accent-100)', border: '1px solid var(--color-accent-300)', padding: 10, borderRadius: 6 }}>
            Tài khoản demo (chỉ DEV): admin · chihuy · hckt · xa01 · kiemduyet — mật khẩu <b>admin@123</b>.
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
