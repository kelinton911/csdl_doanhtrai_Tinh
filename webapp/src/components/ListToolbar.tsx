import type { ReactNode } from 'react';
import { Icon } from './Icon';

// Thanh công cụ danh sách dùng chung: ô tìm kiếm + khe cắm bộ lọc + khe hành động phải.
// Tách khỏi từng trang để mọi list (khai báo/nhà/đất/kho) có UX tìm-lọc nhất quán.
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = 'Tìm kiếm…',
  filters,
  right,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 14,
      }}
    >
      <div style={{ position: 'relative', minWidth: 240, flex: '0 1 320px' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)', pointerEvents: 'none' }}>
          <Icon name="search" size={15} />
        </span>
        <input
          className="input"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ width: '100%', paddingLeft: 32 }}
        />
        {search && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onSearch('')}
            aria-label="Xóa tìm kiếm"
            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
          >
            ✕
          </button>
        )}
      </div>
      {filters}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}

// Nhóm nút lọc nhanh (segmented) — dùng cho lọc trạng thái/kỳ.
export function QuickFilter<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={o.key}
          className="btn btn-sm"
          onClick={() => onChange(o.key)}
          style={{
            background: value === o.key ? 'var(--color-accent-600)' : 'var(--surface-1)',
            color: value === o.key ? '#fff' : 'var(--color-text)',
            borderColor: value === o.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
