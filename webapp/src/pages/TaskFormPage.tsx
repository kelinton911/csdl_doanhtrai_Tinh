import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '../lib/task';

const EMPTY = {
  code: '', title: '', description: '', category: 'OTHER', priority: 'NORMAL',
  assigneeOrgId: '', assigneeAreaId: '', dueDate: '', targetValue: '', targetUnit: '', parentTaskId: '',
};

export function TaskFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY, parentTaskId: sp.get('parent') ?? '' });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ['task', id], queryFn: async () => (await api.get(`/tasks/${id}`)).data as Record<string, unknown>, enabled: isEdit });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), title: String(d.title ?? ''), description: String(d.description ?? ''),
        category: String(d.category ?? 'OTHER'), priority: String(d.priority ?? 'NORMAL'),
        assigneeOrgId: String((d.assigneeOrgId as string) ?? ''), assigneeAreaId: String((d.assigneeAreaId as string) ?? ''),
        dueDate: d.dueDate ? String(d.dueDate).slice(0, 10) : '',
        targetValue: d.targetValue != null ? String(d.targetValue) : '', targetUnit: String(d.targetUnit ?? ''),
        parentTaskId: String((d.parentTaskId as string) ?? ''),
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(), description: form.description || undefined, category: form.category, priority: form.priority,
        assigneeOrgId: form.assigneeOrgId || undefined, assigneeAreaId: form.assigneeAreaId || undefined,
        dueDate: form.dueDate || undefined,
        targetValue: form.targetValue ? Number(form.targetValue) : undefined, targetUnit: form.targetUnit || undefined,
        parentTaskId: form.parentTaskId || undefined,
      };
      if (isEdit) return (await api.put(`/tasks/${id}`, body)).data as { id: string };
      return (await api.post('/tasks', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu nhiệm vụ.' : 'Đã giao nhiệm vụ.'); nav(`/tasks/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isEdit && existing.isLoading) return <Skeleton rows={7} />;
  const canSave = form.title.trim().length >= 3 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/tasks/${id}` : '/tasks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Nhiệm vụ' : 'Danh sách nhiệm vụ'}
      </button>
      <PageHeader eyebrow="Tham mưu & điều hành" title={isEdit ? 'Cập nhật nhiệm vụ' : 'Giao nhiệm vụ / lập kế hoạch'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Mã *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: NV-2026-001" /></Field>
        <Field label="Tiêu đề *" wide><input className="input" value={form.title} onChange={set('title')} /></Field>
        <Field label="Loại"><select className="input" value={form.category} onChange={set('category')}>{CATEGORY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Mức ưu tiên"><select className="input" value={form.priority} onChange={set('priority')}>{PRIORITY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Hạn hoàn thành"><input className="input" type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Giao cho đơn vị"><AsyncPicker endpoint="/organizations" value={form.assigneeOrgId} onChange={(v) => setForm((f) => ({ ...f, assigneeOrgId: v }))} placeholder="Tìm đơn vị…" /></Field>
        <Field label="Giao cho địa bàn (xã)"><AsyncPicker endpoint="/administrative-areas" value={form.assigneeAreaId} onChange={(v) => setForm((f) => ({ ...f, assigneeAreaId: v }))} placeholder="Tìm xã/phường…" /></Field>
        <Field label="Thuộc kế hoạch (nhiệm vụ cha)"><AsyncPicker endpoint="/tasks" value={form.parentTaskId} onChange={(v) => setForm((f) => ({ ...f, parentTaskId: v }))} placeholder="Tìm kế hoạch/nhiệm vụ…" /></Field>
        <Field label="Chỉ tiêu (số lượng)"><input className="input num" type="number" value={form.targetValue} onChange={set('targetValue')} /></Field>
        <Field label="Đơn vị chỉ tiêu"><input className="input" value={form.targetUnit} onChange={set('targetUnit')} placeholder="hồ sơ / công trình / %" /></Field>
        <Field label="Mô tả / nội dung yêu cầu" wide><textarea className="input" rows={3} value={form.description} onChange={set('description')} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/tasks/${id}` : '/tasks')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Giao nhiệm vụ'}</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
