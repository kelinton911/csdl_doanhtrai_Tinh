import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  searchCatalog,
  useChangeRequests,
  useTemporaries,
  type CatalogItem,
} from '../lib/catalog';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';

// SCR-DT01-05 — Hàng chờ chuẩn hóa: mã tạm chờ ánh xạ + đề nghị chờ xử lý.
export function CatalogQueuePage() {
  const qc = useQueryClient();
  const temps = useTemporaries('PENDING_MAPPING');
  const requests = useChangeRequests('SUBMITTED');
  const [creating, setCreating] = useState(false);
  const [mapping, setMapping] = useState<{ id: string; code: string } | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="DT-01 · Hàng chờ chuẩn hóa"
        title="Chuẩn hóa dữ liệu"
        description="Mã tạm chờ ánh xạ về mã chính thức và các đề nghị bổ sung đang chờ xử lý."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn btn-ghost btn-sm" to="/catalog"><Icon name="chevron" size={15} /> Về danh mục</Link>
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Tạo mã tạm</button>
          </div>
        }
      />

      {/* Mã tạm */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Mã tạm chờ ánh xạ</h2>
      {temps.isLoading ? <Skeleton rows={4} /> : temps.isError ? <ErrorState error={temps.error} /> :
        !temps.data?.data.length ? <EmptyState icon="check" title="Không còn mã tạm chờ" /> : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                <th style={{ padding: '8px 12px' }}>Mã tạm</th><th>Tên hiển thị</th><th>Trạng thái</th><th></th>
              </tr></thead>
              <tbody>
                {temps.data.data.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '8px 12px' }} className="num">{t.temporaryCode}</td>
                    <td>{t.displayName}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setMapping({ id: t.id, code: t.temporaryCode })}>
                        <Icon name="refresh" size={14} /> Ánh xạ mã chính thức
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Đề nghị chờ */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Đề nghị bổ sung đang chờ</h2>
      {requests.isLoading ? <Skeleton rows={4} /> : requests.isError ? <ErrorState error={requests.error} /> :
        !requests.data?.data.length ? <EmptyState icon="clipboard" title="Không có đề nghị chờ" hint="Các đề nghị đã gửi sẽ xuất hiện ở đây." /> : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                <th style={{ padding: '8px 12px' }}>Mã đề nghị</th><th>Tên đề nghị</th><th>Trạng thái</th>
              </tr></thead>
              <tbody>
                {requests.data.data.map((cr) => (
                  <tr key={cr.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '8px 12px' }} className="num">{cr.requestCode}</td>
                    <td>{cr.proposedName}</td>
                    <td><StatusBadge status={cr.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {creating && <CreateTempModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['catalog', 'temporaries'] }); }} />}
      {mapping && <AssignModal temp={mapping} onClose={() => setMapping(null)} onDone={() => { setMapping(null); qc.invalidateQueries({ queryKey: ['catalog', 'temporaries'] }); }} />}
    </div>
  );
}

function CreateTempModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('TEMP-DT-');
  const [name, setName] = useState('');
  // BR-DT01-006: chặn ngay trên client (backend vẫn cưỡng chế).
  const isR00 = /^\s*r00/i.test(code);

  const mut = useMutation({
    mutationFn: async () => api.post('/catalog/temporary-materials', { temporaryCode: code, displayName: name }),
    onSuccess: () => { toast.success('Đã tạo mã tạm.'); onDone(); },
    onError: (e) => toast.problem(e, 'Tạo mã tạm thất bại'),
  });

  return (
    <Modal open title="Tạo mã tạm" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!isR00) mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Mã tạm *</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
          {isR00 && <span style={{ color: 'var(--danger-fg)', fontSize: 12 }}>Mã tạm không được bắt đầu bằng “R00” (BR-DT01-006).</span>}
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Tên hiển thị *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || isR00 || !name.trim()}>Tạo</button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ temp, onClose, onDone }: { temp: { id: string; code: string }; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  const results = useQuery({
    enabled: q.trim().length > 1,
    queryKey: ['catalog', 'assign-search', q],
    queryFn: async () => (await searchCatalog(q.trim())).items,
  });

  const mut = useMutation({
    mutationFn: async () => api.post(`/catalog/temporary-materials/${temp.id}/assign-official-code`, { officialMaterialId: picked!.id }),
    onSuccess: () => { toast.success('Đã ánh xạ mã tạm về mã chính thức.'); onDone(); },
    onError: (e) => toast.problem(e, 'Ánh xạ thất bại'),
  });

  return (
    <Modal open title={`Ánh xạ ${temp.code} → mã chính thức`} onClose={onClose} width={560}>
      <div style={{ display: 'grid', gap: 12 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Tìm mã chính thức theo mã/tên…" autoFocus />
        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
          {results.isLoading ? <div style={{ padding: 12 }}><Skeleton rows={3} /></div> :
            !results.data?.length ? <div className="muted" style={{ padding: 12, fontSize: 13 }}>{q.trim().length > 1 ? 'Không có kết quả.' : 'Nhập ≥ 2 ký tự để tìm.'}</div> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 6 }}>
                {results.data.map((it) => (
                  <li key={it.id}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', background: picked?.id === it.id ? 'var(--color-accent-100, #e6eff7)' : undefined }}
                      onClick={() => setPicked(it)}
                    >
                      <span className="num" style={{ minWidth: 90, color: 'var(--color-neutral-600)' }}>{it.code}</span> {it.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>{picked ? <>Đã chọn: <b className="num">{picked.code}</b></> : 'Chọn một mã chính thức'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={!picked || mut.isPending} onClick={() => mut.mutate()}>Ánh xạ</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
