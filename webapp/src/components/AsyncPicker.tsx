import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Ô chọn tìm kiếm cho danh mục lớn (xã/phường, doanh trại…): gõ để lọc, chọn từ gợi ý.
// endpoint phải hỗ trợ ?search=&size= trả { data: [{id,code,name}] } và GET endpoint/:id trả {name,code}.
export function AsyncPicker({
  endpoint,
  value,
  onChange,
  placeholder,
}: {
  endpoint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  const current = useQuery({
    queryKey: ['picker-current', endpoint, value],
    queryFn: async () => (await api.get(`${endpoint}/${value}`)).data as { name?: string; code?: string },
    enabled: !!value,
  });
  const results = useQuery({
    queryKey: ['picker-search', endpoint, term],
    queryFn: async () => (await api.get(endpoint, { params: { search: term, size: 15 } })).data as { data: Array<{ id: string; code: string; name: string }> },
    enabled: open && term.trim().length >= 1,
  });

  const label = value ? `${current.data?.name ?? ''}${current.data?.code ? ` (${current.data.code})` : ''}`.trim() : '';

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder={placeholder}
        value={open ? term : label}
        onFocus={() => { setOpen(true); setTerm(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setTerm(e.target.value)}
      />
      {value && !open && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 4, top: 4, padding: '2px 6px' }} onMouseDown={(e) => { e.preventDefault(); onChange(''); }} title="Bỏ chọn">✕</button>
      )}
      {open && term.trim().length >= 1 && (
        <div className="scrl" style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 30, background: 'var(--surface-1)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: 260, overflow: 'auto' }}>
          {(results.data?.data ?? []).length === 0 ? (
            <div className="muted" style={{ padding: 12, fontSize: 13 }}>{results.isLoading ? 'Đang tìm…' : 'Không có kết quả'}</div>
          ) : (
            (results.data?.data ?? []).map((it) => (
              <button
                key={it.id}
                type="button"
                className="rowh"
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
                onMouseDown={(e) => { e.preventDefault(); onChange(it.id); setOpen(false); }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</span>
                <span className="num muted" style={{ fontSize: 11 }}>{it.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
