import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { dateTime } from '../lib/format';

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
  const [versionsOf, setVersionsOf] = useState<Material | null>(null);
  const size = 15;
  const cat = useCatalog('material-category');
  const unit = useCatalog('unit-of-measure');

  const q = useQuery({
    queryKey: ['materials', page, search, category],
    queryFn: async () => (await api.get('/materials', { params: { page, size, search: search || undefined, category: category || undefined } })).data as { data: Material[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });
  const publish = useMutation({ mutationFn: async (id: string) => api.post(`/materials/${id}/publish`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['materials'] }); toast.success('Đã phát hành vật chất.'); }, onError: (e) => toast.problem(e, 'Không phát hành được') });

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
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setVersionsOf(m); }} title="Lịch sử phiên bản"><Icon name="clock" size={14} /></button>
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
      {versionsOf && <VersionsModal material={versionsOf} onClose={() => setVersionsOf(null)} />}
    </>
  );
}

interface VersionRow { id: string; version: number; changeType: string; snapshot: Record<string, unknown>; createdAt: string }
const FIELD_LABEL: Record<string, string> = { code: 'Mã', name: 'Tên', categoryCode: 'Nhóm', unitCode: 'ĐVT', spec: 'Quy cách', qualityGrade: 'Cấp CL', status: 'Trạng thái' };
const CHANGE_LABEL: Record<string, string> = { CREATE: 'Tạo mới', UPDATE: 'Chỉnh sửa', PUBLISH: 'Phát hành' };

// Lịch sử phiên bản + diff trường giữa các lần thay đổi (BE-5: GET /materials/:id/versions).
function VersionsModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['material-versions', material.id],
    queryFn: async () => (await api.get(`/materials/${material.id}/versions`)).data as VersionRow[],
  });
  const rows = q.data ?? [];
  return (
    <Modal open title={`Lịch sử phiên bản · ${material.code}`} onClose={onClose} width={620}>
      {q.isLoading ? <Skeleton rows={4} /> : q.isError ? <ErrorState error={q.error} /> : rows.length === 0 ? (
        <EmptyState icon="clock" title="Chưa có lịch sử" hint="Lịch sử được ghi khi tạo, sửa hoặc phát hành vật chất." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map((v, i) => {
            const prev = rows[i + 1]?.snapshot; // rows sắp xếp version giảm dần → phần tử sau là cũ hơn
            const changed = prev
              ? Object.keys(FIELD_LABEL).filter((k) => String(v.snapshot[k] ?? '') !== String(prev[k] ?? ''))
              : Object.keys(FIELD_LABEL).filter((k) => v.snapshot[k] != null && v.snapshot[k] !== '');
            return (
              <div key={v.id} style={{ display: 'flex', gap: 14, paddingBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-accent-600)', marginTop: 4 }} />
                  {i < rows.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--color-neutral-300)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="num" style={{ fontWeight: 700 }}>v{v.version}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-700)' }}>{CHANGE_LABEL[v.changeType] ?? v.changeType}</span>
                    <span className="muted num" style={{ fontSize: 11 }}>{dateTime(v.createdAt)}</span>
                  </div>
                  {changed.length === 0 ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Không thay đổi trường dữ liệu.</div>
                  ) : (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {changed.map((k) => (
                        <div key={k} style={{ fontSize: 12.5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className="muted" style={{ minWidth: 70 }}>{FIELD_LABEL[k]}:</span>
                          {prev && <><span style={{ color: 'var(--danger-fg)', textDecoration: 'line-through' }}>{String(prev[k] ?? '—')}</span><Icon name="chevron" size={12} /></>}
                          <span style={{ color: 'var(--ok-fg)', fontWeight: 600 }}>{String(v.snapshot[k] ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
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
    onSuccess: () => { toast.success(editing ? 'Đã lưu vật chất.' : 'Đã tạo vật chất (nháp).'); onDone(); },
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
