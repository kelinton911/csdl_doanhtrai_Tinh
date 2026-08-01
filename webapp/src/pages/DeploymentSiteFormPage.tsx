import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import { SITE_TYPE_OPTIONS, READINESS_OPTIONS, ROLE_OPTIONS, CONCEALMENT_OPTIONS, DEFENSE_STATE_OPTIONS } from '../lib/readiness';

const EMPTY = {
  code: '', name: '', siteType: 'EVACUATION', areaId: '', address: '', lat: '', lng: '',
  capacity: '', concealment: 'GOOD', accessRoad: '', hasPower: false, hasWater: false,
  tentCapability: '', deployTimeHours: '', readiness: 'PARTIAL', role: 'PRIMARY', defenseState: 'SSCD', notes: '',
};

export function DeploymentSiteFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ['deployment-site', id], queryFn: async () => (await api.get(`/readiness/sites/${id}`)).data as Record<string, unknown>, enabled: isEdit });
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      const loc = d.location as { coordinates?: [number, number] } | null;
      setForm({
        code: String(d.code ?? ''), name: String(d.name ?? ''), siteType: String(d.siteType ?? 'EVACUATION'),
        areaId: String((d.areaId as string) ?? ''), address: String(d.address ?? ''),
        lat: loc?.coordinates ? String(loc.coordinates[1]) : '', lng: loc?.coordinates ? String(loc.coordinates[0]) : '',
        capacity: d.capacity != null ? String(d.capacity) : '', concealment: String(d.concealment ?? 'GOOD'),
        accessRoad: String(d.accessRoad ?? ''), hasPower: !!d.hasPower, hasWater: !!d.hasWater,
        tentCapability: d.tentCapability != null ? String(d.tentCapability) : '', deployTimeHours: d.deployTimeHours != null ? String(d.deployTimeHours) : '',
        readiness: String(d.readiness ?? 'PARTIAL'), role: String(d.role ?? 'PRIMARY'), defenseState: String(d.defenseState ?? 'SSCD'), notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const numOrU = (v: string) => (v === '' ? undefined : Number(v));
      const hasGeo = form.lat !== '' && form.lng !== '';
      const body = {
        name: form.name.trim(), siteType: form.siteType, areaId: form.areaId || undefined, address: form.address || undefined,
        capacity: numOrU(form.capacity), concealment: form.concealment || undefined, accessRoad: form.accessRoad || undefined,
        hasPower: form.hasPower, hasWater: form.hasWater, tentCapability: numOrU(form.tentCapability), deployTimeHours: numOrU(form.deployTimeHours),
        readiness: form.readiness, role: form.role, defenseState: form.defenseState, notes: form.notes || undefined,
        location: hasGeo ? { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] } : undefined,
      };
      if (isEdit) return (await api.put(`/readiness/sites/${id}`, body)).data as { id: string };
      return (await api.post('/readiness/sites', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => { toast.success(isEdit ? 'Đã lưu địa điểm.' : 'Đã thêm địa điểm.'); nav(`/readiness/sites/${d.id ?? id}`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.checked }));
  if (isEdit && existing.isLoading) return <Skeleton rows={7} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/readiness/sites/${id}` : '/readiness/sites')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Địa điểm' : 'Danh sách địa điểm'}
      </button>
      <PageHeader eyebrow="Sẵn sàng chiến đấu" title={isEdit ? 'Cập nhật địa điểm' : 'Thêm địa điểm sơ tán/bố trí'} />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        <Field label="Mã *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: ST-001" /></Field>
        <Field label="Tên địa điểm *" wide><input className="input" value={form.name} onChange={set('name')} /></Field>
        <Field label="Loại"><select className="input" value={form.siteType} onChange={set('siteType')}>{SITE_TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Vai trò phương án"><select className="input" value={form.role} onChange={set('role')}>{ROLE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Địa bàn"><AsyncPicker endpoint="/administrative-areas" value={form.areaId} onChange={(v) => setForm((f) => ({ ...f, areaId: v }))} placeholder="Tìm xã/phường…" /></Field>
        <Field label="Địa chỉ" wide><input className="input" value={form.address} onChange={set('address')} /></Field>
        <Field label="Sức chứa (người)"><input className="input num" type="number" min={0} value={form.capacity} onChange={set('capacity')} /></Field>
        <Field label="Khả năng che giấu"><select className="input" value={form.concealment} onChange={set('concealment')}>{CONCEALMENT_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Số nhà bạt/dã chiến"><input className="input num" type="number" min={0} value={form.tentCapability} onChange={set('tentCapability')} /></Field>
        <Field label="Thời gian triển khai (giờ)"><input className="input num" type="number" min={0} value={form.deployTimeHours} onChange={set('deployTimeHours')} /></Field>
        <Field label="Mức sẵn sàng"><select className="input" value={form.readiness} onChange={set('readiness')}>{READINESS_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Trạng thái sử dụng dự kiến"><select className="input" value={form.defenseState} onChange={set('defenseState')}>{DEFENSE_STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></Field>
        <Field label="Đường cơ động"><input className="input" value={form.accessRoad} onChange={set('accessRoad')} /></Field>
        <Field label="Hạ tầng">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 38 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.hasPower} onChange={setBool('hasPower')} /> Có điện</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.hasWater} onChange={setBool('hasWater')} /> Có nước</label>
          </div>
        </Field>
        <Field label="Vĩ độ (lat)"><input className="input num" value={form.lat} onChange={set('lat')} placeholder="19.8" /></Field>
        <Field label="Kinh độ (lng)"><input className="input num" value={form.lng} onChange={set('lng')} placeholder="105.77" /></Field>
        <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/readiness/sites/${id}` : '/readiness/sites')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}><Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm địa điểm'}</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>{children}</label>);
}
