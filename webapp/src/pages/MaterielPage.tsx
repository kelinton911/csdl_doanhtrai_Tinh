import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import {
  MOVEMENT_TYPE_LABEL,
  NEXT_MOVEMENT_STATUS,
  fetchHc,
  useMovements,
  type HcResult,
} from '../lib/materiel';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { MaterialPicker } from '../components/MaterialPicker';
import { Icon } from '../components/Icon';

// SCR-DT04-05/10 — Sổ cái thực lực + tra HC theo thời điểm (HC(t) drill-down).
export function MaterielPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const org = profile?.organizationId ?? '';
  const [matId, setMatId] = useState<string | null>(null);
  const [matLabel, setMatLabel] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 16));
  const [hc, setHc] = useState<HcResult | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const movements = useMovements(matId ?? undefined, org || undefined);

  const queryHc = async () => {
    if (!matId) return;
    try { setHc(await fetchHc(matId, new Date(asOf).toISOString(), org || undefined)); }
    catch (e) { toast.problem(e); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="DT-04 · Thực lực vật chất"
        title="Sổ cái thực lực"
        description="Số hiện có (HC) theo bất kỳ thời điểm nào + sổ cái giao dịch bất biến (chỉ POSTED tác động số dư)."
        actions={<button className="btn btn-primary btn-sm" disabled={!matId} onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Tạo giao dịch</button>}
      />

      {/* Chọn vật chất + tra HC */}
      <div className="panel" style={{ padding: 14, marginBottom: 16, display: 'grid', gap: 12 }}>
        <div style={{ maxWidth: 480 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Vật chất</div>
          <MaterialPicker value={matId} label={matLabel} onPick={(id, l) => { setMatId(id); setMatLabel(l); setHc(null); }} />
        </div>
        {matId && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span className="muted">Tại thời điểm (as-of)</span>
              <input type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <button className="btn btn-ghost" onClick={queryHc}><Icon name="target" size={15} /> Tra HC</button>
            {hc && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 12 }}>HC tại {new Date(hc.meta.as_of_time).toLocaleString('vi-VN')}</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{hc.data.hc.toLocaleString('vi-VN')}</div>
                <div className="muted" style={{ fontSize: 11 }}>nguồn: {hc.meta.source}{hc.meta.locked ? ' · đã khóa' : ''}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sổ cái giao dịch */}
      {!matId ? (
        <EmptyState icon="box" title="Chọn vật chất để xem sổ cái" hint="Tra cứu HC và các giao dịch của một mã." />
      ) : movements.isLoading ? <Skeleton rows={6} /> :
        !movements.data?.length ? <EmptyState icon="clipboard" title="Chưa có giao dịch" hint="Tạo giao dịch tiếp nhận/xuất để bắt đầu." /> : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                <th style={{ padding: '8px 12px' }}>Số CT</th><th>Loại</th><th style={{ textAlign: 'right' }}>Số lượng</th><th>Hiệu lực</th><th>Trạng thái</th><th></th>
              </tr></thead>
              <tbody>
                {movements.data.map((m) => <MovementRow key={m.id} m={m} onChanged={() => qc.invalidateQueries({ queryKey: ['materiel', 'movements'] })} />)}
              </tbody>
            </table>
          </div>
        )}

      {createOpen && matId && (
        <CreateMovementModal materialCatalogId={matId} materialLabel={matLabel} organizationId={org}
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['materiel', 'movements'] }); }} />
      )}
    </div>
  );
}

function MovementRow({ m, onChanged }: { m: { id: string; transactionNo: string; transactionType: string; quantitySigned: string; effectiveTime: string; status: string }; onChanged: () => void }) {
  const nexts = NEXT_MOVEMENT_STATUS[m.status] ?? [];
  const act = useMutation({
    mutationFn: async (to: string) => {
      const map: Record<string, string> = { SUBMITTED: 'submit', APPROVED: 'approve', POSTED: 'post', REVERSED: 'reverse' };
      return api.post(`/materiel/movements/${m.id}/${map[to]}`, {});
    },
    onSuccess: () => { toast.success('Đã cập nhật giao dịch.'); onChanged(); },
    onError: (e) => toast.problem(e, 'Thao tác thất bại'),
  });
  const signed = Number(m.quantitySigned);
  return (
    <tr style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
      <td style={{ padding: '8px 12px' }} className="num">{m.transactionNo}</td>
      <td>{MOVEMENT_TYPE_LABEL[m.transactionType] ?? m.transactionType}</td>
      <td className="num" style={{ textAlign: 'right', color: signed >= 0 ? 'var(--ok-fg)' : 'var(--danger-fg)' }}>{signed >= 0 ? '+' : ''}{signed.toLocaleString('vi-VN')}</td>
      <td className="num">{new Date(m.effectiveTime).toLocaleDateString('vi-VN')}</td>
      <td><StatusBadge status={m.status} /></td>
      <td style={{ textAlign: 'right', padding: '8px 12px' }}>
        {nexts.map((to) => (
          <button key={to} className="btn btn-ghost btn-sm" disabled={act.isPending} onClick={() => act.mutate(to)}>
            {to === 'SUBMITTED' ? 'Gửi' : to === 'APPROVED' ? 'Duyệt' : to === 'POSTED' ? 'Ghi sổ' : 'Đảo'}
          </button>
        ))}
      </td>
    </tr>
  );
}

function CreateMovementModal({ materialCatalogId, materialLabel, organizationId, onClose, onDone }: {
  materialCatalogId: string; materialLabel: string | null; organizationId: string; onClose: () => void; onDone: () => void;
}) {
  const [transactionType, setType] = useState('RECEIPT');
  const [quantity, setQuantity] = useState('');
  const [effectiveTime, setEff] = useState(new Date().toISOString().slice(0, 16));
  const mut = useMutation({
    mutationFn: async () => api.post('/materiel/movements', {
      transactionType, materialCatalogId, organizationId, quantity: Number(quantity), effectiveTime: new Date(effectiveTime).toISOString(),
    }),
    onSuccess: () => { toast.success('Đã tạo giao dịch (DRAFT). Gửi → Duyệt → Ghi sổ để tác động HC.'); onDone(); },
    onError: (e) => toast.problem(e, 'Tạo giao dịch thất bại'),
  });
  return (
    <Modal open title="Tạo giao dịch sổ cái" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <div className="muted" style={{ fontSize: 13 }}>Vật chất: <b>{materialLabel}</b></div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Loại giao dịch</span>
          <select value={transactionType} onChange={(e) => setType(e.target.value)}>
            {['RECEIPT', 'ISSUE', 'ADJUSTMENT'].map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Số lượng {transactionType === 'ADJUSTMENT' ? '(âm nếu giảm)' : ''}</span>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required step="0.001" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Thời điểm hiệu lực</span>
          <input type="datetime-local" value={effectiveTime} onChange={(e) => setEff(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !quantity}>Tạo</button>
        </div>
      </form>
    </Modal>
  );
}
