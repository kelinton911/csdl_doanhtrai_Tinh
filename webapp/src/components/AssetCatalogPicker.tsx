import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { EmptyState, Skeleton, ErrorState } from './States';
import {
  useAssetSearch,
  useAssetMeta,
  displayName,
  shortPath,
  type AssetNode,
} from '../lib/assetCatalog';

// Bộ chọn vật chất TỪ danh mục chuẩn BQP (Phụ lục CV 2837) — miền MATERIAL, chỉ nút lá.
// Thực hiện quyết định C: khai báo vật chất không nhập tay, luôn chọn từ danh mục gốc.
// Dùng lại các hook tìm kiếm/tra cứu trong lib/assetCatalog.ts (search phía máy chủ,
// LUÔN kèm đường dẫn tổ tiên vì 121 tên trùng "Các loại khác").
export function AssetCatalogPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (node: AssetNode) => void;
}) {
  const [q, setQ] = useState('');
  const [chapter, setChapter] = useState('');
  const [page, setPage] = useState(1);
  const size = 25;

  const meta = useAssetMeta();
  // Chỉ hiện các chương thuộc miền vật chất để lọc nhanh.
  const materialChapters = (meta.data?.chapters ?? []).filter((c) => c.domain === 'MATERIAL');

  const enabled = q.trim().length >= 2 || chapter !== '';
  const res = useAssetSearch(
    { q: q.trim() || undefined, chapter: chapter || undefined, domain: 'MATERIAL', leafOnly: true, page, size },
    enabled,
  );

  const rows = res.data?.data ?? [];
  const total = res.data?.meta.total ?? 0;

  return (
    <Modal open={open} title="Chọn vật chất từ danh mục chuẩn BQP" onClose={onClose} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 420 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--color-neutral-500)' }}>
              <Icon name="search" size={16} />
            </span>
            <input
              className="input"
              autoFocus
              style={{ paddingLeft: 32 }}
              placeholder="Tìm theo tên (không dấu) hoặc mã R##…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>
          <select className="input" style={{ maxWidth: 260 }} value={chapter} onChange={(e) => { setPage(1); setChapter(e.target.value); }}>
            <option value="">Tất cả chương (miền vật chất)</option>
            {materialChapters.map((c) => (
              <option key={c.chapter} value={c.chapter}>Chương {c.chapter} — {c.chapterName}</option>
            ))}
          </select>
        </div>

        <div className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="alert" size={13} /> Định danh vật chất lấy từ danh mục chuẩn của Bộ Quốc phòng. Nếu vật chất thuộc ngành khác (không có trong phụ lục ngành Doanh trại), đóng cửa sổ này và chọn "Ngoài phạm vi ngành".
        </div>

        {!enabled ? (
          <EmptyState icon="search" title="Nhập từ khoá hoặc chọn chương" hint="Gõ ít nhất 2 ký tự theo tên/mã, hoặc chọn một chương để duyệt danh mục chuẩn." />
        ) : res.isError ? (
          <ErrorState error={res.error} />
        ) : res.isLoading ? (
          <Skeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon="box" title="Không tìm thấy" hint="Không có mã vật chất phù hợp trong danh mục chuẩn BQP." />
        ) : (
          <div className="scrl" style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflow: 'auto' }}>
            {rows.map((n) => (
              <button
                key={n.code}
                className="rowh"
                onClick={() => onSelect(n)}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-neutral-200)' }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{displayName(n.name)}</span>
                  <span className="muted" style={{ fontSize: 11.5, display: 'block', marginTop: 2 }}>
                    {shortPath(n.pathNames) || `Chương ${n.chapter ?? '—'}`}
                  </span>
                </span>
                {n.unitRaw && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)', color: 'var(--color-neutral-700)' }}>{n.unitRaw}</span>}
                <span className="num muted" style={{ fontSize: 11.5, minWidth: 150, textAlign: 'right' }}>{n.code}</span>
                <span className="btn btn-sm btn-primary" style={{ pointerEvents: 'none' }}><Icon name="check" size={13} /> Chọn</span>
              </button>
            ))}
          </div>
        )}

        {enabled && total > size && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
            <span className="muted">Trang {page} · {total} kết quả</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
              <button className="btn btn-sm" disabled={page * size >= total} onClick={() => setPage((p) => p + 1)}>Sau</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
