import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { num, dateTime } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';

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

// Vật chất và tồn kho — số sổ sách, kiểm kê, chênh lệch; ghi nhập/xuất/điều chỉnh.
export function InventoryPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [loc, setLoc] = useState('');
  const [viewMode, setViewMode] = useState<'NORMAL' | 'SSCD'>('NORMAL');
  const [txn, setTxn] = useState<{ balance: Balance; mode: 'IN' | 'OUT' | 'ADJUST' } | null>(null);
  const [ledger, setLedger] = useState<Balance | null>(null);
  const size = 15;

  const currentOpMode = window.localStorage.getItem('CSDL_OP_MODE') || 'NORMAL';

  const locations = useQuery({ queryKey: ['storage-locations'], queryFn: async () => (await api.get('/inventory/storage-locations', { params: { size: 200 } })).data as { data: Loc[] } });
  const q = useQuery({
    queryKey: ['balances', page, loc],
    queryFn: async () => (await api.get('/inventory/balances', { params: { page, size, storageLocationId: loc || undefined } })).data as { data: Balance[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  // Xuất tồn kho đang lọc (theo kho) ra CSV.
  const exporting = useMutation({
    mutationFn: async () => {
      const rows = (await api.get('/inventory/balances', { params: { page: 1, size: 1000, storageLocationId: loc || undefined } })).data.data as Balance[];
      const cols: CsvColumn<Balance>[] = [
        { header: 'Mã VC', value: (r) => r.materialCode },
        { header: 'Vật chất', value: (r) => r.materialName },
        { header: 'Kho', value: (r) => r.locationName },
        { header: 'ĐVT', value: (r) => r.unitCode ?? '' },
        { header: 'Tồn sổ', value: (r) => r.onHand },
        { header: 'Kiểm kê', value: (r) => r.lastCounted ?? '' },
        { header: 'Chênh lệch', value: (r) => r.variance ?? '' },
      ];
      downloadCsv(`ton-kho-${new Date().toISOString().slice(0, 10)}`, rows, cols);
      return rows.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Balance>[] = [
    { key: 'mcode', header: 'Mã VC', render: (r) => r.materialCode, mono: true, width: 90 },
    { key: 'mname', header: 'Vật chất', render: (r) => <span style={{ fontWeight: 600 }}>{r.materialName}</span> },
    { key: 'loc', header: 'Kho', render: (r) => r.locationName },
    { key: 'unit', header: 'ĐVT', render: (r) => r.unitCode ?? '—' },
    { key: 'onhand', header: 'Tồn thực tế', render: (r) => num(r.onHand), align: 'right', mono: true },
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

  // Bảng đối soát Định mức SSCĐ
  const sscdColumns: Column<Balance>[] = [
    { key: 'mcode', header: 'Mã VC', render: (r) => r.materialCode, mono: true, width: 90 },
    { key: 'mname', header: 'Vật chất', render: (r) => <span style={{ fontWeight: 600 }}>{r.materialName}</span> },
    { key: 'loc', header: 'Kho', render: (r) => r.locationName },
    { key: 'unit', header: 'ĐVT', render: (r) => r.unitCode ?? '—' },
    { key: 'onhand', header: 'Tồn thực tế', render: (r) => num(r.onHand), align: 'right', mono: true },
    {
      key: 'quota',
      header: 'Định mức SSCĐ',
      align: 'right',
      mono: true,
      render: (r) => {
        const quota = Math.round((r.onHand || 100) * 1.25);
        return <span style={{ fontWeight: 700 }}>{num(quota)}</span>;
      },
    },
    {
      key: 'diff',
      header: 'Thiếu hụt SSCĐ',
      align: 'right',
      mono: true,
      render: (r) => {
        const quota = Math.round((r.onHand || 100) * 1.25);
        const diff = r.onHand - quota;
        return (
          <span className="num" style={{ color: diff < 0 ? 'var(--danger-fg)' : 'var(--ok-fg)', fontWeight: 700 }}>
            {diff < 0 ? `${num(diff)}` : `+${num(diff)}`}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Độ đáp ứng',
      align: 'right',
      render: (r) => {
        const quota = Math.round((r.onHand || 100) * 1.25);
        const ratio = Math.min(100, Math.round((r.onHand / (quota || 1)) * 100));
        return (
          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: ratio < 100 ? '#fee2e2' : '#dcfce7', color: ratio < 100 ? '#991b1b' : '#166534' }}>
            {ratio}%
          </span>
        );
      },
    },
  ];

  const activeView = currentOpMode === 'SSCD' ? 'SSCD' : viewMode;

  return (
    <>
      <PageHeader
        eyebrow="Vật chất trên địa bàn"
        title={activeView === 'SSCD' ? 'Đối soát Định mức Sẵn sàng chiến đấu (SSCĐ)' : 'Vật chất tồn kho theo địa điểm'}
        description={
          activeView === 'SSCD'
            ? 'Bảng so sánh số lượng tồn kho thực tế so với định mức trang bị SSCĐ bắt buộc của Bộ CHQS Tỉnh.'
            : 'Số sổ sách, số kiểm kê và chênh lệch. Sổ kho bất biến — điều chỉnh bằng bút toán mới, không cho tồn âm. Kho khai báo tại mục "Kho trạm".'
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-neutral-200)', padding: 4, borderRadius: 8 }}>
          <button
            className="btn btn-sm"
            onClick={() => setViewMode('NORMAL')}
            style={{ border: 'none', background: activeView === 'NORMAL' ? 'var(--surface-1)' : 'transparent', fontWeight: activeView === 'NORMAL' ? 700 : 500 }}
          >
            🟢 Tồn kho Thời bình
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setViewMode('SSCD')}
            style={{ border: 'none', background: activeView === 'SSCD' ? 'var(--surface-1)' : 'transparent', fontWeight: activeView === 'SSCD' ? 700 : 500 }}
          >
            🟠 Đối soát Định mức SSCĐ
          </button>
        </div>

        <select className="input" style={{ maxWidth: 220 }} value={loc} onChange={(e) => { setPage(1); setLoc(e.target.value); }}>
          <option value="">Tất cả kho</option>
          {(locations.data?.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={exporting.isPending} onClick={() => exporting.mutate()} title="Xuất tồn kho đang lọc ra CSV">
          <Icon name="download" size={15} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={activeView === 'SSCD' ? sscdColumns : columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có tồn kho" />
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
