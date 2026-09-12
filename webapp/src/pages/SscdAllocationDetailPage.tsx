import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { MaterialPicker } from '../components/MaterialPicker';
import { ErrorState } from '../components/States';
import { EDITABLE_STATUSES } from '../lib/workflow';
import { num, dateTime } from '../lib/format';
import { readinessLabel } from '../lib/sscd';

interface Line {
  key: string;
  materialCatalogId: string;
  materialLabel: string;
  materialCode?: string | null;
  materialName?: string | null;
  unitSymbol?: string | null;
  qtyKhoTinh: string;
  qtyXa: string;
  qtyTrungDoan: string;
  qtyCanCu: string;
  note?: string | null;
}
interface PlanDetail {
  id: string;
  readinessState: string;
  title: string;
  regulationRef: string | null;
  periodLabel: string | null;
  workflowStatus: string;
  notes: string | null;
  lines: Array<{
    id: string; materialCatalogId: string; materialCode: string | null; materialName: string | null;
    unitSymbol: string | null; qtyKhoTinh: number; qtyXa: number; qtyTrungDoan: number; qtyCanCu: number;
    qtyTotal: number; note: string | null; sortOrder: number;
  }>;
}
interface Rev { id: string; revisionNo: number; workflowStatus: string; createdAt: string; payload: { lines?: unknown[] } }

const TIER_KEYS = ['qtyKhoTinh', 'qtyXa', 'qtyTrungDoan', 'qtyCanCu'] as const;
const TIER_HEADERS = ['Kho Tỉnh', 'Xã', 'Trung đoàn', 'Căn cứ'];
const rowTotal = (l: Line) => TIER_KEYS.reduce((s, k) => s + (Number(l[k]) || 0), 0);
const newLine = (): Line => ({ key: crypto.randomUUID(), materialCatalogId: '', materialLabel: '', qtyKhoTinh: '', qtyXa: '', qtyTrungDoan: '', qtyCanCu: '', note: '' });

export function SscdAllocationDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can('PROVINCIAL_COMMAND', 'SYS_ADMIN');
  const canReview = can('REVIEWER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({ queryKey: ['sscd-alloc', id], queryFn: async () => (await api.get(`/readiness-allocations/${id}`)).data as PlanDetail });
  const [lines, setLines] = useState<Line[]>([]);
  const [showRev, setShowRev] = useState(false);

  useEffect(() => {
    if (q.data) {
      setLines(q.data.lines.map((l) => ({
        key: l.id,
        materialCatalogId: l.materialCatalogId,
        materialLabel: [l.materialCode, l.materialName].filter(Boolean).join(' — ') || l.materialCatalogId,
        materialCode: l.materialCode, materialName: l.materialName, unitSymbol: l.unitSymbol,
        qtyKhoTinh: String(l.qtyKhoTinh || ''), qtyXa: String(l.qtyXa || ''),
        qtyTrungDoan: String(l.qtyTrungDoan || ''), qtyCanCu: String(l.qtyCanCu || ''), note: l.note,
      })));
    }
  }, [q.data]);

  const plan = q.data;
  const editable = !!plan && EDITABLE_STATUSES.includes(plan.workflowStatus) && canManage;

  const saveLines = useMutation({
    mutationFn: async () => {
      const payload = lines.filter((l) => l.materialCatalogId).map((l) => ({
        materialCatalogId: l.materialCatalogId,
        qtyKhoTinh: Number(l.qtyKhoTinh) || 0,
        qtyXa: Number(l.qtyXa) || 0,
        qtyTrungDoan: Number(l.qtyTrungDoan) || 0,
        qtyCanCu: Number(l.qtyCanCu) || 0,
        note: l.note || undefined,
      }));
      return api.put(`/readiness-allocations/${id}/lines`, { lines: payload });
    },
    onSuccess: () => { toast.success('Đã lưu dòng phân cấp lượng.'); qc.invalidateQueries({ queryKey: ['sscd-alloc', id] }); },
    onError: (e) => toast.problem(e, 'Không lưu được'),
  });

  const act = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'request-changes') => api.post(`/readiness-allocations/${id}/${action}`),
    onSuccess: (_r, action) => {
      qc.invalidateQueries({ queryKey: ['sscd-alloc', id] });
      toast.success(action === 'submit' ? 'Đã gửi duyệt.' : action === 'approve' ? 'Đã duyệt.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const revs = useQuery({ queryKey: ['sscd-alloc-rev', id], queryFn: async () => (await api.get(`/readiness-allocations/${id}/revisions`)).data as Rev[], enabled: showRev });

  if (q.isError) return <ErrorState error={q.error} />;
  if (!plan) return <p className="muted">Đang tải…</p>;

  const setLine = (idx: number, patch: Partial<Line>) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const grandTotal = lines.reduce((s, l) => s + rowTotal(l), 0);

  return (
    <>
      <PageHeader
        eyebrow="SSCĐ — Phương án cấp Tỉnh"
        title={`Phân cấp lượng SSCĐ · ${readinessLabel(plan.readinessState)}`}
        description={`${plan.title}${plan.periodLabel ? ` · Kỳ ${plan.periodLabel}` : ''}${plan.regulationRef ? ` · Căn cứ: ${plan.regulationRef}` : ''}`}
        actions={<StatusBadge status={plan.workflowStatus} />}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm" onClick={() => nav('/sscd-allocations')} title="Về danh sách">← Danh sách</button>
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
              <th style={{ minWidth: 260 }}>Vật chất</th>
              <th style={{ width: 60 }}>ĐVT</th>
              {TIER_HEADERS.map((h) => <th key={h} style={{ width: 100, textAlign: 'right' }}>{h}</th>)}
              <th style={{ width: 100, textAlign: 'right' }}>Tổng</th>
              <th style={{ minWidth: 140 }}>Ghi chú</th>
              {editable && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={editable ? 9 : 8} className="muted" style={{ padding: 16, textAlign: 'center' }}>Chưa có dòng phân cấp lượng. {editable ? 'Bấm "Thêm dòng".' : ''}</td></tr>}
            {lines.map((l, idx) => (
              <tr key={l.key}>
                <td>
                  {editable
                    ? <MaterialPicker value={l.materialCatalogId || null} label={l.materialLabel || null} onPick={(mid, label) => setLine(idx, { materialCatalogId: mid, materialLabel: label })} />
                    : <span style={{ fontWeight: 600 }}>{l.materialLabel}</span>}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{l.unitSymbol ?? '—'}</td>
                {TIER_KEYS.map((tk) => (
                  <td key={tk} style={{ textAlign: 'right' }}>
                    {editable
                      ? <input className="input num" style={{ width: 88, textAlign: 'right', padding: '4px 6px' }} type="number" min={0} value={l[tk]} onChange={(e) => setLine(idx, { [tk]: e.target.value } as Partial<Line>)} />
                      : <span className="num">{num(Number(l[tk]) || 0)}</span>}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 700 }} className="num">{num(rowTotal(l))}</td>
                <td>
                  {editable
                    ? <input className="input" style={{ padding: '4px 6px' }} value={l.note ?? ''} onChange={(e) => setLine(idx, { note: e.target.value })} />
                    : <span className="muted" style={{ fontSize: 12 }}>{l.note ?? '—'}</span>}
                </td>
                {editable && <td style={{ textAlign: 'center' }}><button className="btn btn-sm btn-ghost" title="Xóa dòng" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>✕</button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600 }}>Tổng cộng (gộp cấp)</td>
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
