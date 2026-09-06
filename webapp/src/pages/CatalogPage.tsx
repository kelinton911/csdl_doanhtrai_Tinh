import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  buildTree,
  useCatalogItem,
  useCatalogItems,
  useCatalogVersions,
  useItemAliases,
  useReplacementWarning,
  useUnits,
  type CatalogItem,
  type CatalogTreeNode,
} from '../lib/catalog';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Icon, type IconName } from '../components/Icon';

// SCR-DT01-01 — Danh mục Doanh trại: trái cây R00, phải hồ sơ mã (tab Thông tin,
// Cây con, Tên khác, Mã thay thế). Thanh: chọn phiên bản, tìm kiếm.
type Tab = 'info' | 'children' | 'alias' | 'replacement';

export function CatalogPage() {
  const versions = useCatalogVersions();
  const [versionId, setVersionId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => {
    if (!versionId && versions.data?.data.length) {
      const published = versions.data.data.find((v) => v.status === 'PUBLISHED');
      setVersionId(published?.id ?? versions.data.data[0].id);
    }
  }, [versions.data, versionId]);

  const items = useCatalogItems(versionId || undefined);
  const units = useUnits();
  const unitById = useMemo(() => new Map((units.data?.data ?? []).map((u) => [u.id, u])), [units.data]);

  const tree = useMemo(() => (items.data ? buildTree(items.data.data) : []), [items.data]);
  const filtered = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.trim().toLowerCase();
    const match = (n: CatalogTreeNode): CatalogTreeNode | null => {
      const kids = n.children.map(match).filter(Boolean) as CatalogTreeNode[];
      const hit = n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
      return hit || kids.length ? { ...n, children: kids } : null;
    };
    return tree.map(match).filter(Boolean) as CatalogTreeNode[];
  }, [tree, search]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const currentVersion = versions.data?.data.find((v) => v.id === versionId);

  return (
    <div>
      <PageHeader
        eyebrow="DT-01 · Danh mục chuẩn ngành"
        title="Danh mục Doanh trại (R00)"
        description="Nguồn chuẩn (Single Source of Truth): phiên bản hóa, cây phân loại, tên khác, mã thay thế."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn btn-ghost btn-sm" to="/catalog/compare"><Icon name="refresh" size={15} /> So sánh</Link>
            <Link className="btn btn-ghost btn-sm" to="/catalog/queue"><Icon name="clock" size={15} /> Hàng chờ</Link>
            <Link className="btn btn-primary btn-sm" to="/catalog/import"><Icon name="upload" size={15} /> Nhập danh mục</Link>
          </div>
        }
      />

      <div className="panel" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <span className="muted">Phiên bản:</span>
          <select value={versionId} onChange={(e) => { setVersionId(e.target.value); setSelectedId(null); }} style={{ minWidth: 240 }}>
            {(versions.data?.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.versionCode} — {v.versionName}</option>
            ))}
          </select>
        </label>
        {currentVersion && <StatusBadge status={currentVersion.status} />}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã / tên…" style={{ minWidth: 240, paddingLeft: 30 }} />
          <span style={{ position: 'absolute', left: 9, top: 8, color: 'var(--color-neutral-500)' }}><Icon name="search" size={15} /></span>
        </div>
      </div>

      {versions.isLoading ? (
        <Skeleton rows={8} />
      ) : versions.isError ? (
        <ErrorState error={versions.error} />
      ) : !versions.data?.data.length ? (
        <EmptyState icon="file" title="Chưa có phiên bản danh mục" hint="Nhập danh mục để bắt đầu." action={<Link className="btn btn-primary btn-sm" to="/catalog/import">Nhập danh mục</Link>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
          <div className="panel" style={{ padding: 8, maxHeight: '70vh', overflow: 'auto' }}>
            {items.isLoading ? <Skeleton rows={10} /> : !filtered.length ? (
              <EmptyState icon="box" title="Không có mã phù hợp" />
            ) : (
              <TreeList nodes={filtered} depth={0} expanded={expanded} onToggle={toggle} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setTab('info'); }} />
            )}
          </div>

          <div>
            {!selectedId ? (
              <EmptyState icon="box" title="Chọn một mã ở cây bên trái" hint="Xem thông tin, cây con, tên khác, mã thay thế." />
            ) : (
              <ItemDetail id={selectedId} tab={tab} setTab={setTab} unitName={(uid) => (uid ? unitById.get(uid)?.name ?? uid : '—')} onSelect={setSelectedId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeList({ nodes, depth, expanded, onToggle, selectedId, onSelect }: {
  nodes: CatalogTreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {nodes.map((n) => {
        const hasKids = n.children.length > 0;
        const open = expanded.has(n.id);
        const active = selectedId === n.id;
        return (
          <li key={n.id}>
            <div
              onClick={() => onSelect(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', paddingLeft: 8 + depth * 16,
                borderRadius: 6, cursor: 'pointer', background: active ? 'var(--color-accent-100, #e6eff7)' : 'transparent', fontWeight: active ? 700 : 400,
              }}
            >
              {hasKids ? (
                <button className="btn btn-ghost btn-sm" style={{ padding: 0, width: 18, height: 18 }} onClick={(e) => { e.stopPropagation(); onToggle(n.id); }} aria-label={open ? 'Thu gọn' : 'Mở rộng'}>
                  <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}><Icon name="chevron" size={14} /></span>
                </button>
              ) : <span style={{ width: 18, display: 'inline-block' }} />}
              <span className="num" style={{ fontSize: 12.5, color: 'var(--color-neutral-600)', minWidth: 78 }}>{n.code}</span>
              <span style={{ fontSize: 13.5 }}>{n.name}</span>
            </div>
            {hasKids && open && (
              <TreeList nodes={n.children} depth={depth + 1} expanded={expanded} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useChildrenOf(id: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['catalog', 'children', id],
    queryFn: async () => (await api.get<CatalogItem[]>(`/catalog/items/${id}/children`)).data,
  });
}

function ItemDetail({ id, tab, setTab, unitName, onSelect }: {
  id: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  unitName: (uid: string | null) => string;
  onSelect: (id: string) => void;
}) {
  const item = useCatalogItem(id);
  const aliases = useItemAliases(tab === 'alias' ? id : undefined);
  const childItems = useChildrenOf(id, tab === 'children');
  const replacement = useReplacementWarning(tab === 'replacement' ? id : undefined);

  if (item.isLoading) return <Skeleton rows={6} />;
  if (item.isError) return <ErrorState error={item.error} />;
  const it = item.data!;

  const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
    { key: 'info', label: 'Thông tin', icon: 'file' },
    { key: 'children', label: 'Cây con', icon: 'grid' },
    { key: 'alias', label: 'Tên khác', icon: 'search' },
    { key: 'replacement', label: 'Mã thay thế', icon: 'refresh' },
  ];

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num" style={{ fontSize: 15, fontWeight: 800 }}>{it.code}</span>
          <StatusBadge status={it.status} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{it.name}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--color-neutral-200)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 'info' && (
          <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 16px', margin: 0 }}>
            <dt className="muted">Mã chuẩn</dt><dd className="num">{it.code}</dd>
            <dt className="muted">Tên</dt><dd>{it.name}</dd>
            <dt className="muted">Cấp</dt><dd>{it.levelNo}</dd>
            <dt className="muted">Đơn vị tính</dt><dd>{unitName(it.unitId)}</dd>
            <dt className="muted">Nút lá</dt><dd>{it.isLeaf ? 'Có (mã dùng được)' : 'Không (nhóm)'}</dd>
            <dt className="muted">Trạng thái</dt><dd><StatusBadge status={it.status} /></dd>
          </dl>
        )}

        {tab === 'children' && (
          childItems.isLoading ? <Skeleton rows={4} /> :
          !childItems.data?.length ? <EmptyState icon="box" title="Không có mã con (nút lá)" /> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {childItems.data.map((c) => (
                <li key={c.id}>
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => onSelect(c.id)}>
                    <span className="num" style={{ minWidth: 80, color: 'var(--color-neutral-600)' }}>{c.code}</span> {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'alias' && (
          aliases.isLoading ? <Skeleton rows={3} /> :
          !aliases.data?.length ? <EmptyState icon="search" title="Chưa có tên khác" hint="Thêm alias để tra mã chuẩn từ tên gọi thông dụng." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px' }}>Tên khác</th><th style={{ padding: '6px 8px' }}>Loại</th><th style={{ padding: '6px 8px' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {aliases.data.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '6px 8px' }}>{a.aliasName}</td>
                    <td style={{ padding: '6px 8px' }}>{a.aliasType}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'replacement' && (
          replacement.isLoading ? <Skeleton rows={2} /> :
          replacement.data?.replaced ? (
            <div className="panel" style={{ padding: 16, borderColor: 'var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)', display: 'flex', gap: 10 }}>
              <Icon name="alert" size={20} />
              <div>
                <div style={{ fontWeight: 700 }}>Mã này đã có mã thay thế (BR-DT01-011)</div>
                <div style={{ marginTop: 4 }}>Hãy dùng mã hiện hành: <b className="num">{replacement.data.newCode ?? replacement.data.newMaterialId}</b></div>
              </div>
            </div>
          ) : <EmptyState icon="check" title="Mã đang hiệu lực" hint="Không có mã thay thế." />
        )}
      </div>
    </div>
  );
}
