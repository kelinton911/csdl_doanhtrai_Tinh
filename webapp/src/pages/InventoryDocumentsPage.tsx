import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import {
  DOC_ACTIONS,
  DOC_TYPE_LABEL,
  useDocuments,
  useInTransit,
  usePeriods,
  useTrace,
  type InventoryDocument,
} from '../lib/inventoryDocs';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { MaterialPicker } from '../components/MaterialPicker';
import { Icon } from '../components/Icon';

// SCR-DT05-01/07/09/10 — Chứng từ nhập/xuất, duyệt & POST, khóa kỳ, truy vết.
export function InventoryDocumentsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const org = profile?.organizationId ?? '';
  const [statusFilter, setStatusFilter] = useState('');
  const docs = useDocuments(statusFilter, org || undefined);
  const [selected, setSelected] = useState<InventoryDocument | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const invalidateDocs = () => qc.invalidateQueries({ queryKey: ['dt05', 'documents'] });

  return (
    <div>
      <PageHeader
        eyebrow="DT-05 · Nhập–xuất–điều chuyển"
        title="Chứng từ nghiệp vụ"
        description="Lập chứng từ → duyệt → POST nguyên tử sinh giao dịch sổ cái (DT-04). POSTED chỉ sửa qua đảo chứng từ."
        actions={<button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Lập chứng từ</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="panel" style={{ padding: 10, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Trạng thái:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {docs.isLoading ? <Skeleton rows={6} /> :
            !docs.data?.length ? <EmptyState icon="clipboard" title="Chưa có chứng từ" /> : (
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                    <th style={{ padding: '8px 12px' }}>Số CT</th><th>Loại</th><th>Ngày</th><th>Trạng thái</th>
                  </tr></thead>
                  <tbody>
                    {docs.data.map((d) => (
                      <tr key={d.id} onClick={() => setSelected(d)}
                        style={{ borderTop: '1px solid var(--color-neutral-200)', cursor: 'pointer', background: selected?.id === d.id ? 'var(--color-accent-100, #e6eff7)' : undefined }}>
                        <td style={{ padding: '8px 12px' }} className="num">{d.documentNo}</td>
                        <td>{DOC_TYPE_LABEL[d.documentType] ?? d.documentType}</td>
                        <td className="num">{d.effectiveDate}</td>
                        <td><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          <TransferPanel org={org} />
          <PeriodPanel org={org} />
        </div>

        <div>
          {selected ? <DocumentDetail doc={selected} onChanged={() => { invalidateDocs(); }} /> :
            <EmptyState icon="file" title="Chọn một chứng từ" hint="Xem dòng, workflow duyệt/POST, truy vết movement." />}
        </div>
      </div>

      {createOpen && <CreateDocModal org={org} onClose={() => setCreateOpen(false)} onDone={(d) => { setCreateOpen(false); invalidateDocs(); setSelected(d); }} />}
    </div>
  );
}

function DocumentDetail({ doc, onChanged }: { doc: InventoryDocument; onChanged: () => void }) {
  const qc = useQueryClient();
  const trace = useTrace(doc.id);
  const [lineOpen, setLineOpen] = useState(false);
  const actions = DOC_ACTIONS[doc.status] ?? [];

  const act = useMutation({
    mutationFn: async (path: string) => api.post(`/inventory-documents/${doc.id}/${path}`, {}),
    onSuccess: (_r, path) => { toast.success(path === 'post' ? 'Đã ghi sổ (sinh movement).' : 'Đã cập nhật chứng từ.'); onChanged(); qc.invalidateQueries({ queryKey: ['dt05', 'trace', doc.id] }); },
    onError: (e) => toast.problem(e, 'Thao tác thất bại'),
  });

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num" style={{ fontWeight: 800 }}>{doc.documentNo}</span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{DOC_TYPE_LABEL[doc.documentType]} · hiệu lực {doc.effectiveDate}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {doc.status === 'DRAFT' && <button className="btn btn-ghost btn-sm" onClick={() => setLineOpen(true)}><Icon name="plus" size={13} /> Thêm dòng</button>}
          {actions.map((a) => (
            <button key={a.path} className={a.danger ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'} disabled={act.isPending}
              style={a.danger ? { color: 'var(--danger-fg)' } : undefined} onClick={() => act.mutate(a.path)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Dòng chứng từ & truy vết</h4>
        {trace.isLoading ? <Skeleton rows={3} /> :
          !trace.data?.lines.length ? <EmptyState icon="box" title="Chưa có dòng" /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}><th style={{ padding: '4px 6px' }}>#</th><th>Vật chất</th><th style={{ textAlign: 'right' }}>SL</th><th>Movement</th></tr></thead>
              <tbody>
                {trace.data.lines.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '4px 6px' }} className="num">{l.lineNo}</td>
                    <td className="num" style={{ fontSize: 12 }}>{l.materialCatalogId.slice(0, 8)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{Number(l.quantity).toLocaleString('vi-VN')}</td>
                    <td>{l.movementId ? <span style={{ color: 'var(--ok-fg)', fontSize: 12 }}><Icon name="check" size={12} /> {l.movementId.slice(0, 8)}</span> : <span className="muted" style={{ fontSize: 12 }}>chưa POST</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {lineOpen && <AddLineModal docId={doc.id} onClose={() => setLineOpen(false)} onDone={() => { setLineOpen(false); qc.invalidateQueries({ queryKey: ['dt05', 'trace', doc.id] }); }} />}
    </div>
  );
}

function TransferPanel({ org }: { org: string }) {
  const qc = useQueryClient();
  const inTransit = useInTransit();
  const receive = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => api.post(`/transfer-orders/${id}/receive`, { receivedQty: qty }),
    onSuccess: () => { toast.success('Đã nhận điều chuyển.'); qc.invalidateQueries({ queryKey: ['dt05', 'in-transit'] }); },
    onError: (e) => toast.problem(e, 'Nhận thất bại'),
  });
  void org;
  return (
    <section className="panel" style={{ padding: 14, marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Điều chuyển đang trên đường (IN_TRANSIT)</h3>
      {inTransit.isLoading ? <Skeleton rows={2} /> :
        !inTransit.data?.length ? <div className="muted" style={{ fontSize: 13 }}>Không có lệnh đang chuyển.</div> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {inTransit.data.map((t) => (
              <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span className="num">{t.orderNo}</span>
                <StatusBadge status={t.status} />
                <span className="num muted">{Number(t.dispatchedQty ?? 0).toLocaleString('vi-VN')}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => receive.mutate({ id: t.id, qty: Number(t.dispatchedQty ?? 0) })}>Nhận đủ</button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

function PeriodPanel({ org }: { org: string }) {
  const qc = useQueryClient();
  const periods = usePeriods(org || undefined);
  const lock = useMutation({
    mutationFn: async (id: string) => api.post(`/stock-periods/${id}/lock`, {}),
    onSuccess: () => { toast.success('Đã khóa kỳ.'); qc.invalidateQueries({ queryKey: ['dt05', 'periods'] }); },
    onError: (e) => toast.problem(e, 'Khóa kỳ thất bại'),
  });
  return (
    <section className="panel" style={{ padding: 14, marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Kỳ sổ kho (khóa cấm backdate)</h3>
      {periods.isLoading ? <Skeleton rows={2} /> :
        !periods.data?.length ? <div className="muted" style={{ fontSize: 13 }}>Chưa có kỳ.</div> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {periods.data.map((p) => (
              <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span className="num">{p.periodFrom} → {p.periodTo}</span>
                <StatusBadge status={p.status} />
                {p.status !== 'LOCKED' && <button className="btn btn-ghost btn-sm" onClick={() => lock.mutate(p.id)}><Icon name="lock" size={12} /> Khóa</button>}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

function CreateDocModal({ org, onClose, onDone }: { org: string; onClose: () => void; onDone: (d: InventoryDocument) => void }) {
  const [documentType, setType] = useState('RECEIPT');
  const [effectiveDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const mut = useMutation({
    mutationFn: async () => (await api.post<InventoryDocument>('/inventory-documents', { documentType, organizationId: org, effectiveDate })).data,
    onSuccess: (d) => { toast.success('Đã lập chứng từ (DRAFT). Thêm dòng rồi gửi duyệt.'); onDone(d); },
    onError: (e) => toast.problem(e, 'Lập chứng từ thất bại'),
  });
  return (
    <Modal open title="Lập chứng từ" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Loại chứng từ</span>
          <select value={documentType} onChange={(e) => setType(e.target.value)}>
            {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ngày hiệu lực</span>
          <input type="date" value={effectiveDate} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {!org && <div style={{ color: 'var(--warn-fg)', fontSize: 12 }}>Tài khoản chưa gắn đơn vị — chứng từ cần organization_id.</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !org}>Lập</button>
        </div>
      </form>
    </Modal>
  );
}

function AddLineModal({ docId, onClose, onDone }: { docId: string; onClose: () => void; onDone: () => void }) {
  const [matId, setMatId] = useState<string | null>(null);
  const [matLabel, setMatLabel] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const mut = useMutation({
    mutationFn: async () => api.post(`/inventory-documents/${docId}/lines`, { materialCatalogId: matId, quantity: Number(quantity) }),
    onSuccess: () => { toast.success('Đã thêm dòng.'); onDone(); },
    onError: (e) => toast.problem(e, 'Thêm dòng thất bại'),
  });
  return (
    <Modal open title="Thêm dòng chứng từ" onClose={onClose} width={520}>
      <form onSubmit={(e) => { e.preventDefault(); if (matId) mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Vật chất</div>
          <MaterialPicker value={matId} label={matLabel} onPick={(id, l) => { setMatId(id); setMatLabel(l); }} />
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Số lượng</span>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required step="0.001" min={0} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !matId || !quantity}>Thêm</button>
        </div>
      </form>
    </Modal>
  );
}
