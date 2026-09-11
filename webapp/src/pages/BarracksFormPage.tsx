import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/States';
import { Icon } from '../components/Icon';
import { AsyncPicker } from '../components/AsyncPicker';

interface Option { id: string; code: string; name: string }

// provinceCode chỉ dùng cho giao diện (lọc danh sách xã theo tỉnh) — không gửi lên backend;
// hồ sơ chỉ lưu areaId (xã/phường).
const EMPTY = {
  code: '',
  name: '',
  provinceCode: '',
  areaId: '',
  organizationId: '',
  address: '',
  landArea: '',
  declaredCapacity: '',
  function: '',
};

// Tạo/sửa hồ sơ doanh trại (UC-05/UC-06). Chế độ sửa chỉ áp dụng cho hồ sơ nháp
// (DRAFT/CHANGES_REQUESTED) — backend chặn sửa bản đã duyệt (no-edit-approved 409).
// Mã doanh trại mặc định do hệ thống tự sinh theo tỉnh (DT-<mã tỉnh>-<STT>); có thể nhập tay.
export function BarracksFormPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState({ ...EMPTY });
  // false = để hệ thống tự sinh mã; true = người dùng tự nhập mã.
  const [manualCode, setManualCode] = useState(false);

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
        provinceCode: '',
        areaId: String((d.areaId as string) ?? ''),
        organizationId: String((d.organizationId as string) ?? ''),
        address: String(d.address ?? ''),
        landArea: d.landArea != null ? String(d.landArea) : '',
        declaredCapacity: d.declaredCapacity != null ? String(d.declaredCapacity) : '',
        function: String(d.function ?? ''),
      });
    }
  }, [isEdit, existing.data]);

  // Danh sách tỉnh (cấp PROVINCE). Nếu hệ chỉ có 1 tỉnh → tự chọn sẵn.
  const provinces = useQuery({
    queryKey: ['areas', 'provinces'],
    queryFn: async () => (await api.get('/administrative-areas', { params: { level: 'PROVINCE', size: 100 } })).data as { data: Option[] },
  });
  useEffect(() => {
    const list = provinces.data?.data ?? [];
    if (!form.provinceCode && list.length === 1) {
      setForm((f) => ({ ...f, provinceCode: list[0].code }));
    }
  }, [provinces.data, form.provinceCode]);

  // Khi sửa hồ sơ: suy ra tỉnh từ xã đã lưu để lọc danh sách xã đúng phạm vi.
  const areaDetail = useQuery({
    queryKey: ['area-detail', form.areaId],
    queryFn: async () => (await api.get(`/administrative-areas/${form.areaId}`)).data as { provinceCode?: string },
    enabled: !!form.areaId && !form.provinceCode,
  });
  useEffect(() => {
    const pc = areaDetail.data?.provinceCode;
    if (pc && !form.provinceCode) setForm((f) => ({ ...f, provinceCode: String(pc) }));
  }, [areaDetail.data, form.provinceCode]);

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
      // Chỉ gửi code khi người dùng chọn nhập tay; bỏ trống để backend tự sinh.
      const createBody = manualCode && form.code.trim() ? { code: form.code.trim(), ...body } : body;
      return (await api.post('/barracks', createBody)).data as { id: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['barracks'] });
      toast.success(isEdit ? 'Đã lưu thay đổi hồ sơ doanh trại.' : 'Đã tạo hồ sơ doanh trại (nháp).');
      nav(`/barracks/${isEdit ? id : (d as { id: string }).id}`);
    },
    onError: (e) => {
      // Trùng mã (DATA-003): báo rõ thay vì thông điệp xung đột chung chung.
      const p = toProblem(e);
      if (p.status === 409 && p.code?.startsWith('DATA-003')) {
        toast.error('Mã doanh trại đã tồn tại. Hãy chọn mã khác hoặc để hệ thống tự sinh.', 'Trùng mã doanh trại');
        return;
      }
      toast.problem(e, isEdit ? 'Không lưu được hồ sơ' : 'Không tạo được hồ sơ');
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  // Đổi tỉnh → bỏ chọn xã cũ (thuộc tỉnh khác).
  const setProvince = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, provinceCode: e.target.value, areaId: '' }));

  const codeOk = isEdit || !manualCode || form.code.trim().length >= 3;
  const valid = form.name.trim().length >= 3 && codeOk;

  if (isEdit && existing.isLoading) return <Skeleton rows={6} />;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(isEdit ? `/barracks/${id}` : '/barracks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> {isEdit ? 'Về hồ sơ' : 'Danh sách doanh trại'}
      </button>
      <PageHeader
        eyebrow="Doanh trại và công trình"
        title={isEdit ? 'Sửa hồ sơ doanh trại' : 'Tạo hồ sơ doanh trại'}
        description={isEdit ? 'Cập nhật hồ sơ nháp. Mã doanh trại không đổi. Sửa xong gửi duyệt lại.' : 'Tạo hồ sơ nháp. Chọn Tỉnh → Xã; mã doanh trại mặc định do hệ thống tự sinh. Toạ độ mặc định lấy theo điểm đại diện của xã.'}
      />

      <form
        className="card"
        style={{ padding: 24, maxWidth: 760, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        {/* Mã doanh trại — chiếm cả hàng để chứa cả nút chuyển chế độ tự sinh/nhập tay. */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="field-label">Mã doanh trại</label>
            {!isEdit && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }} className="muted">
                <input type="checkbox" checked={manualCode} onChange={(e) => setManualCode(e.target.checked)} />
                Nhập mã thủ công
              </label>
            )}
          </div>
          {isEdit ? (
            <input className="input" value={form.code} disabled />
          ) : manualCode ? (
            <input className="input" value={form.code} onChange={set('code')} placeholder="VD: DT-38-01 (tối thiểu 3 ký tự)" />
          ) : (
            <input className="input" value="" disabled placeholder="Hệ thống tự sinh khi lưu — DT-<mã tỉnh>-<số thứ tự>" />
          )}
        </div>

        <Field label="Tỉnh/Thành phố">
          <select className="input" value={form.provinceCode} onChange={setProvince}>
            <option value="">— Chọn tỉnh —</option>
            {(provinces.data?.data ?? []).map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Xã/phường">
          <AsyncPicker
            endpoint="/administrative-areas"
            value={form.areaId}
            onChange={(v) => setForm((f) => ({ ...f, areaId: v }))}
            params={{ level: 'COMMUNE', provinceCode: form.provinceCode || undefined }}
            disabled={!form.provinceCode}
            placeholder={form.provinceCode ? 'Gõ tên/mã xã để tìm…' : 'Chọn tỉnh trước'}
          />
        </Field>

        <Field label="Tên doanh trại (bắt buộc)">
          <input className="input" value={form.name} onChange={set('name')} placeholder="Tên doanh trại" />
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
