import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchCatalog, type CatalogItem } from '../lib/catalog';
import { Icon } from './Icon';

// Chọn mã vật chất chuẩn (DT-01) từ tìm kiếm — tái dùng cho DT-04/DT-05.
export function MaterialPicker({
  value,
  label,
  onPick,
}: {
  value: string | null;
  label: string | null;
  onPick: (id: string, label: string) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useQuery({
    enabled: open && q.trim().length > 1,
    queryKey: ['material-picker', q],
    queryFn: async () => (await searchCatalog(q.trim())).items,
  });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={open ? q : label ?? ''}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm mã/tên vật chất…"
          style={{ flex: 1 }}
        />
        {value && !open && <Icon name="check" size={15} />}
      </div>
      {open && q.trim().length > 1 && (
        <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, maxHeight: 220, overflow: 'auto', background: 'var(--surface-1)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, marginTop: 2 }}>
          {results.isLoading ? <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tìm…</div> :
            !results.data?.length ? <div className="muted" style={{ padding: 10, fontSize: 13 }}>Không có kết quả.</div> : (
              results.data.map((it: CatalogItem) => (
                <button
                  key={it.id}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { onPick(it.id, `${it.code} — ${it.name}`); setOpen(false); setQ(''); }}
                >
                  <span className="num" style={{ minWidth: 84, color: 'var(--color-neutral-600)' }}>{it.code}</span> {it.name}
                </button>
              ))
            )}
        </div>
      )}
    </div>
  );
}
