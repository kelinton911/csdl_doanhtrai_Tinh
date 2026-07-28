import type { ReactNode } from 'react';
import { Icon } from './Icon';

// Modal đơn giản, có overlay + tiêu đề + vùng nội dung.
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
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,32,0.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface-1)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
