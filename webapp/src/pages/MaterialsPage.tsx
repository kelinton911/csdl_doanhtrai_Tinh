import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';

// M03 — Danh mục vật chất (UC-07): tạo (nháp) → sửa khi chưa phát hành → phát hành (bất biến).
interface Material {
  id: string;
  code: string;
  name: string;
  categoryCode: string | null;
  unitCode: string | null;
  spec: string | null;
  qualityGrade: string | null;
  status: string; // DRAFT | PUBLISHED | INACTIVE
  version: number;
}

export function MaterialsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const size = 15;
  const cat = useCatalog('material-category');
  const unit = useCatalog('unit-of-measure');

  const q = useQuery({
    queryKey: ['materials', page, search, category],
    queryFn: async () => (await api.get('/materials', { params: { page, size, search: search || undefined, category: category || undefined } })).data as { data: Material[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });
  const publish = useMutation({ mutationFn: async (id: string) => api.post(`/materials/${id}/publish`), onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }) });

  const columns: Column<Material>[] = [
    { key: 'code', header: 'Mã VC', render: (m) => m.code, mono: true, width: 110 },
    { key: 'name', header: 'Tên vật chất', render: (m) => <span style={{ fontWeight: 600 }}>{m.name}</span> },
    { key: 'cat', header: 'Nhóm', render: (m) => cat.label(m.categoryCode) },
    { key: 'unit', header: 'ĐVT', render: (m) => unit.label(m.unitCode) },
    { key: 'spec', header: 'Quy cách', render: (m) => m.spec ?? '—' },
    { key: 'ver', header: 'PB', render: (m) => `v${m.version}`, mono: true, align: 'right', width: 60 },
    { key: 'status', header: 'Trạng thái', render: (m) => <StatusBadge status={m.status} /> },
    { key: 'act', header: '', align: 'right', render: (m) => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {m.status !== 'PUBLISHED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(m); }}><Icon name="edit" size={14} /> Sửa</button>}
        {m.status !== 'PUBLISHED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); publish.mutate(m.id); }}><Icon name="check" size={14} /> Phát hành</button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vật chất và vật tư"
        title="Danh mục vật chất"
        description="Danh mục chuẩn dùng chung cho tồn kho, kiểm kê và báo cáo. Mã duy nhất; đã phát hành thì bất biến — sửa phải tạo phiên bản mới."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Thêm vật chất</button>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Tìm theo mã hoặc tên…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select className="input" style={{ maxWidth: 220 }} value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }}>
          <option value="">Tất cả nhóm</option>
          {cat.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(m) => m.id} emptyTitle="Chưa có vật chất" />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {creating && <MaterialModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['materials'] }); }} />}
      {editing && <MaterialModal id={editing.id} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['materials'] }); }} />}
    </>
  );
}

// Tạo mới (không có id) hoặc sửa (có id → nạp chi tiết GET /materials/:id).
function MaterialModal({ id, onClose, onDone }: { id?: string; onClose: () => void; onDone: () => void }) {
  const editing = !!id;
  const cat = useCatalog('material-category');
  const unit = useCatalog('unit-of-measure');
  const grade = useCatalog('quality-grade');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(!editing);
  const [f, setF] = useState({ code: '', name: '', categoryCode: '', unitCode: '', spec: '', qualityGrade: '' });

  const detail = useQuery({ queryKey: ['material', id], queryFn: async () => (await api.get(`/materials/${id}`)).data as Material, enabled: editing });
  if (editing && detail.data && !seeded) {
    const d = detail.data;
    setF({ code: d.code, name: d.name, categoryCode: d.categoryCode ?? '', unitCode: d.unitCode ?? '', spec: d.spec ?? '', qualityGrade: d.qualityGrade ?? '' });
    setSeeded(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: f.name, categoryCode: f.categoryCode || undefined, unitCode: f.unitCode || undefined, spec: f.spec || undefined, qualityGrade: f.qualityGrade || undefined };
      return editing ? api.put(`/materials/${id}`, body) : api.post('/materials', { code: f.code, ...body });
    },
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });

  return (
    <Modal open title={editing ? `Sửa vật chất · ${f.code}` : 'Thêm vật chất'} onClose={onClose} width={560}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mã vật chất</label><input className="input" value={f.code} disabled={editing} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
          <div style={{ flex: 2 }}><label className="field-label">Tên</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Nhóm</label><select className="input" value={f.categoryCode} onChange={(e) => setF((s) => ({ ...s, categoryCode: e.target.value }))}><option value="">—</option>{cat.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Đơn vị tính</label><select className="input" value={f.unitCode} onChange={(e) => setF((s) => ({ ...s, unitCode: e.target.value }))}><option value="">—</option>{unit.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Cấp chất lượng</label><select className="input" value={f.qualityGrade} onChange={(e) => setF((s) => ({ ...s, qualityGrade: e.target.value }))}><option value="">—</option>{grade.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
        </div>
        <div><label className="field-label">Quy cách kỹ thuật</label><input className="input" value={f.spec} onChange={(e) => setF((s) => ({ ...s, spec: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={(!editing && f.code.length < 2) || f.name.length < 2 || save.isPending} onClick={() => save.mutate()}>{editing ? 'Lưu thay đổi' : 'Tạo (nháp)'}</button></div>
      </div>
    </Modal>
  );
}
