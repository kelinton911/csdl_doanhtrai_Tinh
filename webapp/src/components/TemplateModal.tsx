import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { Modal } from './Modal';
import { Icon } from './Icon';

// Biểu mẫu định mức: lưu bộ mã vật chất đang có thành biểu mẫu, hoặc áp dụng biểu mẫu (nạp thành dòng).
type TemplateItem = { materialCatalogId: string; label: string };
type Template = { id: string; name: string; note: string | null; items: TemplateItem[] };

export function TemplateModal({
  currentItems,
  onApply,
  onClose,
}: {
  currentItems: TemplateItem[];
  onApply: (items: { id: string; label: string }[]) => number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const list = useQuery({
    queryKey: ['decl-templates'],
    queryFn: async () => (await api.get<Template[]>('/material-declarations/templates')).data,
  });
  const create = useMutation({
    mutationFn: async () => api.post('/material-declarations/templates', { name: name.trim(), items: currentItems }),
    onSuccess: () => { toast.success('Đã lưu biểu mẫu.'); setName(''); qc.invalidateQueries({ queryKey: ['decl-templates'] }); },
    onError: (e) => toast.problem(e, 'Lưu biểu mẫu thất bại'),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/material-declarations/templates/${id}`),
    onSuccess: () => { toast.success('Đã xóa biểu mẫu.'); qc.invalidateQueries({ queryKey: ['decl-templates'] }); },
    onError: (e) => toast.problem(e),
  });
  const apply = (t: Template) => {
    const n = onApply(t.items.map((i) => ({ id: i.materialCatalogId, label: i.label })));
    toast.success(`Đã nạp ${n} dòng từ biểu mẫu "${t.name}"${n < t.items.length ? ` (bỏ ${t.items.length - n} trùng)` : ''}.`);
    onClose();
  };

  return (
    <Modal open title="Biểu mẫu định mức vật chất" onClose={onClose} width={540}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Áp dụng biểu mẫu có sẵn</div>
      <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.isLoading ? (
          <div className="muted" style={{ padding: 10, fontSize: 13 }}>Đang tải…</div>
        ) : !list.data?.length ? (
          <div className="muted" style={{ padding: 10, fontSize: 13 }}>Chưa có biểu mẫu nào. Hãy lưu bộ mã hiện tại thành biểu mẫu ở dưới.</div>
        ) : (
          list.data.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                <div className="muted num" style={{ fontSize: 11 }}>{t.items.length} mã vật chất</div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => apply(t)}><Icon name="plus" size={13} /> Áp dụng</button>
              <button className="btn btn-sm btn-ghost" title="Xóa biểu mẫu" disabled={del.isPending} onClick={() => del.mutate(t.id)}>✕</button>
            </div>
          ))
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--color-neutral-200)', marginTop: 14, paddingTop: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Lưu bộ mã hiện tại thành biểu mẫu ({currentItems.length} mã)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên biểu mẫu (VD: Định mức doanh cụ đại đội)" />
          <button className="btn btn-primary" disabled={name.trim().length < 2 || currentItems.length === 0 || create.isPending} onClick={() => create.mutate()}>
            <Icon name="check" size={14} /> Lưu biểu mẫu
          </button>
        </div>
        {currentItems.length === 0 && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Lưới chưa có dòng nào đã chọn vật chất để lưu.</p>}
      </div>
    </Modal>
  );
}
