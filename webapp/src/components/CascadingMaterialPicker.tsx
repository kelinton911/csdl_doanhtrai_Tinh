import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  searchCatalog,
  useCatalogVersions,
  useCatalogRoots,
  useCatalogChildren,
  type CatalogItem,
  type CatalogVersion,
} from '../lib/catalog';
import { Icon } from './Icon';

// Chọn mã vật chất theo cây: chọn LOẠI (Quân nhu / Doanh trại / …) rồi thu hẹp dần tới mục cuối.
// Kèm chế độ "Tìm nhanh" (gõ mã/tên, hỗ trợ không dấu). Cùng props với MaterialPicker (drop-in).
type Crumb = { id: string; label: string };

export function CascadingMaterialPicker({
  value,
  label,
  onPick,
}: {
  value: string | null;
  label: string | null;
  onPick: (id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'tree' | 'search'>('tree');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [path, setPath] = useState<Crumb[]>([]); // đường dẫn drill hiện tại (không kể nút gốc tự nhảy)
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // Đóng popover khi bấm ra ngoài.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const versions = useCatalogVersions();
  const published = useMemo(
    () => (versions.data?.data ?? []).filter((v: CatalogVersion) => v.status === 'PUBLISHED'),
    [versions.data],
  );

  const roots = useCatalogRoots(versionId ?? undefined);
  const currentParentId = path.length ? path[path.length - 1].id : undefined;
  const children = useCatalogChildren(currentParentId);

  // Tự đi xuống khi phiên bản chỉ có 1 nút gốc không phải lá (vd ROOT "Quân nhu" → 12 nhóm).
  useEffect(() => {
    if (versionId && path.length === 0 && roots.data && roots.data.length === 1 && !roots.data[0].isLeaf) {
      const r = roots.data[0];
      setPath([{ id: r.id, label: r.name }]);
    }
  }, [versionId, path.length, roots.data]);

  const searchResults = useQuery({
    enabled: open && mode === 'search' && q.trim().length > 1,
    queryKey: ['cascading-picker-search', q],
    queryFn: async () => (await searchCatalog(q.trim())).items,
  });

  // Danh sách nút đang hiển thị ở chế độ cây.
  const nodes: CatalogItem[] = path.length ? children.data ?? [] : roots.data ?? [];
  const loadingNodes = path.length ? children.isLoading : roots.isLoading;

  const reset = () => {
    setVersionId(null);
    setPath([]);
    setQ('');
  };
  const pick = (it: CatalogItem) => {
    onPick(it.id, `${it.code} — ${it.name}`);
    setOpen(false);
    reset();
  };

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, justifyContent: 'flex-start', border: '1px solid var(--color-neutral-300)' }}
          onClick={() => setOpen((o) => !o)}
          title={label ?? 'Chọn vật chất'}
        >
          <Icon name="box" size={14} />
          <span style={{ marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label ?? <span className="muted">Chọn vật chất…</span>}
          </span>
        </button>
        {value && <Icon name="check" size={15} />}
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            width: 380,
            maxWidth: '90vw',
            background: 'var(--surface-1)',
            border: '1px solid var(--color-neutral-300)',
            borderRadius: 8,
            marginTop: 4,
            boxShadow: '0 6px 24px rgba(0,0,0,.18)',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 6, borderBottom: '1px solid var(--color-neutral-200)' }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'tree' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('tree')}
            >
              <Icon name="grid" size={13} /> Duyệt cây
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'search' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('search')}
            >
              <Icon name="search" size={13} /> Tìm nhanh
            </button>
          </div>

          {mode === 'tree' ? (
            <div>
              {/* Bước 1: chọn loại vật chất (phiên bản danh mục PUBLISHED). */}
              {!versionId ? (
                <div style={{ maxHeight: 260, overflow: 'auto', padding: 6 }}>
                  <div className="muted" style={{ fontSize: 12, padding: '4px 6px' }}>Chọn loại vật chất:</div>
                  {versions.isLoading ? (
                    <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tải…</div>
                  ) : published.length === 0 ? (
                    <div className="muted" style={{ padding: 10, fontSize: 13 }}>Chưa có danh mục nào được công bố.</div>
                  ) : (
                    published.map((v: CatalogVersion) => (
                      <button
                        key={v.id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'space-between' }}
                        onClick={() => { setVersionId(v.id); setPath([]); }}
                      >
                        <span><Icon name="box" size={13} /> {v.versionName}</span>
                        <Icon name="chevron" size={14} />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  {/* Breadcrumb */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--color-neutral-200)', fontSize: 12 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={reset} title="Đổi loại vật chất">
                      <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevron" size={12} /></span> Đổi loại
                    </button>
                    {path.map((c, i) => (
                      <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="muted">/</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 6px' }}
                          onClick={() => setPath((p) => p.slice(0, i + 1))}
                        >
                          {c.label}
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Danh sách nút cấp hiện tại */}
                  <div style={{ maxHeight: 260, overflow: 'auto', padding: 6 }}>
                    {loadingNodes ? (
                      <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tải…</div>
                    ) : nodes.length === 0 ? (
                      <div className="muted" style={{ padding: 10, fontSize: 13 }}>Không có mục con.</div>
                    ) : (
                      nodes.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
                          onClick={() => (it.isLeaf ? pick(it) : setPath((p) => [...p, { id: it.id, label: it.name }]))}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span className="num" style={{ minWidth: 96, display: 'inline-block', color: 'var(--color-neutral-600)' }}>{it.code}</span>
                            {it.name}
                          </span>
                          {it.isLeaf ? <Icon name="check" size={13} /> : <Icon name="chevron" size={14} />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chế độ tìm nhanh */
            <div style={{ padding: 6 }}>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm mã/tên vật chất (gõ có dấu hoặc không dấu)…"
                style={{ width: '100%', padding: '6px 8px' }}
              />
              <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 6 }}>
                {q.trim().length <= 1 ? (
                  <div className="muted" style={{ padding: 10, fontSize: 13 }}>Nhập ít nhất 2 ký tự.</div>
                ) : searchResults.isLoading ? (
                  <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tìm…</div>
                ) : !searchResults.data?.length ? (
                  <div className="muted" style={{ padding: 10, fontSize: 13 }}>Không có kết quả.</div>
                ) : (
                  searchResults.data.map((it: CatalogItem) => (
                    <button
                      key={it.id}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => pick(it)}
                    >
                      <span className="num" style={{ minWidth: 96, color: 'var(--color-neutral-600)' }}>{it.code}</span> {it.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
