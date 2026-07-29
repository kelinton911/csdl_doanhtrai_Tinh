import { Icon, type IconName } from './Icon';
import { dismiss, useToasts, type ToastKind } from '../lib/toast';

const STYLE: Record<ToastKind, { bg: string; fg: string; bd: string; icon: IconName }> = {
  success: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', bd: 'var(--ok-bd)', icon: 'check' },
  error: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', bd: 'var(--danger-bd)', icon: 'alert' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', bd: 'var(--info-bd)', icon: 'bell' },
  warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', bd: 'var(--warn-bd)', icon: 'alert' },
};

// Vùng hiển thị toast (mount 1 lần ở gốc app). aria-live để trình đọc màn hình đọc thông báo.
export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 'min(92vw, 380px)',
      }}
    >
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="card"
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '12px 14px',
              background: s.bg,
              border: `1px solid ${s.bd}`,
              color: s.fg,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>
              <Icon name={s.icon} size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>}
              <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{t.message}</div>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Đóng thông báo"
              style={{ all: 'unset', cursor: 'pointer', color: s.fg, opacity: 0.7, fontSize: 14, padding: '0 2px' }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
