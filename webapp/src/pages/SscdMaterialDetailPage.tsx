import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { AsyncPicker } from '../components/AsyncPicker';
import { ErrorState } from '../components/States';
import { EDITABLE_STATUSES } from '../lib/workflow';
import { num, dateTime } from '../lib/format';
import { readinessLabel, previousReadinessState } from '../lib/sscd';

interface Line {
  key: string;
  materialId: string;
  materialCode?: string | null;
  materialName?: string | null;
  unitCode?: string | null;
  qtyGrade1: string; qtyGrade2: string; qtyGrade3: string; qtyGrade4: string; qtyGrade5: string;
  note?: string | null;
}
interface PlanDetail {
  id: string;
  areaId: string;
  areaName: string | null;
  readinessState: string;
  workflowStatus: string;
  copiedFromState: string | null;
  notes: string | null;
  lines: Array<{ id: string; materialId: string; materialCode: string | null; materialName: string | null; unitCode: string | null; qtyGrade1: number; qtyGrade2: number; qtyGrade3: number; qtyGrade4: number; qtyGrade5: number; total: number; note: string | null; sortOrder: number }>;
}
interface Rev { id: string; revisionNo: number; workflowStatus: string; createdAt: string; payload: { lines?: unknown[] } }

const g = (l: Line) => [l.qtyGrade1, l.qtyGrade2, l.qtyGrade3, l.qtyGrade4, l.qtyGrade5].reduce((s, x) => s + (Number(x) || 0), 0);
const newLine = (): Line => ({ key: crypto.randomUUID(), materialId: '', qtyGrade1: '', qtyGrade2: '', qtyGrade3: '', qtyGrade4: '', qtyGrade5: '', note: '' });

export function SscdMaterialDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can('BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN');
  const canReview = can('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({ queryKey: ['sscd', id], queryFn: async () => (await api.get(`/readiness-materials/${id}`)).data as PlanDetail });
  const [lines, setLines] = useState<Line[]>([]);
  const [showRev, setShowRev] = useState(false);

  // Nạp dòng từ server vào state cục bộ mỗi khi tải lại bản.
  useEffect(() => {
    if (q.data) {
      setLines(q.data.lines.map((l) => ({
        key: l.id, materialId: l.materialId, materialCode: l.materialCode, materialName: l.materialName, unitCode: l.unitCode,
        qtyGrade1: String(l.qtyGrade1 || ''), qtyGrade2: String(l.qtyGrade2 || ''), qtyGrade3: String(l.qtyGrade3 || ''), qtyGrade4: String(l.qtyGrade4 || ''), qtyGrade5: String(l.qtyGrade5 || ''), note: l.note,
      })));
    }
  }, [q.data]);

  const plan = q.data;
  const editable = !!plan && EDITABLE_STATUSES.includes(plan.workflowStatus) && canManage;
  const prev = plan ? previousReadinessState(plan.readinessState) : null;

  const saveLines = useMutation({
    mutationFn: async () => {
      const payload = lines.filter((l) => l.materialId).map((l) => ({
        materialId: l.materialId,
        qtyGrade1: Number(l.qtyGrade1) || 0, qtyGrade2: Number(l.qtyGrade2) || 0, qtyGrade3: Number(l.qtyGrade3) || 0, qtyGrade4: Number(l.qtyGrade4) || 0, qtyGrade5: Number(l.qtyGrade5) || 0,
        note: l.note || undefined,
      }));
      return api.put(`/readiness-materials/${id}/lines`, { lines: payload });
    },
    onSuccess: () => { toast.success('Đã lưu dòng vật chất.'); qc.invalidateQueries({ queryKey: ['sscd', id] }); },
    onError: (e) => toast.problem(e, 'Không lưu được'),
  });

  const copyPrev = useMutation({
    mutationFn: async () => api.post('/readiness-materials/copy-from-previous', { areaId: plan!.areaId, targetState: plan!.readinessState }),
    onSuccess: () => { toast.success(`Đã sao chép từ mức ${readinessLabel(prev)}.`); qc.invalidateQueries({ queryKey: ['sscd', id] }); },
    onError: (e) => toast.problem(e, 'Không sao chép được'),
  });

  const act = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'request-changes') => api.post(`/readiness-materials/${id}/${action}`),
    onSuccess: (_r, action) => {
      qc.invalidateQueries({ queryKey: ['sscd', id] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(action === 'submit' ? 'Đã gửi duyệt.' : action === 'approve' ? 'Đã duyệt.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const revs = useQuery({ queryKey: ['sscd-rev', id], queryFn: async () => (await api.get(`/readiness-materials/${id}/revisions`)).data as Rev[], enabled: showRev });

  if (q.isError) return <ErrorState error={q.error} />;
  if (!plan) return <p className="muted">Đang tải…</p>;

  const grandTotal = lines.reduce((s, l) => s + g(l), 0);

  return (
    <>
      <PageHeader
        eyebrow="Sẵn sàng chiến đấu"
        title={`Vật chất SSCĐ · ${readinessLabel(plan.readinessState)}`}
        description={`Xã: ${plan.areaName ?? '—'}${plan.copiedFromState ? ` · Sao chép từ mức ${readinessLabel(plan.copiedFromState)}` : ''}${plan.notes ? ` · ${plan.notes}` : ''}`}
        actions={<StatusBadge status={plan.workflowStatus} />}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm" onClick={() => nav('/sscd-materials')} title="Về danh sách">← Danh sách</button>
        {editable && prev && (
          <button className="btn" disabled={copyPrev.isPending} onClick={() => copyPrev.mutate()} title={`Sao chép các dòng từ bản mức ${readinessLabel(prev)} đã duyệt của xã`}>
            <Icon name="download" size={15} /> Sao chép từ mức {readinessLabel(prev)}
          </button>
        )}
        {editable && <button className="btn" onClick={() => setLines((ls) => [...ls, newLine()])}><Icon name="plus" size={15} /> Thêm dòng</button>}
        {editable && <button className="btn btn-primary" disabled={saveLines.isPending} onClick={() => saveLines.mutate()}><Icon name="check" size={15} /> Lưu dòng</button>}
        {editable && <button className="btn" disabled={act.isPending} onClick={() => act.mutate('submit')}><Icon name="upload" size={15} /> Gửi duyệt</button>}
        {canReview && plan.workflowStatus === 'PENDING_REVIEW' && (
          <>
            <button className="btn" disabled={act.isPending} onClick={() => act.mutate('request-changes')}>Trả lại</button>
            <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('approve')}><Icon name="check" size={15} /> Duyệt</button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setShowRev((v) => !v)}><Icon name="clipboard" size={13} /> Lịch sử ({showRev ? 'ẩn' : 'xem'})</button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Vật chất</th>
              <th style={{ width: 60 }}>ĐVT</th>
              <th style={{ width: 80, textAlign: 'right' }}>Cấp 1</th>
              <th style={{ width: 80, textAlign: 'right' }}>Cấp 2</th>
              <th style={{ width: 80, textAlign: 'right' }}>Cấp 3</th>
              <th style={{ width: 80, textAlign: 'right' }}>Cấp 4</th>
              <th style={{ width: 80, textAlign: 'right' }}>Cấp 5</th>
              <th style={{ width: 90, textAlign: 'right' }}>Tổng</th>
              <th style={{ minWidth: 140 }}>Ghi chú</th>
              {editable && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={editable ? 10 : 9} className="muted" style={{ padding: 16, textAlign: 'center' }}>Chưa có dòng vật chất. {editable ? 'Bấm "Thêm dòng" hoặc "Sao chép từ mức trước".' : ''}</td></tr>}
            {lines.map((l, idx) => (
              <tr key={l.key}>
                <td>
                  {editable
                    ? <AsyncPicker endpoint="/materials" value={l.materialId} onChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, materialId: v } : x))} placeholder="Tìm vật chất…" />
                    : <span style={{ fontWeight: 600 }}>{l.materialName ?? l.materialId}</span>}
                  {!editable && l.materialCode && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{l.materialCode}</span>}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{l.unitCode ?? '—'}</td>
                {(['qtyGrade1', 'qtyGrade2', 'qtyGrade3', 'qtyGrade4', 'qtyGrade5'] as const).map((gk) => (
                  <td key={gk} style={{ textAlign: 'right' }}>
                    {editable
                      ? <input className="input num" style={{ width: 72, textAlign: 'right', padding: '4px 6px' }} type="number" min={0} value={l[gk]} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, [gk]: e.target.value } : x))} />
                      : <span className="num">{num(Number(l[gk]) || 0)}</span>}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 700 }} className="num">{num(g(l))}</td>
                <td>
                  {editable
                    ? <input className="input" style={{ padding: '4px 6px' }} value={l.note ?? ''} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))} />
                    : <span className="muted" style={{ fontSize: 12 }}>{l.note ?? '—'}</span>}
                </td>
                {editable && <td style={{ textAlign: 'center' }}><button className="btn btn-sm btn-ghost" title="Xóa dòng" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>✕</button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600 }}>Tổng cộng (gộp cấp)</td>
              <td style={{ textAlign: 'right', fontWeight: 800 }} className="num">{num(grandTotal)}</td>
              <td colSpan={editable ? 2 : 1}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showRev && (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <h4 style={{ margin: '0 0 10px' }}>Lịch sử phiên bản (bất biến)</h4>
          {(revs.data ?? []).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{revs.isLoading ? 'Đang tải…' : 'Chưa có phiên bản (tạo khi gửi duyệt/duyệt).'}</p> : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead><tr><th>Phiên bản</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Số dòng</th><th>Thời điểm</th></tr></thead>
              <tbody>
                {(revs.data ?? []).map((r) => (
                  <tr key={r.id}><td className="mono">#{r.revisionNo}</td><td><StatusBadge status={r.workflowStatus} /></td><td style={{ textAlign: 'right' }} className="num">{r.payload?.lines?.length ?? 0}</td><td className="muted" style={{ fontSize: 12 }}>{dateTime(r.createdAt)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
