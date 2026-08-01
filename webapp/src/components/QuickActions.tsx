import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import type { QuickAction } from '../lib/roles';

// Thanh hành động nhanh của workspace theo vai trò — các việc trọng tâm bấm là mở ngay.
// Mỗi nút tô theo màu nhóm nghiệp vụ (--dom-*) để phân biệt trực quan.
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const nav = useNavigate();
  if (!actions.length) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {actions.map((a) => {
        const color = `var(--dom-${a.dom})`;
        return (
          <button
            key={a.to + a.label}
            onClick={() => nav(a.to)}
            className="card rowh"
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--color-neutral-300)',
              background: 'var(--surface-1)',
              borderLeft: `4px solid ${color}`,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                padding: 8,
                borderRadius: 8,
                color,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                flexShrink: 0,
              }}
            >
              <Icon name={a.icon} size={18} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{a.label}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-neutral-400)' }}>
              <Icon name="chevron" size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
