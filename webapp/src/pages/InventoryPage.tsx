import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { num, dateTime } from '../lib/format';

interface Txn { id: string; type: string; quantity: string; balanceAfter: string; documentRef: string | null; note: string | null; occurredAt: string }

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
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [loc, setLoc] = useState('');
  const [txn, setTxn] = useState<{ balance: Balance; mode: 'IN' | 'OUT' | 'ADJUST' } | null>(null);
  const [ledger, setLedger] = useState<Balance | null>(null);
  const [creatingLoc, setCreatingLoc] = useState(false);
  const canManage = hasRole('BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN');
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
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setLedger(r); }} title="Sổ kho"><Icon name="clipboard" size={14} /></button>
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
        {canManage && <button className="btn" onClick={() => setCreatingLoc(true)}><Icon name="plus" size={15} /> Tạo kho</button>}
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
      {ledger && <LedgerModal balance={ledger} onClose={() => setLedger(null)} />}
      {creatingLoc && <CreateLocationModal onClose={() => setCreatingLoc(false)} onDone={() => { setCreatingLoc(false); qc.invalidateQueries({ queryKey: ['storage-locations'] }); }} />}
    </>
  );
}

// C5 — Sổ kho bất biến (M06/UC-08): bút toán append-only, chỉ đọc.
function LedgerModal({ balance, onClose }: { balance: Balance; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['ledger', balance.materialId, balance.storageLocationId],
    queryFn: async () => (await api.get('/inventory/transactions', { params: { materialId: balance.materialId, storageLocationId: balance.storageLocationId, size: 100 } })).data as { data: Txn[] },
  });
  const columns: Column<Txn>[] = [
    { key: 'time', header: 'Thời điểm', render: (t) => dateTime(t.occurredAt), mono: true },
    { key: 'type', header: 'Loại', render: (t) => <TxnType type={t.type} /> },
    { key: 'qty', header: 'Số lượng', render: (t) => num(t.quantity), align: 'right', mono: true },
    { key: 'bal', header: 'Tồn sau', render: (t) => num(t.balanceAfter), align: 'right', mono: true },
    { key: 'note', header: 'Chứng từ / ghi chú', render: (t) => t.documentRef ?? t.note ?? '—' },
  ];
  return (
    <Modal open title={`Sổ kho · ${balance.materialName} @ ${balance.locationName}`} onClose={onClose} width={720}>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={13} /> Bút toán bất biến (append-only) — không sửa/xóa; điều chỉnh bằng bút toán mới.</p>
      {q.isError ? <ErrorState error={q.error} /> : <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(t) => t.id} emptyTitle="Chưa có bút toán" />}
    </Modal>
  );
}

function TxnType({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    IN: { label: 'Nhập', color: 'var(--ok-fg)' },
    OUT: { label: 'Xuất', color: 'var(--danger-fg)' },
    ADJUST: { label: 'Điều chỉnh', color: 'var(--info-fg)' },
  };
  const m = map[type] ?? { label: type, color: 'var(--color-text)' };
  return <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>;
}

function CreateLocationModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const type = useCatalog('storage-location-type');
  const [f, setF] = useState({ code: '', name: '', type: '' });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: async () => api.post('/inventory/storage-locations', { code: f.code, name: f.name, type: f.type || undefined }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Tạo kho / địa điểm lưu giữ" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Mã kho</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="KHO-A01" /></div>
        <div><label className="field-label">Tên kho</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div><label className="field-label">Loại kho</label><select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}><option value="">—</option>{type.items.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.code.length < 2 || f.name.length < 2 || create.isPending} onClick={() => create.mutate()}>Tạo kho</button></div>
      </div>
    </Modal>
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
