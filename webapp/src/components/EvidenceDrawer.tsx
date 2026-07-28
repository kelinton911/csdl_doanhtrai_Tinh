import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { Icon } from './Icon';
import { Skeleton, EmptyState } from './States';
import { dateTime } from '../lib/format';

interface Doc {
  id: string;
  name: string;
  contentType: string;
  size: string;
  classification: string | null;
  createdAt: string;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Ngăn kéo minh chứng (Frontend §5, §6.5): xem/tải/đính kèm tài liệu mà không rời màn hình.
export function EvidenceDrawer({
  entityType,
  entityId,
  title = 'Tài liệu & minh chứng',
  onClose,
}: {
  entityType: string;
  entityId: string;
  title?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: async () => (await api.get('/documents', { params: { entityType, entityId, size: 100 } })).data as { data: Doc[] },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', entityType);
      fd.append('entityId', entityId);
      return api.post('/files', fd);
    },
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ['documents', entityType, entityId] }); },
    onError: (e) => setError(toProblem(e).title),
  });

  async function download(id: string) {
    const { data } = await api.get(`/files/${id}/download-url`);
    window.open(data.url, '_blank');
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,32,0.4)', zIndex: 40 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scrl"
        style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 400, maxWidth: '92vw', background: 'var(--surface-1)', borderLeft: '1px solid var(--color-neutral-300)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <Icon name="file" size={18} /> {title}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 16, borderBottom: '1px solid var(--color-neutral-200)' }}>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            accept="image/*,application/pdf,.docx,.xlsx,.txt"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }}
          />
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> {upload.isPending ? 'Đang tải lên…' : 'Tải tài liệu/ảnh'}
          </button>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Ảnh có thời gian và người tải; tệp có checksum; tối đa 25MB.</p>
          {error && <div style={{ marginTop: 8, color: 'var(--danger-fg)', fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={14} /> {error}</div>}
        </div>

        <div className="scrl" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {docs.isLoading ? (
            <Skeleton rows={4} />
          ) : (docs.data?.data ?? []).length === 0 ? (
            <EmptyState icon="file" title="Chưa có tài liệu" hint="Tải ảnh, biên bản hoặc hồ sơ pháp lý liên quan." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(docs.data?.data ?? []).map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--color-accent-600)' }}>
                    <Icon name={d.contentType.startsWith('image/') ? 'file' : 'file'} size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div className="muted num" style={{ fontSize: 11 }}>{humanSize(Number(d.size))} · {dateTime(d.createdAt)}</div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => download(d.id)} title="Tải xuống"><Icon name="download" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
