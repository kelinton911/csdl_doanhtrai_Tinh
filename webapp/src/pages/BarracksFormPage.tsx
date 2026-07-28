import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';

interface Option { id: string; code: string; name: string }

// Tạo hồ sơ doanh trại (UC-05) — biểu mẫu có nhãn rõ, kiểm tra bắt buộc.
export function BarracksFormPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: '',
    name: '',
    areaId: '',
    organizationId: '',
    address: '',
    landArea: '',
    declaredCapacity: '',
    function: '',
  });
  const [error, setError] = useState<string | null>(null);

  const areas = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: Option[] } });
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: async () => (await api.get('/organizations', { params: { size: 200 } })).data as { data: Option[] } });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/barracks', {
        code: form.code.trim(),
        name: form.name.trim(),
        areaId: form.areaId || undefined,
        organizationId: form.organizationId || undefined,
        address: form.address || undefined,
        landArea: form.landArea ? Number(form.landArea) : undefined,
        declaredCapacity: form.declaredCapacity ? Number(form.declaredCapacity) : undefined,
        function: form.function || undefined,
      })).data as { id: string },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['barracks'] });
      nav(`/barracks/${d.id}`);
    },
    onError: (e) => setError(toProblem(e).title),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.code.trim().length >= 3 && form.name.trim().length >= 3;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/barracks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách doanh trại
      </button>
      <PageHeader eyebrow="Doanh trại và công trình" title="Tạo hồ sơ doanh trại" description="Tạo hồ sơ nháp với mã định danh. Hồ sơ mới ở trạng thái Nháp, gửi duyệt sau khi đủ thông tin." />

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <form
        className="card"
        style={{ padding: 24, maxWidth: 760, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      >
        <Field label="Mã doanh trại (bắt buộc)">
          <input className="input" value={form.code} onChange={set('code')} placeholder="VD: DT-101" />
        </Field>
        <Field label="Tên doanh trại (bắt buộc)">
          <input className="input" value={form.name} onChange={set('name')} placeholder="Tên doanh trại" />
        </Field>
        <Field label="Xã/phường">
          <select className="input" value={form.areaId} onChange={set('areaId')}>
            <option value="">— Chọn —</option>
            {(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Đơn vị quản lý">
          <select className="input" value={form.organizationId} onChange={set('organizationId')}>
            <option value="">— Chọn —</option>
            {(orgs.data?.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Địa chỉ">
          <input className="input" value={form.address} onChange={set('address')} placeholder="Thôn/khu vực" />
        </Field>
        <Field label="Chức năng">
          <input className="input" value={form.function} onChange={set('function')} placeholder="VD: Đơn vị bộ binh" />
        </Field>
        <Field label="Diện tích đất (m²)">
          <input className="input num" type="number" value={form.landArea} onChange={set('landArea')} placeholder="0" />
        </Field>
        <Field label="Khả năng tiếp nhận (người)">
          <input className="input num" type="number" value={form.declaredCapacity} onChange={set('declaredCapacity')} placeholder="0" />
        </Field>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--color-neutral-200)', paddingTop: 16 }}>
          <button type="button" className="btn" onClick={() => nav('/barracks')}>Hủy</button>
          <button className="btn btn-primary" disabled={!valid || create.isPending}>
            <Icon name="check" size={16} /> {create.isPending ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
