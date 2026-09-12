import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { AsyncPicker } from '../components/AsyncPicker';
import { DeclarationGrid } from '../components/DeclarationGrid';
import { ImportLinesModal } from '../components/ImportLinesModal';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { useDeclaration, useDeclarations } from '../lib/materialDeclarations';

const EDITABLE = ['DRAFT', 'CHANGES_REQUESTED'];

interface Org { id: string; name: string }

// Tạo/sửa bản khai báo vật chất: header + lưới nhập dòng (dán Excel) + import/kế thừa/nhân bản + gửi duyệt.
export function MaterialDeclarationFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const barracksIdParam = sp.get('barracksId'); // đến từ trang doanh trại → gắn bản khai vào doanh trại
  const nav = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const detail = useDeclaration(id);
  const decl = detail.data;
  const editable = !isEdit || (decl ? EDITABLE.includes(decl.workflowStatus) : false);

  const [title, setTitle] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [note, setNote] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showCarry, setShowCarry] = useState(false);
  const [showDup, setShowDup] = useState(false);

  useEffect(() => {
    if (decl) {
      setTitle(decl.title);
      setPeriodLabel(decl.periodLabel ?? '');
      setNote(decl.note ?? '');
      setOrganizationId(decl.organizationId ?? '');
      setAreaId(decl.areaId ?? '');
    }
  }, [decl]);

  const orgs = useQuery({ queryKey: ['orgs'], queryFn: async () => (await api.get('/organizations', { params: { size: 200 } })).data as { data: Org[] } });

  const saveHeader = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        periodLabel: periodLabel || undefined,
        note: note || undefined,
        organizationId: organizationId || undefined,
        areaId: areaId || undefined,
      };
      if (isEdit) return (await api.put(`/material-declarations/${id}`, body)).data;
      return (await api.post('/material-declarations', { ...body, barracksId: barracksIdParam || undefined })).data;
    },
    onSuccess: (d: { id: string }) => {
      toast.success('Đã lưu bản khai báo.');
      qc.invalidateQueries({ queryKey: ['material-declarations'] });
      if (!isEdit) nav(`/material-declarations/${d.id}/edit`);
    },
    onError: (e) => toast.problem(e, 'Lưu thất bại'),
  });

  const submit = useMutation({
    mutationFn: async () => api.post(`/material-declarations/${id}/submit`, {}),
    onSuccess: () => { toast.success('Đã gửi duyệt.'); qc.invalidateQueries({ queryKey: ['material-declarations'] }); nav(`/material-declarations/${id}`); },
    onError: (e) => toast.problem(e, 'Gửi duyệt thất bại'),
  });

  if (isEdit && detail.isLoading) return <Skeleton rows={6} />;

  const warnings = decl?.warnings ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Khai báo vật chất"
        title={isEdit ? `Sửa: ${decl?.title ?? ''}` : 'Tạo bản khai báo mới'}
        description="Nhập theo danh mục chuẩn dạng bảng (dán được từ Excel). Toàn quyền nhập/sửa/xóa khi chưa duyệt."
        actions={<>
          {decl && <StatusBadge status={decl.workflowStatus} />}
          {isEdit && decl && <button className="btn btn-ghost btn-sm" onClick={() => setShowDup(true)}><Icon name="clipboard" size={14} /> Nhân bản</button>}
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
      <div className="panel" style={{ padding: 14, marginBottom: 16, display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', maxWidth: 860 }}>
        <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
          <span className="muted" style={{ fontSize: 13 }}>Tên bản khai báo *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} placeholder="VD: Khai báo vật chất Quý I/2026" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Kỳ khai báo</span>
          <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} disabled={!editable} placeholder="VD: Quý I/2026" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Đơn vị khai báo</span>
          <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={!editable}>
            <option value="">— Theo đơn vị của tôi —</option>
            {(orgs.data?.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Địa bàn (xã/phường)</span>
          <AsyncPicker endpoint="/administrative-areas" value={areaId} onChange={setAreaId} params={{ level: 'COMMUNE' }} disabled={!editable} placeholder="Gõ tên/mã xã…" />
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ghi chú</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} />
        </label>
        {editable && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={saveHeader.isPending || title.trim().length < 3} onClick={() => saveHeader.mutate()}>
              {isEdit ? 'Lưu thông tin chung' : 'Lưu nháp & nhập dòng'}
            </button>
          </div>
        )}
      </div>

      {/* Cảnh báo đối chiếu (đã lưu) */}
      {warnings.length > 0 && (
        <div className="panel" style={{ padding: 12, marginBottom: 16, border: '1px solid var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>
          <div style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <Icon name="alert" size={15} /> {warnings.length} dòng có cảnh báo đối chiếu (không chặn gửi duyệt)
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
            {warnings.slice(0, 5).map((w) => <li key={w.lineId}>{w.messages.join('; ')}</li>)}
            {warnings.length > 5 && <li>… và {warnings.length - 5} dòng khác</li>}
          </ul>
        </div>
      )}

      {/* Lưới dòng vật chất — chỉ khi đã có bản khai báo */}
      {isEdit && decl && (
        <div className="panel" style={{ padding: 14 }}>
          {editable && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => setShowImport(true)}><Icon name="upload" size={14} /> Nhập Excel/CSV</button>
              <button className="btn btn-sm" onClick={() => setShowCarry(true)}><Icon name="refresh" size={14} /> Kế thừa kỳ trước</button>
            </div>
          )}
          <DeclarationGrid
            key={decl.updatedAt + String(decl.lines.length)}
            declarationId={decl.id}
            lines={decl.lines}
            editable={editable}
          />
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

      {showImport && id && (
        <ImportLinesModal
          declarationId={id}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); qc.invalidateQueries({ queryKey: ['material-declarations', id] }); }}
        />
      )}
      {showCarry && id && (
        <CarryForwardModal declarationId={id} currentId={id} onClose={() => setShowCarry(false)} onDone={() => { setShowCarry(false); qc.invalidateQueries({ queryKey: ['material-declarations', id] }); }} />
      )}
      {showDup && id && (
        <DuplicateModal declarationId={id} defaultTitle={`${decl?.title ?? ''} (bản sao)`} onClose={() => setShowDup(false)} onDone={(newId) => { setShowDup(false); nav(`/material-declarations/${newId}/edit`); }} />
      )}
    </>
  );
}

// Kế thừa dòng từ một bản khai báo kỳ trước (nên đã duyệt).
function CarryForwardModal({ declarationId, currentId, onClose, onDone }: {
  declarationId: string; currentId: string; onClose: () => void; onDone: () => void;
}) {
  const list = useDeclarations();
  const [sourceId, setSourceId] = useState('');
  const sources = (list.data ?? []).filter((d) => d.id !== currentId);
  const mut = useMutation({
    mutationFn: async () => api.post(`/material-declarations/${declarationId}/carry-forward`, { sourceDeclarationId: sourceId }),
    onSuccess: () => { toast.success('Đã kế thừa dòng từ kỳ trước.'); onDone(); },
    onError: (e) => toast.problem(e, 'Kế thừa thất bại'),
  });
  return (
    <Modal open title="Kế thừa dòng từ kỳ trước" onClose={onClose} width={560}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Chọn bản khai báo nguồn (nên đã DUYỆT). Hệ thống nạp toàn bộ dòng với <b>đầu kỳ = cuối kỳ nguồn</b>, tăng/giảm = 0.
        </p>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">— Chọn bản nguồn —</option>
          {sources.map((d) => <option key={d.id} value={d.id}>{d.title} {d.periodLabel ? `(${d.periodLabel})` : ''} — {d.workflowStatus}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!sourceId || mut.isPending} onClick={() => mut.mutate()}>Kế thừa</button>
        </div>
      </div>
    </Modal>
  );
}

// Nhân bản bản khai báo (tạo DRAFT mới + copy dòng).
function DuplicateModal({ declarationId, defaultTitle, onClose, onDone }: {
  declarationId: string; defaultTitle: string; onClose: () => void; onDone: (newId: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [periodLabel, setPeriodLabel] = useState('');
  const mut = useMutation({
    mutationFn: async () => (await api.post(`/material-declarations/${declarationId}/duplicate`, { title, periodLabel: periodLabel || undefined })).data as { id: string },
    onSuccess: (d) => { toast.success('Đã nhân bản.'); onDone(d.id); },
    onError: (e) => toast.problem(e, 'Nhân bản thất bại'),
  });
  return (
    <Modal open title="Nhân bản bản khai báo" onClose={onClose} width={520}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Tên bản mới *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Kỳ khai báo</span>
          <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="VD: Quý II/2026" />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={title.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>Nhân bản</button>
        </div>
      </div>
    </Modal>
  );
}
