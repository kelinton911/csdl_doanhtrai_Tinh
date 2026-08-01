import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { CATEGORY_OPTIONS, KIND_BY_CATEGORY, KIND_LABEL, STATUS_OPTIONS, KIND_CATEGORY } from '../lib/utility';

const EMPTY = {
  code: '', name: '', category: 'ELECTRICITY', kind: 'TRANSFORMER', barracksId: '',
  capacity: '', capacityUnit: 'kVA', reserveVolume: '', reserveUnit: '', fuelType: '', fuelLevel: '',
  autonomyHours: '', meterNo: '', status: 'OPERATIONAL', lastMaintenanceAt: '', nextMaintenanceAt: '', notes: '',
};

const isoDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');

export function UtilityFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['utility', id],
    queryFn: async () => (await api.get(`/utilities/${id}`)).data as Record<string, unknown>,
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''), name: String(d.name ?? ''),
        category: String(d.category ?? 'ELECTRICITY'), kind: String(d.kind ?? 'TRANSFORMER'),
        barracksId: String((d.barracksId as string) ?? ''),
        capacity: d.capacity != null ? String(d.capacity) : '', capacityUnit: String(d.capacityUnit ?? ''),
        reserveVolume: d.reserveVolume != null ? String(d.reserveVolume) : '', reserveUnit: String(d.reserveUnit ?? ''),
        fuelType: String(d.fuelType ?? ''), fuelLevel: d.fuelLevel != null ? String(d.fuelLevel) : '',
        autonomyHours: d.autonomyHours != null ? String(d.autonomyHours) : '', meterNo: String(d.meterNo ?? ''),
        status: String(d.status ?? 'OPERATIONAL'),
        lastMaintenanceAt: isoDate(d.lastMaintenanceAt), nextMaintenanceAt: isoDate(d.nextMaintenanceAt),
        notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const kindOptions = useMemo(() => KIND_BY_CATEGORY[form.category] ?? [], [form.category]);
  const isElectricity = form.category === 'ELECTRICITY';
  const isGenerator = form.kind === 'GENERATOR' || form.kind === 'FUEL_TANK';

  const save = useMutation({
    mutationFn: async () => {
      const numOrU = (v: string) => (v === '' ? undefined : Number(v));
      const body = {
        name: form.name.trim(), kind: form.kind, barracksId: form.barracksId || undefined,
        capacity: numOrU(form.capacity), capacityUnit: form.capacityUnit || undefined,
        reserveVolume: numOrU(form.reserveVolume), reserveUnit: form.reserveUnit || undefined,
        fuelType: form.fuelType || undefined, fuelLevel: numOrU(form.fuelLevel),
        autonomyHours: numOrU(form.autonomyHours), meterNo: form.meterNo || undefined,
        status: form.status || undefined,
        lastMaintenanceAt: form.lastMaintenanceAt || undefined, nextMaintenanceAt: form.nextMaintenanceAt || undefined,
        notes: form.notes || undefined,
      };
      if (isEdit) return (await api.put(`/utilities/${id}`, body)).data as { id: string };
      return (await api.post('/utilities', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu hệ thống.' : 'Đã tạo hệ thống.'); nav(`/utilities/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function onCategory(e: React.ChangeEvent<HTMLSelectElement>) {
    const cat = e.target.value;
    const firstKind = (KIND_BY_CATEGORY[cat] ?? [])[0] ?? '';
    setForm((f) => ({ ...f, category: cat, kind: firstKind, capacityUnit: cat === 'ELECTRICITY' ? 'kVA' : cat === 'WATER' ? 'm3' : 'lít' }));
  }
  function onKind(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((f) => ({ ...f, kind: e.target.value, category: KIND_CATEGORY[e.target.value] ?? f.category }));
  }

  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3) && !!form.kind;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/utilities/${id}` : '/utilities')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Hệ thống' : 'Danh sách hạ tầng'}
      </button>
      <PageHeader eyebrow="Hạ tầng kỹ thuật" title={isEdit ? 'Cập nhật hệ thống' : 'Thêm hệ thống điện/nước/năng lượng'} />

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Section title="Thông tin hệ thống">
          <Grid>
            <Field label="Mã hệ thống *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: HT-DIEN-001" /></Field>
            <Field label="Tên hệ thống *" wide><input className="input" value={form.name} onChange={set('name')} placeholder="VD: Trạm biến áp 250kVA" /></Field>
            <Field label="Nhóm"><select className="input" value={form.category} onChange={onCategory}>{CATEGORY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Loại"><select className="input" value={form.kind} onChange={onKind}>{kindOptions.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
            <Field label="Gắn với doanh trại"><AsyncPicker endpoint="/barracks" value={form.barracksId} onChange={(v) => setForm((f) => ({ ...f, barracksId: v }))} placeholder="Tìm doanh trại…" /></Field>
            <Field label="Trạng thái"><select className="input" value={form.status} onChange={set('status')}>{STATUS_OPTIONS.filter((o) => o.code !== 'DECOMMISSIONED').map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
          </Grid>
        </Section>

        <Section title="Công suất & khả năng bảo đảm">
          <Grid>
            <Field label="Công suất/dung tích"><input className="input num" type="number" min={0} value={form.capacity} onChange={set('capacity')} placeholder="0" /></Field>
            <Field label="Đơn vị công suất"><input className="input" value={form.capacityUnit} onChange={set('capacityUnit')} placeholder="kVA / kW / m3 / m3/h" /></Field>
            <Field label="Số công tơ/đồng hồ"><input className="input num" value={form.meterNo} onChange={set('meterNo')} placeholder="VD: CT-001" /></Field>
            <Field label="Khả năng tự bảo đảm (giờ)"><input className="input num" type="number" min={0} value={form.autonomyHours} onChange={set('autonomyHours')} placeholder="0" /></Field>
            {!isElectricity && (
              <>
                <Field label="Lượng dự trữ"><input className="input num" type="number" min={0} value={form.reserveVolume} onChange={set('reserveVolume')} placeholder="0" /></Field>
                <Field label="Đơn vị dự trữ"><input className="input" value={form.reserveUnit} onChange={set('reserveUnit')} placeholder="m3 / lít" /></Field>
              </>
            )}
            {isGenerator && (
              <>
                <Field label="Loại nhiên liệu"><input className="input" value={form.fuelType} onChange={set('fuelType')} placeholder="DIESEL" /></Field>
                <Field label="Nhiên liệu hiện có (lít)"><input className="input num" type="number" min={0} value={form.fuelLevel} onChange={set('fuelLevel')} placeholder="0" /></Field>
              </>
            )}
          </Grid>
        </Section>

        <Section title="Bảo dưỡng & ghi chú">
          <Grid>
            <Field label="Bảo dưỡng gần nhất"><input className="input" type="date" value={form.lastMaintenanceAt} onChange={set('lastMaintenanceAt')} /></Field>
            <Field label="Hạn bảo dưỡng kế tiếp"><input className="input" type="date" value={form.nextMaintenanceAt} onChange={set('nextMaintenanceAt')} /></Field>
            <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
          </Grid>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/utilities/${id}` : '/utilities')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            <Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo hệ thống'}
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>{children}</div>);
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      {children}
    </label>
  );
}
