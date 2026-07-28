import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

// KPI card: giá trị, đơn vị, xu hướng, mức tin cậy, thời điểm cập nhật (Frontend §5.4).
export function KpiCard({
  label,
  value,
  unit,
  icon,
  dom = 'cmd',
  trend,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: IconName;
  dom?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  hint?: string;
}) {
  const color = `var(--dom-${dom})`;
  const trendColor =
    trend?.dir === 'up'
      ? 'var(--ok-fg)'
      : trend?.dir === 'down'
        ? 'var(--danger-fg)'
        : 'var(--color-neutral-600)';
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="eyebrow">{label}</span>
        <span
          style={{
            display: 'inline-flex',
            padding: 6,
            borderRadius: 8,
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="num" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span className="muted" style={{ fontSize: 13 }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        {trend ? (
          <span style={{ color: trendColor, fontWeight: 600 }}>
            {trend.dir === 'up' ? '▲' : trend.dir === 'down' ? '▼' : '■'} {trend.text}
          </span>
        ) : (
          <span />
        )}
        {hint && <span className="muted">{hint}</span>}
      </div>
    </div>
  );
}
