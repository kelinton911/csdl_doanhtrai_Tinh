import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { MaterialPicker } from '../components/MaterialPicker';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import {
  RESERVE_PURPOSE_LABEL,
  useDeclaration,
  type DeclarationLine,
} from '../lib/materialDeclarations';

const EDITABLE = ['DRAFT', 'CHANGES_REQUESTED'];

// Tạo/sửa bản khai báo vật chất + CRUD dòng (theo danh mục chuẩn) + gửi duyệt.
export function MaterialDeclarationFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const detail = useDeclaration(id);
  const decl = detail.data;
  const editable = !isEdit || (decl ? EDITABLE.includes(decl.workflowStatus) : false);

  const [title, setTitle] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [note, setNote] = useState('');
  const [lineModal, setLineModal] = useState<DeclarationLine | 'new' | null>(null);

  useEffect(() => {
    if (decl) {
      setTitle(decl.title);
      setPeriodLabel(decl.periodLabel ?? '');
      setNote(decl.note ?? '');
    }
  }, [decl]);

  const saveHeader = useMutation({
    mutationFn: async () => {
      const body = { title, periodLabel: periodLabel || undefined, note: note || undefined };
      if (isEdit) return (await api.put(`/material-declarations/${id}`, body)).data;
      return (await api.post('/material-declarations', body)).data;
    },
    onSuccess: (d: { id: string }) => {
      toast.success('Đã lưu bản khai báo.');
      qc.invalidateQueries({ queryKey: ['material-declarations'] });
      if (!isEdit) nav(`/material-declarations/${d.id}/edit`);
    },
    onError: (e) => toast.problem(e, 'Lưu thất bại'),
  });

  const deleteLine = useMutation({
    mutationFn: async (lineId: string) => api.delete(`/material-declarations/lines/${lineId}`),
    onSuccess: () => { toast.success('Đã xóa dòng.'); qc.invalidateQueries({ queryKey: ['material-declarations', id] }); },
    onError: (e) => toast.problem(e, 'Xóa dòng thất bại'),
  });

  const submit = useMutation({
    mutationFn: async () => api.post(`/material-declarations/${id}/submit`, {}),
    onSuccess: () => { toast.success('Đã gửi duyệt.'); qc.invalidateQueries({ queryKey: ['material-declarations'] }); nav(`/material-declarations/${id}`); },
    onError: (e) => toast.problem(e, 'Gửi duyệt thất bại'),
  });

  if (isEdit && detail.isLoading) return <Skeleton rows={6} />;

  return (
    <>
      <PageHeader
        eyebrow="Khai báo vật chất"
        title={isEdit ? `Sửa: ${decl?.title ?? ''}` : 'Tạo bản khai báo mới'}
        description="Chọn vật chất theo danh mục chuẩn (có thể gõ tên gọi khác). Toàn quyền nhập/sửa/xóa khi chưa duyệt."
        actions={<>
          {decl && <StatusBadge status={decl.workflowStatus} />}
          <button className="btn btn-ghost" onClick={() => nav(isEdit ? `/material-declarations/${id}` : '/material-declarations')}>Đóng</button>
        </>}
      />

      {isEdit && decl && !editable && (
        <div className="panel" style={{ padding: 12, marginBottom: 16, color: 'var(--danger-fg)' }}>
          Bản khai báo đang ở trạng thái <b>{decl.workflowStatus}</b> — đã khóa, không sửa trực tiếp được.
          Vào <button className="btn btn-ghost btn-sm" onClick={() => nav(`/material-declarations/${id}`)}>trang chi tiết</button> để đề nghị cấp trên cho sửa.
        </div>
      )}

      {/* Thông tin chung */}
      <div className="panel" style={{ padding: 14, marginBottom: 16, display: 'grid', gap: 12, maxWidth: 640 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Tên bản khai báo *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} placeholder="VD: Khai báo vật chất Quý I/2026" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Kỳ khai báo</span>
          <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} disabled={!editable} placeholder="VD: Quý I/2026" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ghi chú</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} rows={2} />
        </label>
        {editable && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={saveHeader.isPending || title.trim().length < 3} onClick={() => saveHeader.mutate()}>
              {isEdit ? 'Lưu thay đổi' : 'Lưu nháp'}
            </button>
          </div>
        )}
      </div>

      {/* Dòng vật chất — chỉ khi đã có bản khai báo */}
      {isEdit && decl && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--color-neutral-200)' }}>
            <b>Dòng vật chất ({decl.lines.length})</b>
            {editable && <button className="btn btn-primary btn-sm" onClick={() => setLineModal('new')}><Icon name="plus" size={14} /> Thêm dòng</button>}
          </div>
          {decl.lines.length === 0 ? (
            <div className="muted" style={{ padding: 16, fontSize: 13 }}>Chưa có dòng vật chất. Bấm "Thêm dòng" để khai báo theo danh mục chuẩn.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                <th style={{ padding: '8px 12px' }}>Vật chất</th><th>Mục đích</th><th style={{ textAlign: 'right' }}>Số lượng</th><th style={{ textAlign: 'right' }}>C1–C5</th>{editable && <th></th>}
              </tr></thead>
              <tbody>
                {decl.lines.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '8px 12px' }}>{l.aliasUsed ?? l.materialCatalogId}</td>
                    <td>{RESERVE_PURPOSE_LABEL[l.reservePurpose] ?? l.reservePurpose}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{Number(l.quantity).toLocaleString('vi-VN')}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{[l.qtyGrade1, l.qtyGrade2, l.qtyGrade3, l.qtyGrade4, l.qtyGrade5].map((g) => Number(g)).join('/')}</td>
                    {editable && (
                      <td style={{ textAlign: 'right', padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setLineModal(l)}>Sửa</button>
                        <button className="btn btn-ghost btn-sm" disabled={deleteLine.isPending} onClick={() => deleteLine.mutate(l.id)}>Xóa</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Gửi duyệt */}
      {isEdit && decl && editable && decl.lines.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            <Icon name="check" size={15} /> Gửi duyệt
          </button>
        </div>
      )}

      {lineModal && id && (
        <LineModal
          declarationId={id}
          line={lineModal === 'new' ? null : lineModal}
          onClose={() => setLineModal(null)}
          onDone={() => { setLineModal(null); qc.invalidateQueries({ queryKey: ['material-declarations', id] }); }}
        />
      )}
    </>
  );
}

const PURPOSES = Object.keys(RESERVE_PURPOSE_LABEL);

// Form thêm/sửa một dòng vật chất (chọn theo danh mục chuẩn + chất lượng C1–C5).
function LineModal({ declarationId, line, onClose, onDone }: {
  declarationId: string; line: DeclarationLine | null; onClose: () => void; onDone: () => void;
}) {
  const [matId, setMatId] = useState<string | null>(line?.materialCatalogId ?? null);
  const [matLabel, setMatLabel] = useState<string | null>(line?.aliasUsed ?? null);
  const [reservePurpose, setPurpose] = useState(line?.reservePurpose ?? 'THUONG_XUYEN');
  const [quantity, setQuantity] = useState(line ? String(Number(line.quantity)) : '');
  const [grades, setGrades] = useState<string[]>(
    line ? [line.qtyGrade1, line.qtyGrade2, line.qtyGrade3, line.qtyGrade4, line.qtyGrade5].map((g) => String(Number(g))) : ['', '', '', '', ''],
  );
  const [note, setNote] = useState(line?.note ?? '');

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        materialCatalogId: matId,
        aliasUsed: matLabel ?? undefined,
        reservePurpose,
        quantity: quantity ? Number(quantity) : 0,
        qtyGrade1: Number(grades[0] || 0),
        qtyGrade2: Number(grades[1] || 0),
        qtyGrade3: Number(grades[2] || 0),
        qtyGrade4: Number(grades[3] || 0),
        qtyGrade5: Number(grades[4] || 0),
        note: note || undefined,
      };
      if (line) return api.put(`/material-declarations/lines/${line.id}`, body);
      return api.post(`/material-declarations/${declarationId}/lines`, body);
    },
    onSuccess: () => { toast.success(line ? 'Đã cập nhật dòng.' : 'Đã thêm dòng.'); onDone(); },
    onError: (e) => toast.problem(e, 'Lưu dòng thất bại'),
  });

  return (
    <Modal open title={line ? 'Sửa dòng vật chất' : 'Thêm dòng vật chất'} onClose={onClose} width={560}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Vật chất (danh mục chuẩn) *</span>
          <MaterialPicker value={matId} label={matLabel} onPick={(id2, l) => { setMatId(id2); setMatLabel(l); }} />
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Mục đích dự trữ</span>
          <select value={reservePurpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map((p) => <option key={p} value={p}>{RESERVE_PURPOSE_LABEL[p]}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Số lượng</span>
          <input type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Số lượng theo cấp chất lượng (C1 → C5)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {grades.map((g, i) => (
              <input key={i} type="number" step="0.001" value={g} placeholder={`C${i + 1}`} style={{ width: 84 }}
                onChange={(e) => setGrades((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))} />
            ))}
          </div>
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ghi chú</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !matId}>Lưu</button>
        </div>
      </form>
    </Modal>
  );
}
