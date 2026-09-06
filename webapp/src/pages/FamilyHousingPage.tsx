import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';

// Biểu 01/KK-KGĐ — Khu gia đình quân đội đang quản lý, chưa bàn giao địa phương.
interface Row {
  id: string; code: string; name: string; address: string | null;
  totalArea: number; householdCount: number; plannedHandover: string | null; workflowStatus: string;
}
interface Detail extends Row {
  legalDoc: string | null; notHandedReason: string | null; note: string | null;
}

const WF_LABEL: Record<string, string> = { DRAFT: 'Nháp', PENDING_REVIEW: 'Chờ duyệt', CHANGES_REQUESTED: 'Yêu cầu bổ sung', APPROVED: 'Đã duyệt' };
const WF_COLOR: Record<string, string> = { DRAFT: 'var(--color-neutral-500)', PENDING_REVIEW: 'var(--warn-fg)', CHANGES_REQUESTED: 'var(--danger-fg)', APPROVED: 'var(--ok-fg)' };

const EMPTY = { code: '', name: '', address: '', totalArea: '', householdCount: '', legalDoc: '', notHandedReason: '', plannedHandover: '', note: '' };
type FormState = typeof EMPTY;

export function FamilyHousingPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id?: string; form: FormState } | null>(null);
  const size = 15;

  const q = useQuery({
    queryKey: ['family-housing', page, search],
    queryFn: async () => (await api.get('/family-housing', { params: { page, size, search: search || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: async (payload: { id?: string; form: FormState }) => {
      const body = {
        code: payload.form.code.trim(),
        name: payload.form.name.trim(),
        address: payload.form.address.trim() || undefined,
        totalArea: payload.form.totalArea ? Number(payload.form.totalArea) : undefined,
        householdCount: payload.form.householdCount ? Number(payload.form.householdCount) : undefined,
        legalDoc: payload.form.legalDoc.trim() || undefined,
        notHandedReason: payload.form.notHandedReason.trim() || undefined,
        plannedHandover: payload.form.plannedHandover.trim() || undefined,
        note: payload.form.note.trim() || undefined,
      };
      return payload.id ? api.put(`/family-housing/${payload.id}`, body) : api.post('/family-housing', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-housing'] }); setEditing(null); toast.success('Đã lưu khu gia đình.'); },
    onError: (e) => toast.problem(e, 'Lưu thất bại'),
  });

  const submit = useMutation({
    mutationFn: async (id: string) => api.post(`/family-housing/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-housing'] }); toast.success('Đã gửi duyệt.'); },
    onError: (e) => toast.problem(e, 'Gửi duyệt thất bại'),
  });

  const openEdit = async (id: string) => {
    try {
      const d = (await api.get(`/family-housing/${id}`)).data as Detail;
      setEditing({ id, form: {
        code: d.code, name: d.name, address: d.address ?? '',
        totalArea: String(d.totalArea ?? ''), householdCount: String(d.householdCount ?? ''),
        legalDoc: d.legalDoc ?? '', notHandedReason: d.notHandedReason ?? '', plannedHandover: d.plannedHandover ?? '', note: d.note ?? '',
      } });
    } catch (e) { toast.problem(e, 'Không mở được hồ sơ'); }
  };

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 110 },
    { key: 'name', header: 'Khu gia đình', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div>{r.address && <div className="muted" style={{ fontSize: 11 }}>{r.address}</div>}</div> },
    { key: 'area', header: 'Diện tích (m²)', render: (r) => <span className="num">{num(r.totalArea)}</span>, align: 'right' },
    { key: 'house', header: 'Số hộ', render: (r) => <span className="num">{num(r.householdCount)}</span>, align: 'right' },
    { key: 'handover', header: 'Dự kiến bàn giao', render: (r) => r.plannedHandover ?? '—' },
    { key: 'wf', header: 'Trạng thái', render: (r) => <span style={{ color: WF_COLOR[r.workflowStatus], fontWeight: 600, fontSize: 12 }}>{WF_LABEL[r.workflowStatus] ?? r.workflowStatus}</span> },
    { key: 'act', header: '', align: 'right', render: (r) => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(r.id); }}><Icon name="edit" size={13} /> Sửa</button>
        {r.workflowStatus === 'DRAFT' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); submit.mutate(r.id); }}><Icon name="check" size={13} /> Gửi duyệt</button>}
      </div>
    ) },
  ];

  const f = editing?.form;
  const set = (k: keyof FormState, v: string) => setEditing((s) => s ? { ...s, form: { ...s.form, [k]: v } } : s);

  return (
    <>
      <PageHeader
        eyebrow="Đất quốc phòng · Biểu 01/KK-KGĐ"
        title="Khu gia đình quân đội đang quản lý"
        description="Các khu gia đình chưa bàn giao địa phương: tổng diện tích, số hộ, hồ sơ pháp lý, lý do & dự kiến bàn giao. Dữ liệu vào biểu 01/KK-KGĐ nộp Quân khu."
        actions={<button className="btn btn-primary" onClick={() => setEditing({ form: { ...EMPTY } })}><Icon name="plus" size={16} /> Thêm khu gia đình</button>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, tên khu…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => openEdit(r.id)} emptyTitle="Chưa có khu gia đình" emptyHint="Bấm 'Thêm khu gia đình' để khai báo." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {editing && f && (
        <Modal open title={editing.id ? 'Sửa khu gia đình' : 'Thêm khu gia đình'} onClose={() => setEditing(null)} width={620}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Mã *"><input className="input" value={f.code} disabled={!!editing.id} onChange={(e) => set('code', e.target.value)} /></Field>
            <Field label="Tên khu gia đình *"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Địa chỉ (xã, huyện, tỉnh)" span><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Tổng diện tích (m²)"><input className="input num" type="number" min={0} value={f.totalArea} onChange={(e) => set('totalArea', e.target.value)} /></Field>
            <Field label="Số hộ gia đình"><input className="input num" type="number" min={0} value={f.householdCount} onChange={(e) => set('householdCount', e.target.value)} /></Field>
            <Field label="Hồ sơ pháp lý hình thành" span><input className="input" value={f.legalDoc} onChange={(e) => set('legalDoc', e.target.value)} placeholder="Văn bản số... ngày.../của..." /></Field>
            <Field label="Lý do chưa bàn giao địa phương" span><textarea className="input" rows={2} value={f.notHandedReason} onChange={(e) => set('notHandedReason', e.target.value)} /></Field>
            <Field label="Dự kiến thời gian bàn giao"><input className="input" value={f.plannedHandover} onChange={(e) => set('plannedHandover', e.target.value)} placeholder="Quý IV/2027" /></Field>
            <Field label="Ghi chú"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
          </div>
          {editing && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={() => setEditing(null)}>Hủy</button>
              <button className="btn btn-primary" disabled={!f.code.trim() || !f.name.trim() || save.isPending} onClick={() => save.mutate(editing)}>
                <Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          )}
          {save.isError && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginTop: 8 }}>{toProblem(save.error).title}</div>}
        </Modal>
      )}
    </>
  );
}

function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
