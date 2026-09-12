import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/States';
import { Icon } from '../components/Icon';
import { AsyncPicker } from '../components/AsyncPicker';
import { MaterialPicker } from '../components/MaterialPicker';
import { EDITABLE_STATUSES } from '../lib/workflow';
import { POTENTIAL_GROUPS, POTENTIAL_METRIC_KEYS, type CommunePotential } from '../lib/communePotential';

// Suy nhóm danh mục từ mã: TLDP.* là nhóm "Tiềm lực địa phương", còn lại là danh mục chuẩn.
const groupFromCode = (codeOrLabel: string): 'STANDARD' | 'LOCAL_POTENTIAL' =>
  codeOrLabel.trim().toUpperCase().startsWith('TLDP') ? 'LOCAL_POTENTIAL' : 'STANDARD';

interface LineRow {
  id?: string;
  materialCatalogId: string;
  materialLabel: string;
  catalogGroup: string;
  quantity: string;
  note: string;
}

const emptyMetrics = (): Record<string, string> =>
  Object.fromEntries(POTENTIAL_METRIC_KEYS.map((k) => [k, '']));

// M17 — Tạo/sửa bản khai Tiềm lực HC-KT khu vực cấp xã.
export function CommunePotentialFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profile, hasRole } = useAuth();
  const isEdit = !!id;
  // Cấp xã bị khóa về đúng khu vực của mình; vai trò toàn tỉnh chọn khu vực bất kỳ.
  const canPickArea = hasRole('SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER');
  const ownAreaId = profile?.dataScopes?.find((s) => s.type === 'AREA')?.refId ?? '';

  const [meta, setMeta] = useState({ code: '', title: '', areaId: '', periodLabel: '', assessment: '', note: '' });
  const [metrics, setMetrics] = useState<Record<string, string>>(emptyMetrics);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    enabled: isEdit,
    queryKey: ['commune-potential', id],
    queryFn: async () => (await api.get(`/commune-potentials/${id}`)).data as CommunePotential,
  });

  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setMeta({
        code: d.code ?? '', title: d.title ?? '', areaId: d.areaId ?? '',
        periodLabel: d.periodLabel ?? '', assessment: d.assessment ?? '', note: d.note ?? '',
      });
      const m: Record<string, string> = {};
      for (const k of POTENTIAL_METRIC_KEYS) {
        const v = Number(d[k] ?? 0);
        m[k] = v === 0 ? '' : String(v);
      }
      setMetrics(m);
    }
  }, [existing.data]);

  // Cấp xã: mặc định khu vực = khu vực của tài khoản (khóa cứng bên dưới).
  useEffect(() => {
    if (!isEdit && !canPickArea && ownAreaId && !meta.areaId) {
      setMeta((s) => ({ ...s, areaId: ownAreaId }));
    }
  }, [isEdit, canPickArea, ownAreaId, meta.areaId]);

  const editable = !isEdit || (existing.data ? EDITABLE_STATUSES.includes(existing.data.workflowStatus) : false);

  const save = useMutation({
    mutationFn: async () => {
      const nums: Record<string, number> = {};
      for (const k of POTENTIAL_METRIC_KEYS) {
        const v = Number(metrics[k]);
        if (metrics[k] !== '' && !Number.isNaN(v)) nums[k] = v;
      }
      const body = {
        title: meta.title.trim(),
        areaId: meta.areaId || undefined,
        periodLabel: meta.periodLabel || undefined,
        assessment: meta.assessment || undefined,
        note: meta.note || undefined,
        ...nums,
      };
      if (isEdit) return (await api.put(`/commune-potentials/${id}`, body)).data as { id: string };
      const createBody = meta.code.trim() ? { code: meta.code.trim(), ...body } : body;
      return (await api.post('/commune-potentials', createBody)).data as { id: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['commune-potentials'] });
      toast.success(isEdit ? 'Đã lưu bản khai tiềm lực.' : 'Đã tạo bản khai tiềm lực (nháp). Thêm dòng vật chất bên dưới.');
      // Sau khi tạo: chuyển sang trang sửa để nhập dòng vật chất (cần id bản khai).
      nav(isEdit ? '/commune-potential' : `/commune-potential/${d.id}/edit`);
    },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e, isEdit ? 'Không lưu được' : 'Không tạo được'); },
  });

  if (isEdit && existing.isLoading) return <Skeleton rows={8} />;
  const canSave = editable && meta.title.trim().length >= 3;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/commune-potential')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách bản khai
      </button>
      <PageHeader
        eyebrow="Tiềm lực Hậu cần - Kỹ thuật"
        title={isEdit ? 'Cập nhật bản khai tiềm lực HC-KT' : 'Khai báo tiềm lực HC-KT khu vực'}
        description={editable ? 'Nhập chỉ số tiềm lực HC-KT của khu vực theo kỳ. Lưu nháp rồi gửi chỉ huy duyệt.' : 'Bản khai đã chốt — chỉ xem. Muốn sửa, đề nghị cấp duyệt trả lại để bổ sung.'}
      />

      {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {error}</div>}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin chung</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Field label="Mã bản khai">
              <input className="input num" value={meta.code} disabled={isEdit} onChange={(e) => setMeta((s) => ({ ...s, code: e.target.value }))} placeholder={isEdit ? '' : 'Tự sinh nếu để trống'} />
            </Field>
            <Field label="Tên bản khai *" wide>
              <input className="input" value={meta.title} disabled={!editable} onChange={(e) => setMeta((s) => ({ ...s, title: e.target.value }))} placeholder="VD: Tiềm lực HC-KT xã A01 — 2026" />
            </Field>
            <Field label="Khu vực (xã/phường)">
              <AsyncPicker endpoint="/administrative-areas" value={meta.areaId} onChange={(v) => setMeta((s) => ({ ...s, areaId: v }))} params={{ level: 'COMMUNE' }} disabled={!editable || !canPickArea} placeholder="Tìm xã/phường…" />
            </Field>
            <Field label="Kỳ báo cáo">
              <input className="input" value={meta.periodLabel} disabled={!editable} onChange={(e) => setMeta((s) => ({ ...s, periodLabel: e.target.value }))} placeholder="VD: 2026 / Quý I/2026" />
            </Field>
          </div>
        </div>

        {POTENTIAL_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>{g.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {g.metrics.map((m) => (
                <Field key={m.key} label={m.unit ? `${m.label} (${m.unit})` : m.label}>
                  <input
                    className="input num" type="number" min={0} step="any"
                    value={metrics[m.key] ?? ''} disabled={!editable}
                    onChange={(e) => setMetrics((s) => ({ ...s, [m.key]: e.target.value }))}
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Vật chất tiềm lực (KVPT)</div>
          {isEdit ? (
            <MaterialLinesSection potentialId={id!} editable={editable} />
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Lưu nháp bản khai trước, sau đó thêm các dòng vật chất tiềm lực (chọn theo danh mục
              chuẩn hoặc nhóm “Tiềm lực địa phương”).
            </p>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Đánh giá & ghi chú</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Đánh giá chung" wide>
              <textarea className="input" rows={2} value={meta.assessment} disabled={!editable} onChange={(e) => setMeta((s) => ({ ...s, assessment: e.target.value }))} />
            </Field>
            <Field label="Ghi chú" wide>
              <textarea className="input" rows={2} value={meta.note} disabled={!editable} onChange={(e) => setMeta((s) => ({ ...s, note: e.target.value }))} />
            </Field>
          </div>
        </div>

        {editable && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => nav('/commune-potential')}>Hủy</button>
            <button className="btn btn-primary" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
              <Icon name="check" size={16} /> {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Lưu nháp'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Bảng dòng vật chất tiềm lực — tự tải/ghi qua /commune-potentials/:id/materials (bulk upsert).
function MaterialLinesSection({ potentialId, editable }: { potentialId: string; editable: boolean }) {
  const qc = useQueryClient();
  const [lines, setLines] = useState<LineRow[]>([]);

  const q = useQuery({
    queryKey: ['commune-potential-materials', potentialId],
    queryFn: async () =>
      (await api.get(`/commune-potentials/${potentialId}/materials`)).data as Array<{
        id: string; materialCatalogId: string; materialCode: string | null; materialName: string | null;
        catalogGroup: string; quantity: number; note: string | null;
      }>,
  });

  useEffect(() => {
    if (q.data) {
      setLines(q.data.map((r) => ({
        id: r.id,
        materialCatalogId: r.materialCatalogId,
        materialLabel: [r.materialCode, r.materialName].filter(Boolean).join(' — ') || r.materialCatalogId,
        catalogGroup: r.catalogGroup,
        quantity: r.quantity === 0 ? '' : String(r.quantity),
        note: r.note ?? '',
      })));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const materials = lines
        .filter((l) => l.materialCatalogId)
        .map((l, i) => ({
          id: l.id,
          materialCatalogId: l.materialCatalogId,
          catalogGroup: l.catalogGroup,
          quantity: l.quantity ? Number(l.quantity) : 0,
          note: l.note || undefined,
          sortOrder: i,
        }));
      return (await api.put(`/commune-potentials/${potentialId}/materials`, { materials })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commune-potential-materials', potentialId] });
      toast.success('Đã lưu danh sách vật chất tiềm lực.');
    },
    onError: (e) => toast.problem(e, 'Không lưu được danh sách vật chất'),
  });

  const setLine = (idx: number, patch: Partial<LineRow>) =>
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((s) => [...s, { materialCatalogId: '', materialLabel: '', catalogGroup: 'STANDARD', quantity: '', note: '' }]);
  const removeLine = (idx: number) => setLines((s) => s.filter((_, i) => i !== idx));

  if (q.isLoading) return <Skeleton rows={3} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Vật chất (danh mục)</th>
            <th style={{ width: 130 }}>Nguồn</th>
            <th style={{ width: 110, textAlign: 'right' }}>Số lượng</th>
            <th>Ghi chú</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={5} className="muted" style={{ padding: 10, fontSize: 13 }}>Chưa có dòng vật chất. Bấm “Thêm dòng”.</td></tr>
          )}
          {lines.map((l, idx) => (
            <tr key={l.id ?? `new-${idx}`}>
              <td>
                <MaterialPicker
                  value={l.materialCatalogId || null}
                  label={l.materialLabel || null}
                  onPick={(id, label) => setLine(idx, { materialCatalogId: id, materialLabel: label, catalogGroup: groupFromCode(label) })}
                />
              </td>
              <td style={{ textAlign: 'center', fontSize: 12 }}>
                {l.catalogGroup === 'LOCAL_POTENTIAL' ? 'Tiềm lực ĐP' : 'Chuẩn'}
              </td>
              <td>
                <input className="input num" type="number" min={0} step="any" style={{ textAlign: 'right' }}
                  value={l.quantity} disabled={!editable}
                  onChange={(e) => setLine(idx, { quantity: e.target.value })} placeholder="0" />
              </td>
              <td>
                <input className="input" value={l.note} disabled={!editable}
                  onChange={(e) => setLine(idx, { note: e.target.value })} />
              </td>
              <td style={{ textAlign: 'center' }}>
                {editable && (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeLine(idx)} title="Xóa dòng" style={{ fontSize: 16, lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm" type="button" onClick={addLine}><Icon name="plus" size={14} /> Thêm dòng</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-primary" type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            <Icon name="check" size={14} /> {save.isPending ? 'Đang lưu…' : 'Lưu danh sách vật chất'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      {children}
    </label>
  );
}
