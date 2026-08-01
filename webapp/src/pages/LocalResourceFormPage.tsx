import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import {
  CATEGORY_OPTIONS, TYPE_BY_CATEGORY, TYPE_CATEGORY, RESOURCE_TYPE_LABEL,
  OWNER_OPTIONS, MOBILIZATION_OPTIONS, RELIABILITY_OPTIONS,
} from '../lib/localResource';

const EMPTY = {
  code: '', name: '', category: 'FACILITY', resourceType: 'LODGING',
  ownerName: '', ownerType: '', contactName: '', contactPhone: '', areaId: '', address: '',
  lat: '', lng: '', capacityDesc: '', capacityQty: '', capacityUnit: '',
  mobilizationTime: 'MEDIUM', reliability: 'MEDIUM',
  agreementNo: '', agreementValidUntil: '', agreementStatus: 'NONE',
  surveyedAt: '', surveyNote: '', notes: '',
};

export function LocalResourceFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['local-resource', id],
    queryFn: async () => (await api.get(`/local-resources/${id}`)).data as Record<string, unknown>,
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      const loc = d.location as { coordinates?: [number, number] } | null;
      setForm({
        code: String(d.code ?? ''), name: String(d.name ?? ''),
        category: String(d.category ?? 'FACILITY'), resourceType: String(d.resourceType ?? 'LODGING'),
        ownerName: String(d.ownerName ?? ''), ownerType: String(d.ownerType ?? ''),
        contactName: String(d.contactName ?? ''), contactPhone: String(d.contactPhone ?? ''),
        areaId: String((d.areaId as string) ?? ''), address: String(d.address ?? ''),
        lat: loc?.coordinates ? String(loc.coordinates[1]) : '', lng: loc?.coordinates ? String(loc.coordinates[0]) : '',
        capacityDesc: String(d.capacityDesc ?? ''), capacityQty: d.capacityQty != null ? String(d.capacityQty) : '', capacityUnit: String(d.capacityUnit ?? ''),
        mobilizationTime: String(d.mobilizationTime ?? 'MEDIUM'), reliability: String(d.reliability ?? 'MEDIUM'),
        agreementNo: String(d.agreementNo ?? ''), agreementValidUntil: d.agreementValidUntil ? String(d.agreementValidUntil).slice(0, 10) : '', agreementStatus: String(d.agreementStatus ?? 'NONE'),
        surveyedAt: d.surveyedAt ? String(d.surveyedAt).slice(0, 10) : '', surveyNote: String(d.surveyNote ?? ''), notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const typeOptions = useMemo(() => TYPE_BY_CATEGORY[form.category] ?? [], [form.category]);

  const save = useMutation({
    mutationFn: async () => {
      const numOrU = (v: string) => (v === '' ? undefined : Number(v));
      const hasGeo = form.lat !== '' && form.lng !== '';
      const body = {
        name: form.name.trim(), resourceType: form.resourceType,
        ownerName: form.ownerName || undefined, ownerType: form.ownerType || undefined,
        contactName: form.contactName || undefined, contactPhone: form.contactPhone || undefined,
        areaId: form.areaId || undefined, address: form.address || undefined,
        capacityDesc: form.capacityDesc || undefined, capacityQty: numOrU(form.capacityQty), capacityUnit: form.capacityUnit || undefined,
        mobilizationTime: form.mobilizationTime, reliability: form.reliability,
        agreementNo: form.agreementNo || undefined, agreementValidUntil: form.agreementValidUntil || undefined, agreementStatus: form.agreementStatus,
        surveyedAt: form.surveyedAt || undefined, surveyNote: form.surveyNote || undefined, notes: form.notes || undefined,
        location: hasGeo ? { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] } : undefined,
      };
      if (isEdit) return (await api.put(`/local-resources/${id}`, body)).data as { id: string };
      return (await api.post('/local-resources', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu nguồn lực.' : 'Đã tạo nguồn lực.'); nav(`/local-resources/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  function onCategory(e: React.ChangeEvent<HTMLSelectElement>) {
    const cat = e.target.value;
    setForm((f) => ({ ...f, category: cat, resourceType: (TYPE_BY_CATEGORY[cat] ?? [])[0] ?? '' }));
  }
  function onType(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((f) => ({ ...f, resourceType: e.target.value, category: TYPE_CATEGORY[e.target.value] ?? f.category }));
  }

  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3) && !!form.resourceType;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/local-resources/${id}` : '/local-resources')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Nguồn lực' : 'Danh sách nguồn lực'}
      </button>
      <PageHeader eyebrow="Nguồn lực & bảo đảm" title={isEdit ? 'Cập nhật nguồn lực' : 'Thêm nguồn lực huy động'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Section title="Thông tin nguồn lực">
          <Grid>
            <Field label="Mã *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: NL-001" /></Field>
            <Field label="Tên nguồn lực *" wide><input className="input" value={form.name} onChange={set('name')} /></Field>
            <Field label="Nhóm"><select className="input" value={form.category} onChange={onCategory}>{CATEGORY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Loại"><select className="input" value={form.resourceType} onChange={onType}>{typeOptions.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>)}</select></Field>
            <Field label="Địa bàn (xã/phường)"><AsyncPicker endpoint="/administrative-areas" value={form.areaId} onChange={(v) => setForm((f) => ({ ...f, areaId: v }))} placeholder="Tìm xã/phường…" /></Field>
            <Field label="Địa chỉ" wide><input className="input" value={form.address} onChange={set('address')} /></Field>
          </Grid>
        </Section>

        <Section title="Chủ thể & liên hệ">
          <Grid>
            <Field label="Chủ thể quản lý"><input className="input" value={form.ownerName} onChange={set('ownerName')} /></Field>
            <Field label="Loại chủ thể"><select className="input" value={form.ownerType} onChange={set('ownerType')}><option value="">—</option>{OWNER_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Người liên hệ"><input className="input" value={form.contactName} onChange={set('contactName')} /></Field>
            <Field label="Điện thoại"><input className="input num" value={form.contactPhone} onChange={set('contactPhone')} /></Field>
          </Grid>
        </Section>

        <Section title="Khả năng cung ứng & huy động">
          <Grid>
            <Field label="Số lượng có thể huy động"><input className="input num" type="number" min={0} value={form.capacityQty} onChange={set('capacityQty')} /></Field>
            <Field label="Đơn vị"><input className="input" value={form.capacityUnit} onChange={set('capacityUnit')} placeholder="người / m2 / tấn…" /></Field>
            <Field label="Mô tả năng lực" wide><input className="input" value={form.capacityDesc} onChange={set('capacityDesc')} /></Field>
            <Field label="Thời gian huy động"><select className="input" value={form.mobilizationTime} onChange={set('mobilizationTime')}>{MOBILIZATION_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Độ tin cậy"><select className="input" value={form.reliability} onChange={set('reliability')}>{RELIABILITY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
            <Field label="Vĩ độ (lat)"><input className="input num" value={form.lat} onChange={set('lat')} placeholder="VD: 19.807" /></Field>
            <Field label="Kinh độ (lng)"><input className="input num" value={form.lng} onChange={set('lng')} placeholder="VD: 105.777" /></Field>
          </Grid>
        </Section>

        <Section title="Hiệp đồng & khảo sát">
          <Grid>
            <Field label="Trạng thái hiệp đồng"><select className="input" value={form.agreementStatus} onChange={set('agreementStatus')}><option value="NONE">Chưa có</option><option value="SIGNED">Đã ký</option><option value="EXPIRED">Hết hiệu lực</option></select></Field>
            <Field label="Số biên bản hiệp đồng"><input className="input num" value={form.agreementNo} onChange={set('agreementNo')} /></Field>
            <Field label="Hạn hiệu lực"><input className="input" type="date" value={form.agreementValidUntil} onChange={set('agreementValidUntil')} /></Field>
            <Field label="Ngày khảo sát"><input className="input" type="date" value={form.surveyedAt} onChange={set('surveyedAt')} /></Field>
            <Field label="Ghi chú khảo sát" wide><input className="input" value={form.surveyNote} onChange={set('surveyNote')} /></Field>
            <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
          </Grid>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/local-resources/${id}` : '/local-resources')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo nguồn lực'}</button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>{children}</div>);
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      {children}
    </label>
  );
}
