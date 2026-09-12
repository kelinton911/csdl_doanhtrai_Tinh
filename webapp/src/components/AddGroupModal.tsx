import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useCatalogVersions, useCatalogRoots, useCatalogChildren, type CatalogItem, type CatalogVersion } from '../lib/catalog';
import { Modal } from './Modal';
import { Icon } from './Icon';

type LeafItem = { id: string; code: string; name: string };

// "Thêm cả nhóm": duyệt cây danh mục (loại → nhóm → …), thêm HÀNG LOẠT toàn bộ mã lá của một nhóm
// vào lưới khai báo (số lượng 0), hoặc thêm từng mã lá. Tái dùng hook cây + endpoint /items/:id/leaves.
export function AddGroupModal({ onClose, onAdd }: { onClose: () => void; onAdd: (items: { id: string; label: string }[]) => number }) {
  const [versionId, setVersionId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [addedTotal, setAddedTotal] = useState(0);

  const versions = useCatalogVersions();
  const published = useMemo(
    () => (versions.data?.data ?? []).filter((v: CatalogVersion) => v.status === 'PUBLISHED'),
    [versions.data],
  );
  const roots = useCatalogRoots(versionId ?? undefined);
  const currentParentId = path.length ? path[path.length - 1].id : undefined;
  const children = useCatalogChildren(currentParentId);

  // Tự đi xuống khi phiên bản chỉ có 1 nút gốc không phải lá.
  useEffect(() => {
    if (versionId && path.length === 0 && roots.data && roots.data.length === 1 && !roots.data[0].isLeaf) {
      const r = roots.data[0];
      setPath([{ id: r.id, label: r.name }]);
    }
  }, [versionId, path.length, roots.data]);

  const nodes: CatalogItem[] = path.length ? children.data ?? [] : roots.data ?? [];
  const loading = path.length ? children.isLoading : roots.isLoading;

  const addGroup = async (nodeId: string, nodeName: string) => {
    setBusy(true);
    try {
      const leaves = (await api.get<LeafItem[]>(`/catalog/items/${nodeId}/leaves`)).data;
      const added = onAdd(leaves.map((l) => ({ id: l.id, label: `${l.code} — ${l.name}` })));
      setAddedTotal((t) => t + added);
      toast.success(`Đã thêm ${added} dòng từ nhóm "${nodeName}"${added < leaves.length ? ` (bỏ ${leaves.length - added} trùng)` : ''}.`);
    } catch (e) {
      toast.problem(e, 'Lấy danh sách nhóm thất bại');
    } finally {
      setBusy(false);
    }
  };
  const addLeaf = (node: CatalogItem) => {
    const added = onAdd([{ id: node.id, label: `${node.code} — ${node.name}` }]);
    setAddedTotal((t) => t + added);
    if (added === 0) toast.info('Mục này đã có trong danh sách.');
  };

  return (
    <Modal open title="Thêm cả nhóm vật chất" onClose={onClose} width={540}>
      {!versionId ? (
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          <div className="muted" style={{ fontSize: 12, padding: '4px 2px' }}>Chọn loại vật chất:</div>
          {versions.isLoading ? (
            <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tải…</div>
          ) : (
            published.map((v: CatalogVersion) => (
              <button key={v.id} type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => { setVersionId(v.id); setPath([]); }}>
                <span><Icon name="box" size={13} /> {v.versionName}</span>
                <Icon name="chevron" size={14} />
              </button>
            ))
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', padding: '2px 0 8px', borderBottom: '1px solid var(--color-neutral-200)', fontSize: 12 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVersionId(null); setPath([]); }}>
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevron" size={12} /></span> Đổi loại
            </button>
            {path.map((c, i) => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="muted">/</span>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setPath((p) => p.slice(0, i + 1))}>{c.label}</button>
              </span>
            ))}
            {currentParentId && (
              <button type="button" className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }} disabled={busy}
                onClick={() => addGroup(currentParentId, path[path.length - 1].label)}>
                <Icon name="plus" size={13} /> Thêm cả nhóm hiện tại
              </button>
            )}
          </div>
          <div style={{ maxHeight: 300, overflow: 'auto', paddingTop: 6 }}>
            {loading ? (
              <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tải…</div>
            ) : nodes.length === 0 ? (
              <div className="muted" style={{ padding: 10, fontSize: 13 }}>Không có mục con.</div>
            ) : (
              nodes.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'flex-start' }}
                    onClick={() => (it.isLeaf ? addLeaf(it) : setPath((p) => [...p, { id: it.id, label: it.name }]))}>
                    <span className="num" style={{ minWidth: 96, color: 'var(--color-neutral-600)' }}>{it.code}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{it.name}</span>
                    {it.isLeaf ? <Icon name="plus" size={13} /> : <Icon name="chevron" size={14} />}
                  </button>
                  {!it.isLeaf && (
                    <button type="button" className="btn btn-sm" title="Thêm tất cả trong nhóm" disabled={busy} onClick={() => addGroup(it.id, it.name)}>
                      <Icon name="plus" size={12} /> cả nhóm
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>{addedTotal > 0 ? `Đã thêm ${addedTotal} dòng` : 'Bấm một nhóm để thêm hàng loạt, hoặc một mã để thêm lẻ'}</span>
        <button className="btn btn-primary" onClick={onClose}>Xong</button>
      </div>
    </Modal>
  );
}
