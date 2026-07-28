import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { num } from '../lib/format';

interface Balance {
  id: string;
  materialId: string;
  storageLocationId: string;
  materialCode: string;
  materialName: string;
  unitCode: string | null;
  categoryCode: string | null;
  locationCode: string;
  locationName: string;
  onHand: number;
  lastCounted: number | null;
  variance: number | null;
}
interface Loc { id: string; code: string; name: string }

// Vật chất và tồn kho (Frontend §6.7) — số sổ sách, kiểm kê, chênh lệch; ghi nhập/xuất/điều chỉnh.
export function InventoryPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [loc, setLoc] = useState('');
  const [txn, setTxn] = useState<{ balance: Balance; mode: 'IN' | 'OUT' | 'ADJUST' } | null>(null);
  const size = 15;

  const locations = useQuery({ queryKey: ['storage-locations'], queryFn: async () => (await api.get('/inventory/storage-locations', { params: { size: 200 } })).data as { data: Loc[] } });
  const q = useQuery({
    queryKey: ['balances', page, loc],
    queryFn: async () => (await api.get('/inventory/balances', { params: { page, size, storageLocationId: loc || undefined } })).data as { data: Balance[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Balance>[] = [
    { key: 'mcode', header: 'Mã VC', render: (r) => r.materialCode, mono: true, width: 90 },
    { key: 'mname', header: 'Vật chất', render: (r) => <span style={{ fontWeight: 600 }}>{r.materialName}</span> },
    { key: 'loc', header: 'Kho', render: (r) => r.locationName },
    { key: 'unit', header: 'ĐVT', render: (r) => r.unitCode ?? '—' },
    { key: 'onhand', header: 'Tồn sổ', render: (r) => num(r.onHand), align: 'right', mono: true },
    { key: 'counted', header: 'Kiểm kê', render: (r) => (r.lastCounted !== null ? num(r.lastCounted) : '—'), align: 'right', mono: true },
    { key: 'var', header: 'Chênh lệch', render: (r) => <Variance v={r.variance} />, align: 'right' },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setTxn({ balance: r, mode: 'IN' }); }} title="Nhập">＋</button>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setTxn({ balance: r, mode: 'OUT' }); }} title="Xuất">－</button>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setTxn({ balance: r, mode: 'ADJUST' }); }} title="Kiểm kê">⇄</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vật chất và vật tư"
        title="Tồn kho theo địa điểm"
        description="Số sổ sách, số kiểm kê và chênh lệch. Sổ kho bất biến — điều chỉnh bằng bút toán mới, không cho tồn âm."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 260 }} value={loc} onChange={(e) => { setPage(1); setLoc(e.target.value); }}>
          <option value="">Tất cả kho</option>
          {(locations.data?.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert" size={14} /> Dòng có chênh lệch được tô màu để dễ phát hiện bất thường.
        </span>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có tồn kho" />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {txn && (
        <TxnModal
          balance={txn.balance}
          mode={txn.mode}
          onClose={() => setTxn(null)}
          onDone={() => { setTxn(null); qc.invalidateQueries({ queryKey: ['balances'] }); }}
        />
      )}
    </>
  );
}

function Variance({ v }: { v: number | null }) {
  if (v === null) return <span className="muted">—</span>;
  const zero = Math.abs(v) < 0.001;
  const color = zero ? 'var(--ok-fg)' : v > 0 ? 'var(--info-fg)' : 'var(--danger-fg)';
  return (
    <span className="num" style={{ color, fontWeight: 600 }}>
      {zero ? '0' : (v > 0 ? '+' : '') + num(v)}
    </span>
  );
}

function TxnModal({ balance, mode, onClose, onDone }: { balance: Balance; mode: 'IN' | 'OUT' | 'ADJUST'; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const title = mode === 'IN' ? 'Ghi nhập kho' : mode === 'OUT' ? 'Ghi xuất kho' : 'Điều chỉnh kiểm kê';

  const mut = useMutation({
    mutationFn: async () => {
      const key = `${mode}-${balance.id}-${Date.now()}`;
      if (mode === 'ADJUST') {
        return api.post('/inventory/adjustments', { materialId: balance.materialId, storageLocationId: balance.storageLocationId, countedQuantity: Number(qty), note: note || undefined }, { headers: { 'Idempotency-Key': key } });
      }
      return api.post('/inventory/transactions', { materialId: balance.materialId, storageLocationId: balance.storageLocationId, type: mode, quantity: Number(qty), note: note || undefined }, { headers: { 'Idempotency-Key': key } });
    },
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });

  return (
    <Modal open title={title} onClose={onClose}>
      <div style={{ marginBottom: 14, fontSize: 13.5 }}>
        <b>{balance.materialName}</b> ({balance.materialCode}) tại <b>{balance.locationName}</b>
        <div className="muted" style={{ marginTop: 4 }}>Tồn sổ hiện tại: <span className="num">{num(balance.onHand)}</span> {balance.unitCode ?? ''}</div>
      </div>
      {error && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <Icon name="alert" size={15} /> {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="field-label">{mode === 'ADJUST' ? 'Số kiểm kê thực tế' : 'Số lượng'}</label>
          <input className="input num" type="number" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus placeholder="0" />
        </div>
        <div>
          <label className="field-label">Ghi chú / chứng từ</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Số chứng từ, lý do…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!qty || mut.isPending} onClick={() => mut.mutate()}>
            <Icon name="check" size={16} /> {mut.isPending ? 'Đang ghi…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
