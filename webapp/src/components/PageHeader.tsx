import type { ReactNode } from 'react';

// Tiêu đề trang: eyebrow (nhóm), tên, mô tả, và vùng hành động bên phải.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{title}</h1>
        {description && (
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: '70ch', fontSize: 13.5 }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}
