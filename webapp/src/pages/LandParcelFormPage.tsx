import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { AsyncPicker } from '../components/AsyncPicker';
import {
  USAGE_OPTIONS,
  LEGAL_OPTIONS,
  DISPUTE_OPTIONS,
  EXPANSION_OPTIONS,
  SAFETY_OPTIONS,
  LANDUSE_OPTIONS,
} from '../lib/landParcel';

interface Option { id: string; code: string; name: string }

const EMPTY = {
  code: '',
  name: '',
  areaId: '',
  organizationId: '',
  barracksId: '',
  address: '',
  landArea: '',
  landUseType: 'QUOC_PHONG',
  usageStatus: 'IN_USE',
  legalStatus: 'PENDING',
  legalOrigin: '',
  certificateNo: '',
  disputeStatus: 'NONE',
  disputeNote: '',
  accessRoad: '',
  hasElectricity: false,
  hasWater: false,
  expansionCapability: '',
  safetyStatus: '',
  notes: '',
};

// M04 — Tạo/cập nhật hồ sơ khu đất quốc phòng.
export function LandParcelFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['land-parcel', id],
    queryFn: async () => (await api.get(`/land-parcels/${id}`)).data as Record<string, unknown>,
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''),
        name: String(d.name ?? ''),
        areaId: String((d.areaId as string) ?? ''),
        organizationId: String((d.organizationId as string) ?? ''),
        barracksId: String((d.barracksId as string) ?? ''),
        address: String(d.address ?? ''),
        landArea: d.landArea != null ? String(d.landArea) : '',
        landUseType: String(d.landUseType ?? 'QUOC_PHONG'),
        usageStatus: String(d.usageStatus ?? 'IN_USE'),
        legalStatus: String(d.legalStatus ?? 'PENDING'),
        legalOrigin: String(d.legalOrigin ?? ''),
        certificateNo: String(d.certificateNo ?? ''),
        disputeStatus: String(d.disputeStatus ?? 'NONE'),
        disputeNote: String(d.disputeNote ?? ''),
        accessRoad: String(d.accessRoad ?? ''),
        hasElectricity: !!d.hasElectricity,
        hasWater: !!d.hasWater,
        expansionCapability: String(d.expansionCapability ?? ''),
        safetyStatus: String(d.safetyStatus ?? ''),
        notes: String(d.notes ?? ''),
      });
    }
  }, [existing.data]);

  const orgs = useQuery({
    queryKey: ['orgs'],
    queryFn: async () => (await api.get('/organizations', { params: { size: 200 } })).data as { data: Option[] },
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        areaId: form.areaId || undefined,
        organizationId: form.organizationId || undefined,
        barracksId: form.barracksId || undefined,
        address: form.address || undefined,
        landArea: form.landArea ? Number(form.landArea) : undefined,
        landUseType: form.landUseType || undefined,
        usageStatus: form.usageStatus || undefined,
        legalStatus: form.legalStatus || undefined,
        legalOrigin: form.legalOrigin || undefined,
        certificateNo: form.certificateNo || undefined,
        disputeStatus: form.disputeStatus || undefined,
        disputeNote: form.disputeNote || undefined,
        accessRoad: form.accessRoad || undefined,
        hasElectricity: form.hasElectricity,
        hasWater: form.hasWater,
        expansionCapability: form.expansionCapability || undefined,
        safetyStatus: form.safetyStatus || undefined,
        notes: form.notes || undefined,
      };
      if (isEdit) return (await api.put(`/land-parcels/${id}`, body)).data as { id: string };
      return (await api.post('/land-parcels', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => {
      toast.success(isEdit ? 'Đã lưu hồ sơ khu đất.' : 'Đã tạo hồ sơ khu đất (nháp).');
      nav(`/land-parcels/${d.id ?? id}`);
    },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = form.name.trim().length >= 3 && (isEdit || form.code.trim().length >= 3);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/land-parcels/${id}` : '/land-parcels')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Hồ sơ khu đất' : 'Danh sách khu đất'}
      </button>
      <PageHeader eyebrow="Đất & địa điểm" title={isEdit ? 'Cập nhật hồ sơ khu đất' : 'Tạo hồ sơ khu đất quốc phòng'} />

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Section title="Thông tin chung">
          <Grid>
            <Field label="Mã khu đất *"><input className="input num" value={form.code} disabled={isEdit} onChange={set('code')} placeholder="VD: KD-001" /></Field>
            <Field label="Tên khu đất *" wide><input className="input" value={form.name} onChange={set('name')} placeholder="VD: Khu đất Bộ CHQS tỉnh" /></Field>
            <Field label="Đơn vị quản lý">
              <select className="input" value={form.organizationId} onChange={set('organizationId')}>
                <option value="">—</option>
                {(orgs.data?.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Địa bàn (xã/phường)"><AsyncPicker endpoint="/administrative-areas" value={form.areaId} onChange={(v) => setForm((f) => ({ ...f, areaId: v }))} placeholder="Tìm xã/phường…" /></Field>
            <Field label="Gắn với doanh trại"><AsyncPicker endpoint="/barracks" value={form.barracksId} onChange={(v) => setForm((f) => ({ ...f, barracksId: v }))} placeholder="Tìm doanh trại (nếu có)…" /></Field>
            <Field label="Địa chỉ" wide><input className="input" value={form.address} onChange={set('address')} placeholder="Thôn/khu vực, xã, huyện" /></Field>
          </Grid>
        </Section>

        <Section title="Đất đai & pháp lý">
          <Grid>
            <Field label="Diện tích (m²)"><input className="input num" type="number" min={0} value={form.landArea} onChange={set('landArea')} placeholder="0" /></Field>
            <Field label="Loại đất"><Select value={form.landUseType} onChange={set('landUseType')} options={LANDUSE_OPTIONS} /></Field>
            <Field label="Hiện trạng sử dụng"><Select value={form.usageStatus} onChange={set('usageStatus')} options={USAGE_OPTIONS} /></Field>
            <Field label="Hồ sơ pháp lý"><Select value={form.legalStatus} onChange={set('legalStatus')} options={LEGAL_OPTIONS} /></Field>
            <Field label="Số GCN/Quyết định"><input className="input num" value={form.certificateNo} onChange={set('certificateNo')} placeholder="VD: GCNQSDĐ-QP/2010/123" /></Field>
            <Field label="Nguồn gốc" wide><input className="input" value={form.legalOrigin} onChange={set('legalOrigin')} placeholder="VD: Bàn giao theo QĐ..." /></Field>
          </Grid>
        </Section>

        <Section title="Tranh chấp, hạ tầng & an toàn">
          <Grid>
            <Field label="Tình trạng tranh chấp"><Select value={form.disputeStatus} onChange={set('disputeStatus')} options={DISPUTE_OPTIONS} /></Field>
            <Field label="Khả năng mở rộng"><Select value={form.expansionCapability} onChange={set('expansionCapability')} options={EXPANSION_OPTIONS} allowEmpty /></Field>
            <Field label="Tình trạng an toàn"><Select value={form.safetyStatus} onChange={set('safetyStatus')} options={SAFETY_OPTIONS} allowEmpty /></Field>
            <Field label="Đường tiếp cận"><input className="input" value={form.accessRoad} onChange={set('accessRoad')} placeholder="VD: Đường nhựa nội bộ" /></Field>
            <Field label="Hạ tầng điện/nước">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 38 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.hasElectricity} onChange={setBool('hasElectricity')} /> Có điện</label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.hasWater} onChange={setBool('hasWater')} /> Có nước</label>
              </div>
            </Field>
            {form.disputeStatus !== 'NONE' && (
              <Field label="Ghi chú tranh chấp/lấn chiếm" wide><input className="input" value={form.disputeNote} onChange={set('disputeNote')} placeholder="Mô tả vị trí, mức độ, hướng xử lý…" /></Field>
            )}
            <Field label="Ghi chú" wide><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Ghi chú khác" /></Field>
          </Grid>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => nav(isEdit ? `/land-parcels/${id}` : '/land-parcels')}>Hủy</button>
          <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            <Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
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
function Select({ value, onChange, options, allowEmpty }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: Array<{ code: string; label: string }>; allowEmpty?: boolean }) {
  return (
    <select className="input" value={value} onChange={onChange}>
      {allowEmpty && <option value="">—</option>}
      {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}
