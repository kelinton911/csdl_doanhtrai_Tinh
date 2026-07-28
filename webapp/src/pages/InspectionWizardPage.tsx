import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';

interface Line {
  itemType: string;
  label: string;
  unitCode?: string;
  expectedQuantity?: number | null;
  countedQuantity?: number | null;
  note?: string;
}
interface Sheet {
  id: string;
  campaignId: string;
  barracksId: string | null;
  status: string;
  note: string | null;
  lines: Array<Line & { variance: number | null }>;
}

const STEPS = ['Thông tin phiếu', 'Nhập số liệu', 'Rà soát chênh lệch', 'Xác nhận & gửi'];

// Phiếu kiểm kê dạng wizard 4 bước (Frontend §6.8). Autosave khi chuyển bước.
export function InspectionWizardPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sheet = useQuery({
    queryKey: ['sheet', id],
    queryFn: async () => (await api.get<Sheet>(`/inspection-sheets/${id}`)).data,
  });
  useEffect(() => {
    if (sheet.data) {
      setNote(sheet.data.note ?? '');
      setLines(
        sheet.data.lines.length
          ? sheet.data.lines.map((l) => ({ itemType: l.itemType, label: l.label, unitCode: l.unitCode ?? '', expectedQuantity: l.expectedQuantity, countedQuantity: l.countedQuantity, note: l.note }))
          : [],
      );
    }
  }, [sheet.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/inspection-sheets/${id}`, {
        note,
        lines: lines.map((l) => ({
          itemType: l.itemType || 'MATERIAL',
          label: l.label,
          unitCode: l.unitCode || undefined,
          expectedQuantity: l.expectedQuantity === null || l.expectedQuantity === undefined || (l.expectedQuantity as unknown) === '' ? undefined : Number(l.expectedQuantity),
          countedQuantity: l.countedQuantity === null || l.countedQuantity === undefined || (l.countedQuantity as unknown) === '' ? undefined : Number(l.countedQuantity),
          note: l.note || undefined,
        })),
      }),
    onError: (e) => setError(toProblem(e).title),
  });

  const submit = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return api.post(`/inspection-sheets/${id}/submit`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheets'] });
      nav('/inspection');
    },
    onError: (e) => setError(toProblem(e).title),
  });

  if (sheet.isLoading) return <Skeleton rows={6} />;
  if (sheet.isError || !sheet.data) return <ErrorState error={sheet.error} />;
  const editable = ['DRAFT', 'NEEDS_REVISION'].includes(sheet.data.status);

  const addLine = () => setLines((ls) => [...ls, { itemType: 'MATERIAL', label: '', unitCode: '', expectedQuantity: null, countedQuantity: null }]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const variance = (l: Line) => (l.expectedQuantity != null && l.countedQuantity != null && l.expectedQuantity !== ('' as unknown) && l.countedQuantity !== ('' as unknown) ? Number(l.countedQuantity) - Number(l.expectedQuantity) : null);
  const bigVariances = lines.filter((l) => { const v = variance(l); return v !== null && Math.abs(v) > 0; });

  async function next() {
    setError(null);
    if (editable) await save.mutateAsync().catch(() => {});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/inspection')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Kiểm kê
      </button>
      <PageHeader eyebrow="Phiếu kiểm kê" title="Nhập phiếu kiểm kê" actions={<StatusBadge status={sheet.data.status} />} />

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, background: i <= step ? 'var(--teal)' : 'var(--color-neutral-300)', color: i <= step ? '#fff' : 'var(--color-neutral-700)' }}>{i + 1}</div>
              <span style={{ fontSize: 13, fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? 'var(--teal)' : 'var(--color-neutral-300)', margin: '0 10px' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      <div className="card" style={{ padding: 22 }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
            <div className="muted">Phiếu thuộc đợt kiểm kê đã chọn. Nhập ghi chú chung cho phiếu (nếu có).</div>
            <div>
              <label className="field-label">Ghi chú phiếu</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} placeholder="Phạm vi, người thực hiện…" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="eyebrow">Dòng số liệu ({lines.length})</div>
              {editable && <button className="btn btn-sm btn-primary" onClick={addLine}><Icon name="plus" size={14} /> Thêm dòng</button>}
            </div>
            <div className="panel scrl" style={{ overflow: 'auto' }}>
              <table className="data">
                <thead><tr><th>Đối tượng</th><th>ĐVT</th><th style={{ textAlign: 'right' }}>Định mức/sổ</th><th style={{ textAlign: 'right' }}>Thực tế</th><th style={{ textAlign: 'right' }}>Chênh lệch</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const v = variance(l);
                    return (
                      <tr key={i}>
                        <td><input className="input" style={{ minWidth: 180 }} value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} disabled={!editable} placeholder="Tên vật chất/công trình" /></td>
                        <td><input className="input" style={{ width: 70 }} value={l.unitCode ?? ''} onChange={(e) => setLine(i, { unitCode: e.target.value })} disabled={!editable} /></td>
                        <td><input className="input num" type="number" style={{ width: 100, textAlign: 'right' }} value={l.expectedQuantity ?? ''} onChange={(e) => setLine(i, { expectedQuantity: e.target.value === '' ? null : Number(e.target.value) })} disabled={!editable} /></td>
                        <td><input className="input num" type="number" style={{ width: 100, textAlign: 'right' }} value={l.countedQuantity ?? ''} onChange={(e) => setLine(i, { countedQuantity: e.target.value === '' ? null : Number(e.target.value) })} disabled={!editable} /></td>
                        <td className="num" style={{ textAlign: 'right', color: v == null ? 'var(--color-neutral-500)' : v === 0 ? 'var(--ok-fg)' : 'var(--danger-fg)', fontWeight: 600 }}>{v == null ? '—' : (v > 0 ? '+' : '') + num(v)}</td>
                        <td>{editable && <button className="btn btn-sm btn-ghost" onClick={() => removeLine(i)}>✕</button>}</td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Chưa có dòng. Bấm "Thêm dòng" để nhập số liệu.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Rà soát chênh lệch & bất thường</div>
            {bigVariances.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 8, background: 'var(--ok-bg)', color: 'var(--ok-fg)', border: '1px solid var(--ok-bd)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="check" size={18} /> Không có chênh lệch — số liệu khớp định mức/sổ sách.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bigVariances.map((l, i) => {
                  const v = variance(l)!;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)', borderRadius: 8 }}>
                      <span style={{ fontWeight: 600 }}><Icon name="alert" size={15} /> {l.label || '(chưa đặt tên)'}</span>
                      <span className="num" style={{ fontWeight: 700 }}>{v > 0 ? '+' : ''}{num(v)} {l.unitCode}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ maxWidth: 560 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Xác nhận và gửi duyệt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, fontSize: 14 }}>
              <Row label="Số dòng số liệu" value={num(lines.length)} />
              <Row label="Số dòng có chênh lệch" value={num(bigVariances.length)} />
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--info-bg)', color: 'var(--info-fg)', border: '1px solid var(--info-bd)', fontSize: 13 }}>
              Sau khi gửi, phiếu chuyển sang <b>kiểm duyệt</b>. Người lập phiếu không được tự duyệt.
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <Icon name="chevron" size={14} className="rot180" /> Trước
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {editable && <button className="btn" onClick={() => save.mutate()} disabled={save.isPending}><Icon name="check" size={15} /> Lưu nháp</button>}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>Tiếp <Icon name="chevron" size={14} /></button>
          ) : (
            editable && <button className="btn btn-primary" onClick={() => submit.mutate()} disabled={submit.isPending || lines.length === 0}><Icon name="upload" size={15} /> {submit.isPending ? 'Đang gửi…' : 'Gửi duyệt'}</button>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
      <span className="muted">{label}</span>
      <span className="num" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
