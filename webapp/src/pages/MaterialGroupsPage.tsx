import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import {
  useMaterialGroupTree,
  flattenTree,
  ORIGIN_LABEL,
  type GroupNode,
} from '../lib/materialGroups';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState, Skeleton, EmptyState } from '../components/States';

// M03 — Quản lý NHÓM VẬT CHẤT: cây ngành → nhóm con (bỏ số thứ tự khỏi tên), CRUD,
// liên thông với vật chất trực thuộc (xem/chuyển nhóm). Sửa được cả nhóm BQP đã phát hành;
// chỉnh sửa được đánh dấu để lần nạp lại danh mục BQP không ghi đè.

interface MaterialRow {
  id: string;
  code: string;
  name: string;
  categoryCode: string | null;
  unitCode: string | null;
  status: string;
  attributes?: { unitRaw?: string | null };
}

function OriginBadge({ origin }: { origin: string }) {
  const bg =
    origin === 'BQP' ? 'var(--dom-stock-100, #e6eff7)' :
    origin === 'STANDARD' ? 'var(--dom-cmd-100, #eae7fb)' :
    'var(--dom-admin-100, #eef1f4)';
  const fg =
    origin === 'BQP' ? 'var(--color-accent-700, #1d4ed8)' :
    origin === 'STANDARD' ? '#5b3fb8' : 'var(--color-neutral-600, #556)';
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: bg, color: fg }}>
      {ORIGIN_LABEL[origin] ?? origin}
    </span>
  );
}

export function MaterialGroupsPage() {
  const qc = useQueryClient();
  const tree = useMaterialGroupTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<GroupNode | null>(null);
  const [creating, setCreating] = useState<{ parentCode: string | null } | null>(null);
  const [editing, setEditing] = useState<GroupNode | null>(null);
  const [moving, setMoving] = useState<MaterialRow | null>(null);

  const flat = useMemo(() => (tree.data ? flattenTree(tree.data) : []), [tree.data]);

  // Mặc định mở các nút gốc (ngành) khi nạp lần đầu.
  const rootsKey = tree.data?.map((n) => n.code).join(',') ?? '';
  useEffect(() => {
    if (tree.data) setExpanded((s) => (s.size === 0 ? new Set(tree.data!.map((n) => n.code)) : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootsKey]);

  const toggle = (code: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/material-groups/${id}`),
    onSuccess: (_r, id) => {
      toast.success('Đã xoá nhóm.');
      if (selected?.id === id) setSelected(null);
      qc.invalidateQueries({ queryKey: ['material-groups'] });
    },
    onError: (e) => toast.problem(e, 'Không xoá được nhóm'),
  });

  const afterMutate = () => {
    setCreating(null);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['material-groups'] });
  };

  const renderRow = (node: GroupNode, depth: number) => {
    const isOpen = expanded.has(node.code);
    const hasChildren = node.children.length > 0;
    const isSel = selected?.id === node.id;
    return (
      <div key={node.id}>
        <div
          onClick={() => setSelected(node)}
          className="mg-row"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
            paddingLeft: 8 + depth * 18, borderRadius: 7, cursor: 'pointer',
            background: isSel ? 'var(--color-accent-50, #eef4ff)' : 'transparent',
            border: isSel ? '1px solid var(--color-accent-300, #b9ccf5)' : '1px solid transparent',
          }}
        >
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggle(node.code); }}
            style={{ width: 18, height: 18, visibility: hasChildren ? 'visible' : 'hidden', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            <span style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          {node.ordinal && <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-500,#889)', minWidth: 16 }}>{node.ordinal}</span>}
          <span style={{ flex: 1, fontWeight: depth === 0 ? 700 : 500, fontSize: depth === 0 ? 13.5 : 13 }}>{node.name}</span>
          <OriginBadge origin={node.origin} />
          {node.userEdited && node.origin === 'BQP' && <span title="Đã sửa tay" style={{ display: 'inline-flex', color: 'var(--color-accent-600,#2563eb)' }}><Icon name="edit" size={11} /></span>}
          <span className="num" style={{ fontSize: 11, color: 'var(--color-neutral-500,#889)', minWidth: 34, textAlign: 'right' }} title="Số vật chất (gộp nhánh con)">
            {node.totalMaterialCount}
          </span>
          <div className="mg-actions" style={{ display: 'flex', gap: 2 }}>
            <button className="btn btn-sm" title="Thêm nhóm con" onClick={(e) => { e.stopPropagation(); setCreating({ parentCode: node.code }); }}><Icon name="plus" size={12} /></button>
            <button className="btn btn-sm" title="Sửa" onClick={(e) => { e.stopPropagation(); setEditing(node); }}><Icon name="edit" size={12} /></button>
            <button className="btn btn-sm" title="Xoá" onClick={(e) => { e.stopPropagation(); if (confirm(`Xoá nhóm "${node.name}"?`)) del.mutate(node.id); }}><Icon name="alert" size={12} /></button>
          </div>
        </div>
        {isOpen && node.children.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Vật chất và vật tư"
        title="Nhóm vật chất"
        description="Cây nhóm vật chất theo ngành hậu cần-kỹ thuật (Quân nhu, Quân y, Xăng dầu, Vật tư, Kỹ thuật, Doanh trại). Sửa được cả nhóm do BQP ban hành; chỉnh sửa được giữ qua các lần nạp lại danh mục."
        actions={<button className="btn btn-primary" onClick={() => setCreating({ parentCode: null })}><Icon name="plus" size={16} /> Thêm ngành/nhóm gốc</button>}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Cây nhóm */}
        <div className="card" style={{ flex: '1 1 440px', minWidth: 360, padding: 12, maxHeight: '72vh', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Cây nhóm vật chất</strong>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => tree.refetch()} title="Tải lại"><Icon name="refresh" size={13} /></button>
          </div>
          {tree.isLoading ? <Skeleton rows={8} /> : tree.isError ? <ErrorState error={tree.error} /> :
            !tree.data?.length ? <EmptyState icon="clipboard" title="Chưa có nhóm" hint="Nạp danh mục BQP hoặc thêm ngành mới." /> :
            <div>{tree.data.map((n) => renderRow(n, 0))}</div>}
        </div>

        {/* Vật chất trong nhóm đang chọn */}
        <div style={{ flex: '2 1 560px', minWidth: 420 }}>
          {selected
            ? <GroupMaterials group={selected} onMove={setMoving} onEdit={() => setEditing(selected)} />
            : <div className="card" style={{ padding: 40, textAlign: 'center' }}><EmptyState icon="box" title="Chọn một nhóm" hint="Bấm vào nhóm bên trái để xem vật chất trực thuộc và chuyển nhóm." /></div>}
        </div>
      </div>

      {creating && <GroupModal parentCode={creating.parentCode} options={flat} onClose={() => setCreating(null)} onDone={afterMutate} />}
      {editing && <GroupModal node={editing} options={flat} onClose={() => setEditing(null)} onDone={afterMutate} />}
      {moving && <MoveModal material={moving} options={flat} onClose={() => setMoving(null)} onDone={() => { setMoving(null); qc.invalidateQueries({ queryKey: ['group-materials'] }); qc.invalidateQueries({ queryKey: ['material-groups'] }); }} />}
    </>
  );
}

// ---- Panel: vật chất trong nhóm ----
function GroupMaterials({ group, onMove, onEdit }: { group: GroupNode; onMove: (m: MaterialRow) => void; onEdit: () => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const size = 12;
  const q = useQuery({
    queryKey: ['group-materials', group.id, page, search],
    queryFn: async () => (await api.get(`/material-groups/${group.id}/materials`, { params: { page, size, search: search || undefined } })).data as { data: MaterialRow[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const columns: Column<MaterialRow>[] = [
    { key: 'code', header: 'Mã vật tư', render: (m) => m.code, mono: true, width: 168 },
    { key: 'name', header: 'Tên vật chất', render: (m) => m.name },
    { key: 'unit', header: 'ĐVT', render: (m) => m.attributes?.unitRaw ?? m.unitCode ?? '—', width: 74 },
    { key: 'act', header: '', align: 'right', render: (m) => (
      <button className="btn btn-sm" onClick={() => onMove(m)} title="Chuyển sang nhóm khác"><Icon name="refresh" size={13} /> Chuyển nhóm</button>
    ) },
  ];

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {group.ordinal && <span className="num" style={{ fontWeight: 700, color: 'var(--color-neutral-500,#889)' }}>{group.ordinal}</span>}
            <h3 style={{ margin: 0, fontSize: 16 }}>{group.name}</h3>
            <OriginBadge origin={group.origin} />
          </div>
          <div className="muted num" style={{ fontSize: 11.5, marginTop: 2 }}>{group.code}</div>
          {group.description && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{group.description}</div>}
        </div>
        <button className="btn btn-sm" onClick={onEdit}><Icon name="edit" size={13} /> Sửa nhóm</button>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 12.5, marginBottom: 10 }}>
        <span className="muted">Vật chất trực thuộc: <strong>{group.materialCount}</strong></span>
        <span className="muted">Gồm cả nhánh con: <strong>{group.totalMaterialCount}</strong></span>
        <span className="muted">Nhóm con: <strong>{group.childCount}</strong></span>
      </div>

      <input className="input" style={{ maxWidth: 280, marginBottom: 10 }} placeholder="Tìm vật chất trong nhóm…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />

      {q.isError ? <ErrorState error={q.error} /> : group.materialCount === 0 && !search ? (
        <EmptyState icon="box" title="Nhóm chưa có vật chất trực thuộc" hint={group.totalMaterialCount > 0 ? 'Vật chất nằm ở các nhóm con — chọn nhóm con để xem.' : 'Chuyển vật chất từ nhóm khác sang, hoặc thêm ở màn Danh mục vật chất.'} />
      ) : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(m) => m.id} emptyTitle="Không có vật chất khớp" />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ---- Modal tạo/sửa nhóm ----
function GroupModal({ node, parentCode, options, onClose, onDone }: {
  node?: GroupNode;
  parentCode?: string | null;
  options: Array<{ node: GroupNode; depth: number }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = !!node;
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: node?.name ?? '',
    code: node?.code ?? '',
    ordinal: node?.ordinal ?? '',
    parentCode: node ? node.parentCode ?? '' : parentCode ?? '',
    sortOrder: node?.sortOrder ?? 0,
    description: node?.description ?? '',
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        ordinal: f.ordinal.trim() || undefined,
        parentCode: f.parentCode || undefined,
        sortOrder: Number(f.sortOrder) || 0,
        description: f.description.trim() || undefined,
      };
      return editing
        ? api.put(`/material-groups/${node!.id}`, body)
        : api.post('/material-groups', { ...body, code: f.code.trim() || undefined });
    },
    onSuccess: () => { toast.success(editing ? 'Đã lưu nhóm.' : 'Đã tạo nhóm.'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });

  return (
    <Modal open title={editing ? `Sửa nhóm · ${f.name}` : 'Thêm nhóm vật chất'} onClose={onClose} width={560}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 96 }}><label className="field-label">Số TT</label><input className="input" value={f.ordinal} placeholder="V, 1…" onChange={(e) => setF((s) => ({ ...s, ordinal: e.target.value }))} /></div>
          <div style={{ flex: 1 }}><label className="field-label">Tên nhóm</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        </div>
        {!editing && (
          <div><label className="field-label">Mã nhóm (bỏ trống để tự sinh)</label><input className="input" value={f.code} placeholder="VD: NGANH-QUAN-NHU" onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
        )}
        {editing && <div className="muted num" style={{ fontSize: 12 }}>Mã: {f.code} · Nguồn: {ORIGIN_LABEL[node!.origin] ?? node!.origin}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Nhóm cha</label>
            <select className="input" value={f.parentCode} onChange={(e) => setF((s) => ({ ...s, parentCode: e.target.value }))}>
              <option value="">— Cấp cao nhất (ngành) —</option>
              {options.filter((o) => o.node.code !== node?.code).map(({ node: n, depth }) => (
                <option key={n.id} value={n.code}>{' '.repeat(depth * 2)}{n.ordinal ? n.ordinal + '. ' : ''}{n.name}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 110 }}><label className="field-label">Thứ tự</label><input className="input" type="number" value={f.sortOrder} onChange={(e) => setF((s) => ({ ...s, sortOrder: Number(e.target.value) }))} /></div>
        </div>
        <div><label className="field-label">Mô tả</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={f.name.trim().length < 1 || save.isPending} onClick={() => save.mutate()}>{editing ? 'Lưu thay đổi' : 'Tạo nhóm'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Modal chuyển vật chất sang nhóm khác ----
function MoveModal({ material, options, onClose, onDone }: {
  material: MaterialRow;
  options: Array<{ node: GroupNode; depth: number }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: async () => api.post('/material-groups/move-material', { materialId: material.id, targetGroupCode: target }),
    onSuccess: () => { toast.success('Đã chuyển nhóm vật chất.'); onDone(); },
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title={`Chuyển nhóm · ${material.code}`} onClose={onClose} width={520}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13 }}><strong>{material.name}</strong></div>
        <div>
          <label className="field-label">Nhóm đích</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— Chọn nhóm —</option>
            {options.filter((o) => o.node.code !== material.categoryCode).map(({ node: n, depth }) => (
              <option key={n.id} value={n.code}>{' '.repeat(depth * 2)}{n.ordinal ? n.ordinal + '. ' : ''}{n.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!target || move.isPending} onClick={() => move.mutate()}>Chuyển nhóm</button>
        </div>
      </div>
    </Modal>
  );
}
