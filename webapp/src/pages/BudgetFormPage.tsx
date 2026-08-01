import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { FUNDING_LABEL } from '../lib/budget';

const EMPTY = { code: '', name: '', fiscalYear: String(new Date().getFullYear()), fundingSource: 'DEFENSE_BUDGET', plannedAmount: '', notes: '' };

export function BudgetFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ['budget', id], queryFn: async () => (await api.get(`/budgets/${id}`)).data as Record<string, unknown>, enabled: isEdit });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), name: String(d.name ?? ''), fiscalYear: String(d.fiscalYear ?? new Date().getFullYear()),
        fundingSource: String(d.fundingSource ?? 'DEFENSE_BUDGET'), plannedAmount: d.plannedAmount != null ? String(d.plannedAmount) : '', notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(), fiscalYear: Number(form.fiscalYear), fundingSource: form.fundingSource || undefined,
        plannedAmount: form.plannedAmount ? Number(form.plannedAmount) : undefined, notes: form.notes || undefined,
      };
      if (isEdit) return (await api.put(`/budgets/${id}`, body)).data as { id: string };
      return (await api.post('/budgets', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu dự toán.' : 'Đã tạo dự toán (dự thảo).'); nav(`/budgets/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isEdit && existing.isLoading) return <Skeleton rows={6} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3) && Number(form.fiscalYear) >= 2000;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/budgets/${id}` : '/budgets')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Dự toán' : 'Danh sách dự toán'}
      </button>
      <PageHeader eyebrow="Tài chính doanh trại" title={isEdit ? 'Cập nhật dự toán' : 'Tạo dự toán ngân sách'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Mã dự toán *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: NS-2026-QP" /></Field>
        <Field label="Tên dự toán *" wide><input className="input" value={form.name} onChange={set('name')} /></Field>
        <Field label="Niên độ *"><input className="input num" type="number" min={2000} value={form.fiscalYear} onChange={set('fiscalYear')} /></Field>
        <Field label="Nguồn vốn"><select className="input" value={form.fundingSource} onChange={set('fundingSource')}>{Object.entries(FUNDING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Tổng dự toán (VND)"><input className="input num" type="number" min={0} value={form.plannedAmount} onChange={set('plannedAmount')} /></Field>
        <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/budgets/${id}` : '/budgets')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo dự toán'}</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
