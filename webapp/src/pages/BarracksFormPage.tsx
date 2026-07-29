import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/States';
import { Icon } from '../components/Icon';

interface Option { id: string; code: string; name: string }

const EMPTY = {
  code: '',
  name: '',
  areaId: '',
  organizationId: '',
  address: '',
  landArea: '',
  declaredCapacity: '',
  function: '',
};

// Tạo/sửa hồ sơ doanh trại (UC-05/UC-06). Chế độ sửa chỉ áp dụng cho hồ sơ nháp
// (DRAFT/CHANGES_REQUESTED) — backend chặn sửa bản đã duyệt (no-edit-approved 409).
export function BarracksFormPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });

  const existing = useQuery({
    queryKey: ['barracks', id],
    queryFn: async () => (await api.get(`/barracks/${id}`)).data as Record<string, unknown>,
    enabled: isEdit,
  });

  useEffect(() => {
    if (isEdit && existing.data) {
      const d = existing.data;
      setForm({
        code: String(d.code ?? ''),
        name: String(d.name ?? ''),
        areaId: String((d.areaId as string) ?? ''),
        organizationId: String((d.organizationId as string) ?? ''),
        address: String(d.address ?? ''),
        landArea: d.landArea != null ? String(d.landArea) : '',
        declaredCapacity: d.declaredCapacity != null ? String(d.declaredCapacity) : '',
        function: String(d.function ?? ''),
      });
    }
  }, [isEdit, existing.data]);

  const areas = useQuery({ queryKey: ['areas'], queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: Option[] } });
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: async () => (await api.get('/organizations', { params: { size: 200 } })).data as { data: Option[] } });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        areaId: form.areaId || undefined,
        organizationId: form.organizationId || undefined,
        address: form.address || undefined,
        landArea: form.landArea ? Number(form.landArea) : undefined,
        declaredCapacity: form.declaredCapacity ? Number(form.declaredCapacity) : undefined,
        function: form.function || undefined,
      };
      if (isEdit) return (await api.put(`/barracks/${id}`, body)).data as { id: string };
      return (await api.post('/barracks', { code: form.code.trim(), ...body })).data as { id: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['barracks'] });
      toast.success(isEdit ? 'Đã lưu thay đổi hồ sơ doanh trại.' : 'Đã tạo hồ sơ doanh trại (nháp).');
      nav(`/barracks/${isEdit ? id : (d as { id: string }).id}`);
    },
    onError: (e) => toast.problem(e, isEdit ? 'Không lưu được hồ sơ' : 'Không tạo được hồ sơ'),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.code.trim().length >= 3 && form.name.trim().length >= 3;

  if (isEdit && existing.isLoading) return <Skeleton rows={6} />;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/barracks/${id}` : '/barracks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Về hồ sơ' : 'Danh sách doanh trại'}
      </button>
      <PageHeader
        eyebrow="Doanh trại và công trình"
        title={isEdit ? 'Sửa hồ sơ doanh trại' : 'Tạo hồ sơ doanh trại'}
        description={isEdit ? 'Cập nhật hồ sơ nháp. Mã doanh trại không đổi. Sửa xong gửi duyệt lại.' : 'Tạo hồ sơ nháp với mã định danh. Hồ sơ mới ở trạng thái Nháp, gửi duyệt sau khi đủ thông tin.'}
      />

      <form
        className="card"
        style={{ padding: 24, maxWidth: 760, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        <Field label="Mã doanh trại (bắt buộc)">
          <input className="input" value={form.code} onChange={set('code')} placeholder="VD: DT-101" disabled={isEdit} />
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
          <input className="input num" type="number" min={0} value={form.landArea} onChange={set('landArea')} placeholder="0" />
        </Field>
        <Field label="Khả năng tiếp nhận (người)">
          <input className="input num" type="number" min={0} value={form.declaredCapacity} onChange={set('declaredCapacity')} placeholder="0" />
        </Field>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--color-neutral-200)', paddingTop: 16 }}>
          <button type="button" className="btn" onClick={() => nav(isEdit ? `/barracks/${id}` : '/barracks')}>Hủy</button>
          <button className="btn btn-primary" disabled={!valid || save.isPending}>
            <Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Lưu nháp'}
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
