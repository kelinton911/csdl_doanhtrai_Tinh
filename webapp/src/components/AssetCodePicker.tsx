import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import {
  useAssetChildren,
  useAssetDetail,
  useAssetSearch,
  displayName,
  type AssetDomain,
  type AssetNode,
} from '../lib/assetCatalog';

// Chọn mã trong TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (1272 mã, 6 cấp).
// Hai lối vào: duyệt cây (tải lười theo nhánh) và tìm kiếm (không dấu).
// Kết quả tìm kiếm LUÔN kèm đường dẫn tổ tiên — 121 dòng tên đúng bằng "Các loại khác".

function Warnings({ node }: { node: AssetNode }) {
  return (
    <>
      {node.unitOnGroup && (
        <span
          title="Nút này vừa có ĐVT vừa có nhóm con. Khi tổng hợp phải tránh cộng trùng."
          style={{ fontSize: 10, background: 'var(--color-warning-bg, #fff4e5)', color: 'var(--color-warning, #a15c00)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}
        >
          ĐVT trên nhóm
        </span>
      )}
      {node.duplicateGroup && (
        <span
          title={`Tên này còn xuất hiện ở chương khác ("${node.duplicateGroup}"). Xem kỹ đường dẫn trước khi chọn.`}
          style={{ fontSize: 10, background: 'var(--color-danger-bg, #fdecec)', color: 'var(--color-danger, #b42318)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}
        >
          trùng tên
        </span>
      )}
    </>
  );
}

function TreeNode({
  node,
  depth,
  domain,
  selected,
  onSelect,
}: {
  node: AssetNode;
  depth: number;
  domain?: AssetDomain;
  selected: string | null;
  onSelect: (n: AssetNode) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  // Chỉ gọi API khi nhánh được mở — tải lười, tránh kéo cả 1272 nút.
  const children = useAssetChildren(node.code, { domain, enabled: open && !node.isLeaf });
  const isSel = selected === node.code;

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', paddingLeft: 8 + depth * 18,
          borderBottom: '1px solid var(--color-neutral-200)',
          background: isSel ? 'var(--color-primary-bg, #e8f0fe)' : undefined,
          cursor: 'pointer',
        }}
        onClick={() => onSelect(node)}
      >
        {!node.isLeaf ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            aria-label={open ? 'Thu gọn' : 'Mở rộng'}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', color: 'var(--color-neutral-600)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}
          >
            <Icon name="chevron" size={13} />
          </button>
        ) : (
          <span style={{ width: 13, display: 'inline-block' }} />
        )}
        <span className="num muted" style={{ fontSize: 11, minWidth: 148 }}>{node.code}</span>
        <span style={{ flex: 1, fontWeight: node.isLeaf ? 400 : 600 }}>{displayName(node.name)}</span>
        <Warnings node={node} />
        {node.unitRaw && (
          <span className="muted" style={{ fontSize: 11, minWidth: 46, textAlign: 'right' }}>{node.unitRaw}</span>
        )}
        {!node.isLeaf && (
          <span className="muted" style={{ fontSize: 11 }}>{node.childCount}</span>
        )}
      </div>
      {open && !node.isLeaf && (
        children.isLoading
          ? <div className="muted" style={{ padding: '6px 8px', paddingLeft: 26 + depth * 18, fontSize: 12 }}>Đang tải…</div>
          : (children.data?.data ?? []).map((c) => (
              <TreeNode key={c.code} node={c} depth={depth + 1} domain={domain} selected={selected} onSelect={onSelect} />
            ))
      )}
    </div>
  );
}

export function AssetCodePicker({
  open,
  onClose,
  onPick,
  value,
  domain,
  leafOnly = false,
  title = 'Chọn mã danh mục tài sản ngành Doanh trại',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (node: AssetNode) => void;
  value?: string | null;
  domain?: AssetDomain;
  leafOnly?: boolean;
  title?: string;
}) {
  const [tab, setTab] = useState<'tree' | 'search'>('tree');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<AssetNode | null>(null);

  const roots = useAssetChildren(null, { enabled: open });
  const search = useAssetSearch(
    { q: term, domain, leafOnly, size: 40 },
    open && tab === 'search' && term.trim().length >= 2,
  );
  // Khi mở picker với giá trị sẵn có, lấy chi tiết để hiện đường dẫn ở chân modal.
  const current = useAssetDetail(open && value && !selected ? value : null);
  const shown = selected ?? current.data?.item ?? null;

  const pick = () => {
    if (!shown) return;
    if (leafOnly && !shown.isLeaf) return;
    onPick(shown);
    onClose();
  };

  const blocked = !shown || (leafOnly && !shown.isLeaf);

  return (
    <Modal open={open} title={title} onClose={onClose} width={860}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn btn-sm ${tab === 'tree' ? 'btn-primary' : ''}`} onClick={() => setTab('tree')}>Cây danh mục</button>
        <button className={`btn btn-sm ${tab === 'search' ? 'btn-primary' : ''}`} onClick={() => setTab('search')}>Tìm kiếm</button>
        {domain && (
          <span className="muted" style={{ fontSize: 12, alignSelf: 'center', marginLeft: 'auto' }}>
            Chỉ hiện nhóm {domain === 'FACILITY' ? 'công trình (chương I–IV, XVII)' : 'vật chất (chương V, VII–XVI, XVIII)'}
          </span>
        )}
      </div>

      {tab === 'search' && (
        <input
          className="input"
          autoFocus
          placeholder="Nhập tên (không cần dấu) hoặc mã, tối thiểu 2 ký tự…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ marginBottom: 10 }}
        />
      )}

      <div style={{ border: '1px solid var(--color-neutral-300)', borderRadius: 8, overflow: 'auto', maxHeight: '46vh' }}>
        {tab === 'tree' ? (
          roots.isLoading
            ? <div className="muted" style={{ padding: 16 }}>Đang tải danh mục…</div>
            : (roots.data?.data ?? []).map((r) => (
                <TreeNode key={r.code} node={r} depth={0} domain={domain} selected={shown?.code ?? null} onSelect={setSelected} />
              ))
        ) : term.trim().length < 2 ? (
          <div className="muted" style={{ padding: 16 }}>Nhập ít nhất 2 ký tự để tìm.</div>
        ) : search.isLoading ? (
          <div className="muted" style={{ padding: 16 }}>Đang tìm…</div>
        ) : (search.data?.data.length ?? 0) === 0 ? (
          <div className="muted" style={{ padding: 16 }}>Không có kết quả phù hợp.</div>
        ) : (
          <>
            <div className="muted" style={{ padding: '6px 10px', fontSize: 12, borderBottom: '1px solid var(--color-neutral-200)' }}>
              {search.data!.meta.total} kết quả
            </div>
            {search.data!.data.map((n) => (
              <div
                key={n.code}
                onClick={() => setSelected(n)}
                style={{
                  padding: '7px 10px', borderBottom: '1px solid var(--color-neutral-200)', cursor: 'pointer',
                  background: shown?.code === n.code ? 'var(--color-primary-bg, #e8f0fe)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="num muted" style={{ fontSize: 11, minWidth: 148 }}>{n.code}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{displayName(n.name)}</span>
                  <Warnings node={n} />
                  {n.unitRaw && <span className="muted" style={{ fontSize: 11 }}>{n.unitRaw}</span>}
                </div>
                {/* Đường dẫn tổ tiên là BẮT BUỘC: nếu không, "Các loại khác" vô nghĩa. */}
                <div className="muted" style={{ fontSize: 11, marginTop: 2, paddingLeft: 156 }}>{n.pathNames}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ marginTop: 12, padding: 10, background: 'var(--surface-2, #f6f8fa)', borderRadius: 6, minHeight: 54 }}>
        {shown ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong className="num">{shown.code}</strong>
              <span>{displayName(shown.name)}</span>
              {shown.unitRaw && <span className="muted">· ĐVT: {shown.unitRaw}</span>}
              <Warnings node={shown} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{shown.pathNames}</div>
            {leafOnly && !shown.isLeaf && (
              <div style={{ fontSize: 12, color: 'var(--color-danger, #b42318)', marginTop: 4 }}>
                Đây là nhóm ({shown.childCount} mục con) — hãy chọn một mục cụ thể.
              </div>
            )}
          </>
        ) : (
          <span className="muted">Chưa chọn mã nào.</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={blocked} onClick={pick}>Chọn mã này</button>
      </div>
    </Modal>
  );
}
