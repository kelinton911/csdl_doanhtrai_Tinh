import { useEffect, useId, type ReactNode } from 'react';

// Modal đơn giản, có overlay + tiêu đề + vùng nội dung.
// A11y (WCAG 2.2): role=dialog + aria-modal, đóng bằng phím Esc, gắn aria-labelledby.
export function Modal({
  open,
  title,
  onClose,
  children,
  width = 480,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,32,0.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface-1)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <h3 id={titleId} style={{ fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
