import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { PROJECT_TYPE_OPTIONS, FUNDING_OPTIONS } from '../lib/project';

const EMPTY = {
  code: '', name: '', projectType: 'RENOVATION', barracksId: '', areaId: '', fundingSource: 'DEFENSE_BUDGET',
  totalEstimate: '', approvedCapital: '', contractorName: '', contractNo: '', contractValue: '', contractSignedDate: '',
  startDate: '', plannedEndDate: '', description: '', notes: '',
};
const isoDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');

export function ProjectFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['project', id],
    queryFn: async () => (await api.get(`/projects/${id}`)).data as Record<string, unknown>,
    enabled: isEdit,
  });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), name: String(d.name ?? ''), projectType: String(d.projectType ?? 'RENOVATION'),
        barracksId: String((d.barracksId as string) ?? ''), areaId: String((d.areaId as string) ?? ''),
        fundingSource: String(d.fundingSource ?? 'DEFENSE_BUDGET'),
        totalEstimate: d.totalEstimate != null ? String(d.totalEstimate) : '', approvedCapital: d.approvedCapital != null ? String(d.approvedCapital) : '',
        contractorName: String(d.contractorName ?? ''), contractNo: String(d.contractNo ?? ''),
        contractValue: d.contractValue != null ? String(d.contractValue) : '', contractSignedDate: isoDate(d.contractSignedDate),
        startDate: isoDate(d.startDate), plannedEndDate: isoDate(d.plannedEndDate),
        description: String(d.description ?? ''), notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const numOrU = (v: string) => (v === '' ? undefined : Number(v));
      const body = {
        name: form.name.trim(), projectType: form.projectType, barracksId: form.barracksId || undefined,
        areaId: form.areaId || undefined, fundingSource: form.fundingSource || undefined,
        totalEstimate: numOrU(form.totalEstimate), approvedCapital: numOrU(form.approvedCapital),
        contractorName: form.contractorName || undefined, contractNo: form.contractNo || undefined,
        contractValue: numOrU(form.contractValue), contractSignedDate: form.contractSignedDate || undefined,
        startDate: form.startDate || undefined, plannedEndDate: form.plannedEndDate || undefined,
        description: form.description || undefined, notes: form.notes || undefined,
      };
      if (isEdit) return (await api.put(`/projects/${id}`, body)).data as { id: string };
      return (await api.post('/projects', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu dự án.' : 'Đã tạo dự án (chủ trương).'); nav(`/projects/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/projects/${id}` : '/projects')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Dự án' : 'Danh sách dự án'}
      </button>
      <PageHeader eyebrow="Đầu tư & xây dựng" title={isEdit ? 'Cập nhật dự án' : 'Tạo dự án đầu tư/XDCB'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Section title="Thông tin dự án">
          <Grid>
            <Field label="Mã dự án *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: DA-2026-001" /></Field>
            <Field label="Tên dự án *" wide><input className="input" value={form.name} onChange={set('name')} /></Field>
            <Field label="Loại dự án"><select className="input" value={form.projectType} onChange={set('projectType')}>{PROJECT_TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Nguồn vốn"><select className="input" value={form.fundingSource} onChange={set('fundingSource')}>{FUNDING_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Doanh trại"><AsyncPicker endpoint="/barracks" value={form.barracksId} onChange={(v) => setForm((f) => ({ ...f, barracksId: v }))} placeholder="Tìm doanh trại…" /></Field>
            <Field label="Địa bàn"><AsyncPicker endpoint="/administrative-areas" value={form.areaId} onChange={(v) => setForm((f) => ({ ...f, areaId: v }))} placeholder="Tìm xã/phường…" /></Field>
            <Field label="Mô tả" wide><textarea className="input" rows={2} value={form.description} onChange={set('description')} /></Field>
          </Grid>
        </Section>

        <Section title="Dự toán & vốn">
          <Grid>
            <Field label="Tổng dự toán (VND)"><input className="input num" type="number" min={0} value={form.totalEstimate} onChange={set('totalEstimate')} /></Field>
            <Field label="Vốn được duyệt (VND)"><input className="input num" type="number" min={0} value={form.approvedCapital} onChange={set('approvedCapital')} /></Field>
            <Field label="Bắt đầu"><input className="input" type="date" value={form.startDate} onChange={set('startDate')} /></Field>
            <Field label="Hạn hoàn thành (kế hoạch)"><input className="input" type="date" value={form.plannedEndDate} onChange={set('plannedEndDate')} /></Field>
          </Grid>
        </Section>

        <Section title="Nhà thầu & hợp đồng">
          <Grid>
            <Field label="Nhà thầu"><input className="input" value={form.contractorName} onChange={set('contractorName')} /></Field>
            <Field label="Số hợp đồng"><input className="input num" value={form.contractNo} onChange={set('contractNo')} /></Field>
            <Field label="Giá trị hợp đồng (VND)"><input className="input num" type="number" min={0} value={form.contractValue} onChange={set('contractValue')} /></Field>
            <Field label="Ngày ký hợp đồng"><input className="input" type="date" value={form.contractSignedDate} onChange={set('contractSignedDate')} /></Field>
            <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
          </Grid>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/projects/${id}` : '/projects')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo dự án'}</button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return (<div><div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>{children}</div>); }
function Grid({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>{children}</div>; }
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
