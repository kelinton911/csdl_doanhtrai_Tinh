import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { TYPE_OPTIONS } from '../lib/oversight';

const EMPTY = {
  code: '', title: '', inspectionType: 'PERIODIC', scope: '',
  targetOrgId: '', targetAreaId: '', targetBarracksId: '', leadName: '', teamNote: '', plannedDate: '',
};

export function InspectionFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ['inspection', id], queryFn: async () => (await api.get(`/inspections/${id}`)).data as Record<string, unknown>, enabled: isEdit });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), title: String(d.title ?? ''), inspectionType: String(d.inspectionType ?? 'PERIODIC'),
        scope: String(d.scope ?? ''), targetOrgId: String((d.targetOrgId as string) ?? ''), targetAreaId: String((d.targetAreaId as string) ?? ''),
        targetBarracksId: String((d.targetBarracksId as string) ?? ''), leadName: String(d.leadName ?? ''),
        teamNote: String(d.teamNote ?? ''), plannedDate: d.plannedDate ? String(d.plannedDate).slice(0, 10) : '',
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(), inspectionType: form.inspectionType, scope: form.scope || undefined,
        targetOrgId: form.targetOrgId || undefined, targetAreaId: form.targetAreaId || undefined, targetBarracksId: form.targetBarracksId || undefined,
        leadName: form.leadName || undefined, teamNote: form.teamNote || undefined, plannedDate: form.plannedDate || undefined,
      };
      if (isEdit) return (await api.put(`/inspections/${id}`, body)).data as { id: string };
      return (await api.post('/inspections', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu cuộc kiểm tra.' : 'Đã lập cuộc kiểm tra.'); nav(`/audits/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isEdit && existing.isLoading) return <Skeleton rows={7} />;
  const canSave = form.title.trim().length >= 3 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/audits/${id}` : '/audits')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Cuộc kiểm tra' : 'Danh sách kiểm tra'}
      </button>
      <PageHeader eyebrow="Kiểm tra & thanh tra" title={isEdit ? 'Cập nhật cuộc kiểm tra' : 'Lập cuộc kiểm tra / thanh tra'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Mã *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: KT-2026-001" /></Field>
        <Field label="Tên cuộc kiểm tra *" wide><input className="input" value={form.title} onChange={set('title')} /></Field>
        <Field label="Loại"><select className="input" value={form.inspectionType} onChange={set('inspectionType')}>{TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Ngày kế hoạch"><input className="input" type="date" value={form.plannedDate} onChange={set('plannedDate')} /></Field>
        <Field label="Đối tượng: đơn vị"><AsyncPicker endpoint="/organizations" value={form.targetOrgId} onChange={(v) => setForm((f) => ({ ...f, targetOrgId: v }))} placeholder="Tìm đơn vị…" /></Field>
        <Field label="Đối tượng: địa bàn"><AsyncPicker endpoint="/administrative-areas" value={form.targetAreaId} onChange={(v) => setForm((f) => ({ ...f, targetAreaId: v }))} placeholder="Tìm xã/phường…" /></Field>
        <Field label="Đối tượng: doanh trại"><AsyncPicker endpoint="/barracks" value={form.targetBarracksId} onChange={(v) => setForm((f) => ({ ...f, targetBarracksId: v }))} placeholder="Tìm doanh trại…" /></Field>
        <Field label="Trưởng đoàn"><input className="input" value={form.leadName} onChange={set('leadName')} /></Field>
        <Field label="Nội dung/phạm vi kiểm tra" wide><textarea className="input" rows={2} value={form.scope} onChange={set('scope')} /></Field>
        <Field label="Thành phần đoàn" wide><textarea className="input" rows={2} value={form.teamNote} onChange={set('teamNote')} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/audits/${id}` : '/audits')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Lập cuộc kiểm tra'}</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
