import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { DOC_TYPE_OPTIONS, STATUS_OPTIONS, FIELD_OPTIONS, CONFIDENTIALITY_OPTIONS } from '../lib/legalDoc';

const EMPTY = {
  code: '', docNumber: '', title: '', docType: 'CIRCULAR', issuingBody: '',
  issuedDate: '', effectiveDate: '', expiryDate: '', effectiveStatus: 'EFFECTIVE', field: 'DOANH_TRAI',
  confidentiality: 'INTERNAL', summary: '', keywords: '', supersedesId: '', sourceUrl: '', notes: '',
};
const iso = (v: unknown) => (v ? String(v).slice(0, 10) : '');

export function LegalDocFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ['legal-document', id], queryFn: async () => (await api.get(`/legal-documents/${id}`)).data as Record<string, unknown>, enabled: isEdit });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), docNumber: String(d.docNumber ?? ''), title: String(d.title ?? ''),
        docType: String(d.docType ?? 'CIRCULAR'), issuingBody: String(d.issuingBody ?? ''),
        issuedDate: iso(d.issuedDate), effectiveDate: iso(d.effectiveDate), expiryDate: iso(d.expiryDate),
        effectiveStatus: String(d.effectiveStatus ?? 'EFFECTIVE'), field: String(d.field ?? 'DOANH_TRAI'),
        confidentiality: String(d.confidentiality ?? 'INTERNAL'), summary: String(d.summary ?? ''), keywords: String(d.keywords ?? ''),
        supersedesId: String((d.supersedesId as string) ?? ''), sourceUrl: String(d.sourceUrl ?? ''), notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        docNumber: form.docNumber.trim(), title: form.title.trim(), docType: form.docType, issuingBody: form.issuingBody || undefined,
        issuedDate: form.issuedDate || undefined, effectiveDate: form.effectiveDate || undefined, expiryDate: form.expiryDate || undefined,
        effectiveStatus: form.effectiveStatus, field: form.field, confidentiality: form.confidentiality,
        summary: form.summary || undefined, keywords: form.keywords || undefined, supersedesId: form.supersedesId || undefined,
        sourceUrl: form.sourceUrl || undefined, notes: form.notes || undefined,
      };
      if (isEdit) return (await api.put(`/legal-documents/${id}`, body)).data as { id: string };
      return (await api.post('/legal-documents', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu văn bản.' : 'Đã thêm văn bản.'); nav(`/legal-documents/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = form.title.trim().length >= 3 && form.docNumber.trim().length >= 1 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/legal-documents/${id}` : '/legal-documents')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Văn bản' : 'Danh sách văn bản'}
      </button>
      <PageHeader eyebrow="Văn bản & định mức" title={isEdit ? 'Cập nhật văn bản' : 'Thêm văn bản pháp quy'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Mã nội bộ *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: VB-2837-DT" /></Field>
        <Field label="Số/ký hiệu *"><input className="input num" value={form.docNumber} onChange={set('docNumber')} placeholder="VD: 15/2023/TT-BQP" /></Field>
        <Field label="Loại"><select className="input" value={form.docType} onChange={set('docType')}>{DOC_TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Trích yếu / tên văn bản *" wide><input className="input" value={form.title} onChange={set('title')} /></Field>
        <Field label="Cơ quan ban hành"><input className="input" value={form.issuingBody} onChange={set('issuingBody')} /></Field>
        <Field label="Lĩnh vực"><select className="input" value={form.field} onChange={set('field')}>{FIELD_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Độ mật"><select className="input" value={form.confidentiality} onChange={set('confidentiality')}>{CONFIDENTIALITY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Ngày ban hành"><input className="input" type="date" value={form.issuedDate} onChange={set('issuedDate')} /></Field>
        <Field label="Ngày hiệu lực"><input className="input" type="date" value={form.effectiveDate} onChange={set('effectiveDate')} /></Field>
        <Field label="Ngày hết hiệu lực"><input className="input" type="date" value={form.expiryDate} onChange={set('expiryDate')} /></Field>
        <Field label="Tình trạng hiệu lực"><select className="input" value={form.effectiveStatus} onChange={set('effectiveStatus')}>{STATUS_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Thay thế văn bản"><AsyncPicker endpoint="/legal-documents" value={form.supersedesId} onChange={(v) => setForm((f) => ({ ...f, supersedesId: v }))} placeholder="Tìm văn bản bị thay thế…" /></Field>
        <Field label="Từ khóa" wide><input className="input" value={form.keywords} onChange={set('keywords')} placeholder="phân tách bằng dấu phẩy" /></Field>
        <Field label="Tóm tắt nội dung" wide><textarea className="input" rows={3} value={form.summary} onChange={set('summary')} /></Field>
        <Field label="Nguồn (URL)" wide><input className="input" value={form.sourceUrl} onChange={set('sourceUrl')} /></Field>
        <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/legal-documents/${id}` : '/legal-documents')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm văn bản'}</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
