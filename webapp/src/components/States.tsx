import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { toProblem } from '../lib/api';

// Skeleton khi tải (không dùng spinner toàn màn — Frontend §9).
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 40,
            borderRadius: 8,
            background:
              'linear-gradient(90deg, var(--color-neutral-200), var(--color-neutral-100), var(--color-neutral-200))',
            backgroundSize: '200% 100%',
            animation: 'csdl-shimmer 1.2s infinite',
          }}
        />
      ))}
      <style>{`@keyframes csdl-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export function EmptyState({
  icon = 'box',
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      <span style={{ color: 'var(--color-neutral-500)' }}>
        <Icon name={icon} size={34} />
      </span>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      {hint && <div className="muted" style={{ maxWidth: '48ch' }}>{hint}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const p = toProblem(error);
  return (
    <div
      className="panel"
      style={{
        padding: 24,
        borderColor: 'var(--danger-bd)',
        background: 'var(--danger-bg)',
        color: 'var(--danger-fg)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <Icon name="alert" size={22} />
      <div>
        <div style={{ fontWeight: 700 }}>
          {p.code} — {p.title}
        </div>
        {p.correlationId && (
          <div className="num" style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            Mã truy vết: {p.correlationId}
          </div>
        )}
      </div>
    </div>
  );
}
