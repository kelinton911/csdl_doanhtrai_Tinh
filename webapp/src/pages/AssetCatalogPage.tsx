import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { AssetCodePicker } from '../components/AssetCodePicker';
import { toast } from '../lib/toast';
import { downloadCsv, type CsvColumn } from '../lib/csv';
import {
  displayName,
  setAssetCode,
  useAssetChildren,
  useAssetGaps,
  useAssetMeta,
  useAssetSearch,
  type AssetNode,
  type GapRow,
} from '../lib/assetCatalog';

// TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI — Phụ lục kèm CV 2837/DT-QLDT ngày 16/7/2026
// của Cục Doanh trại/TCHC-KT. Dữ liệu do BQP sở hữu: chỉ tra cứu, không sửa tại đây.

type Tab = 'tree' | 'search' | 'gaps';

function Badges({ n }: { n: AssetNode }) {
  return (
    <>
      {n.unitOnGroup && (
        <span title="Vừa có ĐVT vừa có nhóm con — khi tổng hợp phải tránh cộng trùng"
          style={{ fontSize: 10, background: 'var(--color-warning-bg, #fff4e5)', color: 'var(--color-warning, #a15c00)', padding: '1px 6px', borderRadius: 4 }}>
          ĐVT trên nhóm
        </span>
      )}
      {n.duplicateGroup && (
        <span title={`Tên còn xuất hiện ở chương khác ("${n.duplicateGroup}")`}
          style={{ fontSize: 10, background: 'var(--color-danger-bg, #fdecec)', color: 'var(--color-danger, #b42318)', padding: '1px 6px', borderRadius: 4 }}>
          trùng tên
        </span>
      )}
    </>
  );
}

function TreeRow({ node, depth }: { node: AssetNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const children = useAssetChildren(node.code, { enabled: open && !node.isLeaf });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', paddingLeft: 8 + depth * 18, borderBottom: '1px solid var(--color-neutral-200)' }}>
        {!node.isLeaf ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Thu gọn' : 'Mở rộng'}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', color: 'var(--color-neutral-600)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>
            <Icon name="chevron" size={13} />
          </button>
        ) : <span style={{ width: 13, display: 'inline-block' }} />}
        <span className="num muted" style={{ fontSize: 11, minWidth: 150 }}>{node.code}</span>
        <span style={{ flex: 1, fontWeight: node.isLeaf ? 400 : 600 }}>{displayName(node.name)}</span>
        <Badges n={node} />
        {node.unitRaw && <span className="muted" style={{ fontSize: 11, minWidth: 48, textAlign: 'right' }}>{node.unitRaw}</span>}
        {!node.isLeaf && <span className="muted" style={{ fontSize: 11, minWidth: 34, textAlign: 'right' }}>{node.childCount}</span>}
      </div>
      {open && !node.isLeaf && (
        children.isLoading
          ? <div className="muted" style={{ padding: '6px 8px', paddingLeft: 26 + depth * 18, fontSize: 12 }}>Đang tải…</div>
          : (children.data?.data ?? []).map((c) => <TreeRow key={c.code} node={c} depth={depth + 1} />)
      )}
    </div>
  );
}

export function AssetCatalogPage() {
  const [tab, setTab] = useState<Tab>('tree');
  const meta = useAssetMeta();

  // --- tab Tìm kiếm ---
  const [term, setTerm] = useState('');
  const [chapter, setChapter] = useState('');
  const [leafOnly, setLeafOnly] = useState(false);
  const [dupOnly, setDupOnly] = useState(false);
  const [page, setPage] = useState(1);
  const search = useAssetSearch(
    { q: term, chapter: chapter || undefined, leafOnly, duplicatesOnly: dupOnly, page, size: 20 },
    tab === 'search',
  );

  // --- tab Rà soát thiếu mã ---
  const [kind, setKind] = useState<'material' | 'facility'>('facility');
  const [gapPage, setGapPage] = useState(1);
  const [picking, setPicking] = useState<GapRow | null>(null);
  const gaps = useAssetGaps({ kind, page: gapPage, size: 20 });
  const qc = useQueryClient();

  const roots = useAssetChildren(null, { enabled: tab === 'tree' });

  const assign = async (row: GapRow, node: AssetNode | null, status?: string) => {
    try {
      await setAssetCode(kind, row.id, { assetCode: node?.code ?? null, status });
      toast.success(node ? `Đã gắn mã ${node.code}` : 'Đã đánh dấu ngoài phạm vi ngành Doanh trại');
      qc.invalidateQueries({ queryKey: ['asset-catalog', 'gaps'] });
    } catch (e) {
      toast.problem(e, 'Không gắn được mã');
    }
  };

  const csvCols: CsvColumn<AssetNode>[] = [
    { header: 'Mã vật tư', value: (r) => r.code },
    { header: 'Tên vật tư', value: (r) => r.name },
    { header: 'ĐVT', value: (r) => r.unitRaw ?? '' },
    { header: 'Chương', value: (r) => r.chapter ?? '' },
    { header: 'Đường dẫn', value: (r) => r.pathNames },
  ];

  const searchCols: Column<AssetNode>[] = [
    { key: 'code', header: 'Mã tài sản', mono: true, width: 168, render: (r) => r.code },
    {
      key: 'name',
      header: 'Tên tài sản',
      render: (r) => (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: r.isLeaf ? 400 : 600 }}>{displayName(r.name)}</span>
            <Badges n={r} />
          </div>
          {/* Đường dẫn tổ tiên là bắt buộc — 121 dòng tên đúng bằng "Các loại khác". */}
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{r.pathNames}</div>
        </div>
      ),
    },
    { key: 'chapter', header: 'Chương', width: 78, render: (r) => r.chapter ?? '—' },
    { key: 'unit', header: 'ĐVT', width: 74, render: (r) => r.unitRaw ?? '—' },
    { key: 'level', header: 'Cấp', width: 56, align: 'right', render: (r) => r.level },
  ];

  const gapCols: Column<GapRow>[] = [
    { key: 'code', header: 'Mã cục bộ', mono: true, width: 140, render: (r) => r.code },
    { key: 'name', header: 'Tên', render: (r) => r.name },
    { key: 'st', header: 'Trạng thái', width: 120, render: (r) => <span className="muted">{r.assetCodeStatus}</span> },
    {
      key: 'act',
      header: 'Hành động',
      width: 260,
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-primary" onClick={() => setPicking(r)}>Gắn mã</button>
          <button className="btn btn-sm" title="Thuộc ngành khác (Quân nhu, Xăng dầu…) — không có mã trong phụ lục ngành Doanh trại"
            onClick={() => assign(r, null, 'OUT_OF_SCOPE')}>
            Ngoài phạm vi
          </button>
        </div>
      ),
    },
  ];

  if (meta.isError) return <ErrorState error={meta.error} />;
  const m = meta.data;

  return (
    <div>
      <PageHeader
        eyebrow="Danh mục dùng chung"
        title="Danh mục tài sản ngành Doanh trại"
        description={
          m?.loaded
            ? `Phụ lục kèm Công văn ${m.revision} — Cục Doanh trại/TCHC-KT · ${m.total} mã · ${m.chapters.length} chương`
            : 'Chưa nạp dữ liệu danh mục.'
        }
        actions={
          <button className="btn" disabled={!search.data?.data.length}
            onClick={() => downloadCsv(
              `danh-muc-tai-san-${new Date().toISOString().slice(0, 10)}`,
              search.data?.data ?? [],
              csvCols,
            )}>
            <Icon name="download" size={15} /> Xuất kết quả tìm kiếm
          </button>
        }
      />

      {m?.loaded === false && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <strong>Chưa nạp danh mục.</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            Chạy: <code>npm run seed:asset-catalog</code> rồi <code>npm run seed:official-catalog</code>
          </div>
        </div>
      )}

      {m?.loaded && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13 }}>
          <span><strong>{m.total}</strong> <span className="muted">mã</span></span>
          <span><strong>{m.leafCount}</strong> <span className="muted">mục cụ thể</span></span>
          <span><strong>{m.groupCount}</strong> <span className="muted">nhóm</span></span>
          <span><strong>{m.domains.MATERIAL ?? 0}</strong> <span className="muted">vật chất</span></span>
          <span><strong>{m.domains.FACILITY ?? 0}</strong> <span className="muted">công trình</span></span>
          <span title="Nút vừa có ĐVT vừa có nhóm con — khi tổng hợp phải tránh cộng trùng">
            <strong>{m.unitOnGroupCount}</strong> <span className="muted">ĐVT trên nhóm ⚠</span>
          </span>
          <span title="Nhóm tên trùng nhau giữa các chương khác nhau">
            <strong>{m.duplicateGroupCount}</strong> <span className="muted">nhóm trùng tên ⚠</span>
          </span>
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }} title={`SHA-256 của file nguồn: ${m.sourceSha}`}>
            bản {m.revision} · {m.sourceSha.slice(0, 12)}…
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`btn btn-sm ${tab === 'tree' ? 'btn-primary' : ''}`} onClick={() => setTab('tree')}>Cây danh mục</button>
        <button className={`btn btn-sm ${tab === 'search' ? 'btn-primary' : ''}`} onClick={() => setTab('search')}>Tìm kiếm</button>
        <button className={`btn btn-sm ${tab === 'gaps' ? 'btn-primary' : ''}`} onClick={() => setTab('gaps')}>Rà soát thiếu mã</button>
      </div>

      {tab === 'tree' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {roots.isLoading
            ? <div className="muted" style={{ padding: 16 }}>Đang tải danh mục…</div>
            : (roots.data?.data ?? []).map((r) => <TreeRow key={r.code} node={r} depth={0} />)}
        </div>
      )}

      {tab === 'search' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ maxWidth: 340 }} placeholder="Tìm theo tên (không cần dấu) hoặc mã…"
              value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} />
            <select className="input" style={{ maxWidth: 260 }} value={chapter}
              onChange={(e) => { setChapter(e.target.value); setPage(1); }}>
              <option value="">— Tất cả chương —</option>
              {(m?.chapters ?? []).map((c) => (
                <option key={c.chapter} value={c.chapter}>{c.chapterName} ({c.itemCount})</option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={leafOnly} onChange={(e) => { setLeafOnly(e.target.checked); setPage(1); }} />
              Chỉ mục cụ thể
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}
              title="Chỉ hiện các mã có tên trùng với chương khác — phục vụ rà soát">
              <input type="checkbox" checked={dupOnly} onChange={(e) => { setDupOnly(e.target.checked); setPage(1); }} />
              Chỉ mã trùng tên ⚠
            </label>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <DataTable columns={searchCols} rows={search.data?.data} loading={search.isLoading}
              rowKey={(r) => r.code} emptyTitle="Không có kết quả"
              emptyHint="Thử bỏ bớt bộ lọc hoặc nhập từ khoá khác." />
          </div>
          {search.data && (
            <Pagination page={page} size={20} total={search.data.meta.total} onPage={setPage} />
          )}
        </>
      )}

      {tab === 'gaps' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <select className="input" style={{ maxWidth: 220 }} value={kind}
              onChange={(e) => { setKind(e.target.value as 'material' | 'facility'); setGapPage(1); }}>
              <option value="facility">Công trình</option>
              <option value="material">Vật chất</option>
            </select>
            <span className="muted" style={{ fontSize: 13 }}>
              Mục chưa gắn mã quốc gia. Gắn mã, hoặc đánh dấu “Ngoài phạm vi” nếu thuộc ngành khác.
            </span>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <DataTable columns={gapCols} rows={gaps.data?.data} loading={gaps.isLoading}
              rowKey={(r) => r.id} emptyTitle="Không còn mục nào thiếu mã"
              emptyHint="Mọi mục đã được gắn mã hoặc đánh dấu ngoài phạm vi." />
          </div>
          {gaps.data && (
            <Pagination page={gapPage} size={20} total={gaps.data.meta.total} onPage={setGapPage} />
          )}
        </>
      )}

      <AssetCodePicker
        open={!!picking}
        onClose={() => setPicking(null)}
        value={picking?.assetCode ?? null}
        domain={kind === 'facility' ? 'FACILITY' : 'MATERIAL'}
        leafOnly
        onPick={(node) => { if (picking) assign(picking, node, 'MAPPED'); }}
      />
    </div>
  );
}
