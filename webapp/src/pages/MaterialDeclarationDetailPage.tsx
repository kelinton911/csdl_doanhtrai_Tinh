import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState } from '../components/States';
import { useAuth } from '../lib/auth';
import {
  RESERVE_PURPOSE_LABEL,
  useAmendments,
  useDeclaration,
  type AmendmentRequest,
} from '../lib/materialDeclarations';

const EDITABLE = ['DRAFT', 'CHANGES_REQUESTED'];
const DECLARERS = ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'COMMUNE_USER', 'UNIT_USER'];
const APPROVERS = ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'REVIEWER'];

export function MaterialDeclarationDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const detail = useDeclaration(id);
  const amendments = useAmendments(id);
  const decl = detail.data;
  const [amendOpen, setAmendOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const canDeclare = hasRole(...DECLARERS);
  const canApprove = hasRole(...APPROVERS);
  const editable = decl ? EDITABLE.includes(decl.workflowStatus) : false;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['material-declarations'] });
    qc.invalidateQueries({ queryKey: ['material-declarations', id] });
    qc.invalidateQueries({ queryKey: ['material-declarations', id, 'amendments'] });
  };

  const act = useMutation({
    mutationFn: async (path: string) => api.post(`/material-declarations/${id}/${path}`, {}),
    onSuccess: () => { toast.success('Đã cập nhật.'); invalidate(); },
    onError: (e) => toast.problem(e, 'Thao tác thất bại'),
  });

  const amendAct = useMutation({
    mutationFn: async ({ rid, path }: { rid: string; path: string }) =>
      api.post(`/material-declarations/amendment-requests/${rid}/${path}`, {}),
    onSuccess: () => { toast.success('Đã cập nhật đề nghị.'); invalidate(); },
    onError: (e) => toast.problem(e, 'Thao tác thất bại'),
  });

  if (detail.isLoading) return <Skeleton rows={6} />;
  if (detail.isError || !decl) return <ErrorState error={detail.error} />;

  return (
    <>
      <PageHeader
        eyebrow="Khai báo vật chất"
        title={decl.title}
        description={`Mã: ${decl.code}${decl.periodLabel ? ` · Kỳ: ${decl.periodLabel}` : ''}`}
        actions={<>
          <StatusBadge status={decl.workflowStatus} />
          {canDeclare && editable && (
            <button className="btn btn-ghost" onClick={() => nav(`/material-declarations/${id}/edit`)}><Icon name="edit" size={15} /> Sửa</button>
          )}
          {canApprove && decl.workflowStatus === 'PENDING_REVIEW' && (
            <>
              <button className="btn btn-ghost" disabled={act.isPending} onClick={() => act.mutate('request-changes')}>Trả lại</button>
              <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('approve')}><Icon name="check" size={15} /> Duyệt</button>
            </>
          )}
          {decl.workflowStatus === 'APPROVED' && (canDeclare || canApprove) && (
            <button className="btn" onClick={() => setSyncOpen(true)}><Icon name="box" size={15} /> Đồng bộ tồn kho</button>
          )}
          {canDeclare && decl.workflowStatus === 'APPROVED' && (
            <button className="btn btn-primary" onClick={() => setAmendOpen(true)}><Icon name="edit" size={15} /> Đề nghị sửa</button>
          )}
        </>}
      />

      {/* Dòng vật chất */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-neutral-200)' }}><b>Dòng vật chất ({decl.lines.length})</b></div>
        {decl.lines.length === 0 ? (
          <div className="muted" style={{ padding: 16, fontSize: 13 }}>Chưa có dòng vật chất.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
              <th style={{ padding: '8px 12px' }}>Vật chất</th><th>Mục đích</th><th style={{ textAlign: 'right' }}>Số lượng</th><th style={{ textAlign: 'right' }}>C1–C5</th>
            </tr></thead>
            <tbody>
              {decl.lines.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                  <td style={{ padding: '8px 12px' }}>{l.aliasUsed ?? l.materialCatalogId}</td>
                  <td>{RESERVE_PURPOSE_LABEL[l.reservePurpose] ?? l.reservePurpose}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{Number(l.quantity).toLocaleString('vi-VN')}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{[l.qtyGrade1, l.qtyGrade2, l.qtyGrade3, l.qtyGrade4, l.qtyGrade5].map((g) => Number(g)).join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Đề nghị sửa */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-neutral-200)' }}><b>Đề nghị sửa ({amendments.data?.length ?? 0})</b></div>
        {!amendments.data?.length ? (
          <div className="muted" style={{ padding: 16, fontSize: 13 }}>Chưa có đề nghị sửa. Khi bản khai báo đã duyệt, đơn vị có thể đề nghị cấp trên cho sửa (kèm minh chứng).</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
              <th style={{ padding: '8px 12px' }}>Nội dung sửa</th><th>Lý do</th><th>Minh chứng</th><th>Trạng thái</th><th></th>
            </tr></thead>
            <tbody>
              {amendments.data.map((a: AmendmentRequest) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--color-neutral-200)', verticalAlign: 'top' }}>
                  <td style={{ padding: '8px 12px', maxWidth: 260 }}>{a.requestedChanges}</td>
                  <td style={{ maxWidth: 220 }}>{a.reason}</td>
                  <td className="num">{a.evidenceDocumentIds?.length ?? 0}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    {canDeclare && a.status === 'DRAFT' && (
                      <button className="btn btn-ghost btn-sm" disabled={amendAct.isPending} onClick={() => amendAct.mutate({ rid: a.id, path: 'submit' })}>Gửi</button>
                    )}
                    {canApprove && a.status === 'PENDING_REVIEW' && (
                      <>
                        <button className="btn btn-ghost btn-sm" disabled={amendAct.isPending} onClick={() => amendAct.mutate({ rid: a.id, path: 'reject' })}>Từ chối</button>
                        <button className="btn btn-ghost btn-sm" disabled={amendAct.isPending} onClick={() => amendAct.mutate({ rid: a.id, path: 'approve' })}>Duyệt (mở khóa)</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {amendOpen && id && (
        <AmendmentModal declarationId={id} onClose={() => setAmendOpen(false)} onDone={() => { setAmendOpen(false); invalidate(); }} />
      )}
      {syncOpen && (
        <SyncInventoryModal declarationId={id!} onClose={() => setSyncOpen(false)} onDone={() => { setSyncOpen(false); invalidate(); }} />
      )}
    </>
  );
}

// Tạo đề nghị sửa: nội dung sửa + lý do + minh chứng (upload MinIO qua /files).
function AmendmentModal({ declarationId, onClose, onDone }: { declarationId: string; onClose: () => void; onDone: () => void }) {
  const [requestedChanges, setChanges] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const mut = useMutation({
    mutationFn: async () => {
      // Upload minh chứng trước (nếu có) → thu thập documents.id.
      const evidenceDocumentIds: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('entityType', 'material_declaration');
        fd.append('entityId', declarationId);
        const res = await api.post('/files', fd);
        if (res.data?.id) evidenceDocumentIds.push(res.data.id);
      }
      return api.post(`/material-declarations/${declarationId}/amendment-requests`, {
        requestedChanges,
        reason,
        evidenceDocumentIds,
      });
    },
    onSuccess: () => { toast.success('Đã tạo đề nghị sửa (nháp). Bấm "Gửi" để trình cấp trên.'); onDone(); },
    onError: (e) => toast.problem(e, 'Tạo đề nghị thất bại'),
  });

  return (
    <Modal open title="Đề nghị cấp trên cho sửa" onClose={onClose} width={560}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Nội dung cần sửa *</span>
          <textarea value={requestedChanges} onChange={(e) => setChanges(e.target.value)} rows={2} required placeholder="VD: Sửa số lượng dòng gạo từ 100 → 120" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Lý do sửa *</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required placeholder="VD: Sai lệch do kiểm kê lại kho" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Minh chứng (tùy chọn, có thể chọn nhiều tệp)</span>
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {files.length > 0 && <span className="muted" style={{ fontSize: 12 }}>{files.length} tệp đã chọn</span>}
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || requestedChanges.trim().length < 3 || reason.trim().length < 3}>Tạo đề nghị</button>
        </div>
      </form>
    </Modal>
  );
}

// P3 "Khai một lần": đồng bộ số cuối kỳ của bản khai đã DUYỆT vào tồn kho (chọn kho hoặc để tự động).
function SyncInventoryModal({ declarationId, onClose, onDone }: { declarationId: string; onClose: () => void; onDone: () => void }) {
  const [loc, setLoc] = useState('');
  const locs = useQuery({
    queryKey: ['storage-locations', 'sync'],
    queryFn: async () => (await api.get('/inventory/storage-locations', { params: { size: 200 } })).data as { data: Array<{ id: string; name: string; barracksName?: string | null }> },
  });
  const mut = useMutation({
    mutationFn: async () => (await api.post(`/material-declarations/${declarationId}/sync-inventory`, { storageLocationId: loc || undefined })).data as { synced: number },
    onSuccess: (r) => { toast.success(`Đã đồng bộ ${r.synced} mã vào tồn kho.`); onDone(); },
    onError: (e) => toast.problem(e, 'Đồng bộ thất bại'),
  });
  return (
    <Modal open title="Đồng bộ tồn kho từ bản khai" onClose={onClose} width={520}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Ghi số <b>cuối kỳ</b> của từng dòng vào tồn kho (bút toán điều chỉnh, có vết). Để trống kho = tự chọn kho gắn bản khai/doanh trại.</p>
      <label className="field-label">Kho đích</label>
      <select className="input" value={loc} onChange={(e) => setLoc(e.target.value)}>
        <option value="">— Tự động (theo bản khai/doanh trại) —</option>
        {(locs.data?.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}{l.barracksName ? ` · ${l.barracksName}` : ''}</option>)}
      </select>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}><Icon name="box" size={14} /> {mut.isPending ? 'Đang đồng bộ…' : 'Đồng bộ'}</button>
      </div>
    </Modal>
  );
}
