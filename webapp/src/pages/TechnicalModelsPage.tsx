import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  NEXT_REVISION_STATUS,
  REVISION_STATUS_LABEL,
  useCompleteness,
  useRevisions,
  useTechnicalModels,
  type ProductModel,
} from '../lib/technical';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';

// SCR-DT03-01/02/08 — Thư viện mẫu + hồ sơ kỹ thuật (revision + độ đầy đủ).
export function TechnicalModelsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const models = useTechnicalModels(search);
  const [selected, setSelected] = useState<ProductModel | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!selected && models.data?.data.length) setSelected(models.data.data[0]);
  }, [models.data, selected]);

  return (
    <div>
      <PageHeader
        eyebrow="DT-03 · Hồ sơ kỹ thuật"
        title="Thư viện mẫu kỹ thuật"
        description="Mẫu sản phẩm (ký hiệu thiết kế), đời thiết kế (revision), độ đầy đủ hồ sơ."
        actions={<button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Tạo mẫu</button>}
      />

      <div className="panel" style={{ padding: 10, marginBottom: 14, position: 'relative', maxWidth: 360 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mẫu / ký hiệu…" style={{ width: '100%', paddingLeft: 30 }} />
        <span style={{ position: 'absolute', left: 18, top: 17, color: 'var(--color-neutral-500)' }}><Icon name="search" size={15} /></span>
      </div>

      {models.isLoading ? <Skeleton rows={8} /> : models.isError ? <ErrorState error={models.error} /> :
        !models.data?.data.length ? <EmptyState icon="clipboard" title="Chưa có mẫu kỹ thuật" hint="Tạo mẫu hoặc chạy seed:technical-dt03." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: 16, alignItems: 'start' }}>
            <div className="panel" style={{ padding: 6, maxHeight: '70vh', overflow: 'auto' }}>
              {models.data.data.map((m) => (
                <button key={m.id} onClick={() => setSelected(m)}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', background: selected?.id === m.id ? 'var(--color-accent-100, #e6eff7)' : undefined, marginBottom: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="num" style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{m.designSymbol ?? m.modelCodeInternal}</span>
                    <span style={{ fontSize: 13.5 }}>{m.modelName}</span>
                  </div>
                </button>
              ))}
            </div>
            {selected ? <ModelDetail model={selected} qc={qc} /> : <EmptyState icon="box" title="Chọn một mẫu" />}
          </div>
        )}

      {createOpen && <CreateModelModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['technical', 'models'] }); }} />}
    </div>
  );
}

function ModelDetail({ model, qc }: { model: ProductModel; qc: ReturnType<typeof useQueryClient> }) {
  const revisions = useRevisions(model.id);
  const [revOpen, setRevOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['technical', 'revisions', model.id] });
    qc.invalidateQueries({ queryKey: ['technical', 'completeness'] });
  };

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-neutral-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num" style={{ fontSize: 14, fontWeight: 800 }}>{model.designSymbol ?? model.modelCodeInternal}</span>
          <StatusBadge status={model.status} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{model.modelName}</div>
        {model.technologyGroup && <div className="muted" style={{ fontSize: 13 }}>{model.technologyGroup}{model.designYear ? ` · ${model.designYear}` : ''}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-neutral-200)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Đời thiết kế (revision)</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setRevOpen(true)}><Icon name="plus" size={14} /> Tạo revision</button>
      </div>
      <div style={{ padding: 12 }}>
        {revisions.isLoading ? <Skeleton rows={3} /> :
          !revisions.data?.length ? <EmptyState icon="file" title="Chưa có revision" /> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {revisions.data.map((r) => <RevisionRow key={r.id} rev={r} onChanged={invalidate} />)}
            </ul>
          )}
      </div>
      {revOpen && <CreateRevisionModal modelId={model.id} onClose={() => setRevOpen(false)} onDone={() => { setRevOpen(false); invalidate(); }} />}
    </div>
  );
}

function RevisionRow({ rev, onChanged }: { rev: { id: string; revisionCode: string; status: string }; onChanged: () => void }) {
  const completeness = useCompleteness(rev.id);
  const nexts = NEXT_REVISION_STATUS[rev.status] ?? [];

  const transition = useMutation({
    mutationFn: async (to: string) =>
      to === 'PUBLISHED'
        ? api.post(`/revisions/${rev.id}/publish`, {})
        : api.post(`/revisions/${rev.id}/transition`, { to }),
    onSuccess: () => { toast.success('Đã cập nhật trạng thái revision.'); onChanged(); },
    onError: (e) => toast.problem(e, 'Chuyển trạng thái thất bại'),
  });

  return (
    <li className="panel" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="num" style={{ fontWeight: 700 }}>{rev.revisionCode}</span>
        <StatusBadge status={rev.status} />
        <span className="muted" style={{ fontSize: 12 }}>{REVISION_STATUS_LABEL[rev.status] ?? ''}</span>
        {completeness.data && (
          <span style={{ fontSize: 11.5, padding: '1px 7px', borderRadius: 5, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)' }}>
            {completeness.data.level} · {completeness.data.counts.documents}📄 {completeness.data.counts.attributes}⚙
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {nexts.map((to) => (
          <button key={to} className="btn btn-ghost btn-sm" disabled={transition.isPending} onClick={() => transition.mutate(to)}>
            {to === 'PUBLISHED' ? <><Icon name="check" size={13} /> Công bố</> : `→ ${REVISION_STATUS_LABEL[to] ?? to}`}
          </button>
        ))}
      </div>
    </li>
  );
}

function CreateModelModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [modelCodeInternal, setCode] = useState('');
  const [modelName, setName] = useState('');
  const [designSymbol, setSymbol] = useState('');
  const mut = useMutation({
    mutationFn: async () => api.post('/technical-models', { modelCodeInternal, modelName, designSymbol: designSymbol || undefined }),
    onSuccess: () => { toast.success('Đã tạo mẫu.'); onDone(); },
    onError: (e) => toast.problem(e, 'Tạo mẫu thất bại'),
  });
  return (
    <Modal open title="Tạo mẫu kỹ thuật" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}><span className="muted" style={{ fontSize: 13 }}>Mã nội bộ *</span><input value={modelCodeInternal} onChange={(e) => setCode(e.target.value)} required /></label>
        <label style={{ display: 'grid', gap: 4 }}><span className="muted" style={{ fontSize: 13 }}>Tên mẫu *</span><input value={modelName} onChange={(e) => setName(e.target.value)} required /></label>
        <label style={{ display: 'grid', gap: 4 }}><span className="muted" style={{ fontSize: 13 }}>Ký hiệu thiết kế</span><input value={designSymbol} onChange={(e) => setSymbol(e.target.value)} placeholder="VD: 19.GTL-K24" /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !modelCodeInternal || !modelName}>Tạo</button>
        </div>
      </form>
    </Modal>
  );
}

function CreateRevisionModal({ modelId, onClose, onDone }: { modelId: string; onClose: () => void; onDone: () => void }) {
  const [revisionCode, setRevisionCode] = useState('');
  const [changeSummary, setSummary] = useState('');
  const mut = useMutation({
    mutationFn: async () => api.post(`/technical-models/${modelId}/revisions`, { revisionCode, changeSummary: changeSummary || undefined }),
    onSuccess: () => { toast.success('Đã tạo revision.'); onDone(); },
    onError: (e) => toast.problem(e, 'Tạo revision thất bại'),
  });
  return (
    <Modal open title="Tạo đời thiết kế" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}><span className="muted" style={{ fontSize: 13 }}>Mã revision *</span><input value={revisionCode} onChange={(e) => setRevisionCode(e.target.value)} placeholder="VD: 2016 / K24" required /></label>
        <label style={{ display: 'grid', gap: 4 }}><span className="muted" style={{ fontSize: 13 }}>Tóm tắt thay đổi</span><textarea value={changeSummary} onChange={(e) => setSummary(e.target.value)} rows={3} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !revisionCode}>Tạo</button>
        </div>
      </form>
    </Modal>
  );
}
