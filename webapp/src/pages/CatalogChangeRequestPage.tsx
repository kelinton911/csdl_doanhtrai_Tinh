import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  resolveAlias,
  searchCatalog,
  useChangeRequests,
  type CatalogItem,
  type MaterialAlias,
  CHANGE_REQUEST_STATUS_LABEL,
} from '../lib/catalog';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';

// SCR-DT01-04 — Đề nghị bổ sung: BẮT BUỘC tìm toàn danh mục + alias TRƯỚC khi tạo đề nghị
// (chống tạo trùng mã đã tồn tại). Chỉ mở form khi đã tra ít nhất một lần.
export function CatalogChangeRequestPage() {
  const qc = useQueryClient();
  const list = useChangeRequests();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [aliases, setAliases] = useState<MaterialAlias[]>([]);
  const [aliasMatches, setAliasMatches] = useState<CatalogItem[]>([]);
  const [proposedName, setProposedName] = useState('');
  const [description, setDescription] = useState('');

  const searchMut = useMutation({
    mutationFn: async (q: string) => {
      const [s, r] = await Promise.all([searchCatalog(q), resolveAlias(q)]);
      return { items: s.items, aliases: s.aliases, aliasMatches: r.matches };
    },
    onSuccess: (res) => {
      setItems(res.items);
      setAliases(res.aliases);
      setAliasMatches(res.aliasMatches);
      setSearched(true);
      setProposedName((n) => n || query);
    },
    onError: (e) => toast.problem(e, 'Tra cứu thất bại'),
  });

  const createMut = useMutation({
    mutationFn: async () => api.post('/catalog/change-requests', { proposedName, description: description || undefined }),
    onSuccess: () => {
      toast.success('Đã tạo đề nghị bổ sung.');
      setProposedName(''); setDescription(''); setSearched(false); setQuery(''); setItems([]); setAliasMatches([]);
      qc.invalidateQueries({ queryKey: ['catalog', 'change-requests'] });
    },
    onError: (e) => toast.problem(e, 'Tạo đề nghị thất bại'),
  });

  const foundSomething = items.length > 0 || aliasMatches.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="DT-01 · Đề nghị bổ sung"
        title="Đề nghị bổ sung danh mục"
        description="Bắt buộc tra toàn danh mục + tên khác trước khi đề nghị, để không tạo trùng mã đã có."
        actions={<Link className="btn btn-ghost btn-sm" to="/catalog"><Icon name="chevron" size={15} /> Về danh mục</Link>}
      />

      {/* Bước 1: tra cứu bắt buộc */}
      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--color-accent-600, #2563eb)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>1</span>
          Tra cứu trước (bắt buộc)
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) searchMut.mutate(query.trim()); }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên/mã cần tìm (VD: Ghế tựa)" style={{ minWidth: 300 }} />
          <button className="btn btn-primary" type="submit" disabled={searchMut.isPending || !query.trim()}>
            <Icon name="search" size={15} /> Tra cứu
          </button>
        </form>

        {searched && (
          <div style={{ marginTop: 14 }}>
            {foundSomething ? (
              <div className="panel" style={{ padding: 14, borderColor: 'var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> Đã có mã tương tự — cân nhắc dùng lại thay vì đề nghị mới</div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                  {aliasMatches.map((m) => <li key={`a-${m.id}`}>Khớp tên khác → <b className="num">{m.code}</b> · {m.name}</li>)}
                  {items.map((m) => <li key={`i-${m.id}`}><b className="num">{m.code}</b> · {m.name}</li>)}
                  {aliases.map((a) => <li key={`al-${a.id}`}>Tên khác “{a.aliasName}”</li>)}
                </ul>
              </div>
            ) : (
              <div className="panel" style={{ padding: 14, borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="check" size={16} /> Không tìm thấy mã trùng — có thể tạo đề nghị bổ sung.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bước 2: form đề nghị — chỉ mở sau khi đã tra */}
      <div className="panel" style={{ padding: 16, marginBottom: 20, opacity: searched ? 1 : 0.5, pointerEvents: searched ? 'auto' : 'none' }}>
        <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, background: searched ? 'var(--color-accent-600, #2563eb)' : 'var(--color-neutral-400)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>2</span>
          Tạo đề nghị {!searched && <span className="muted" style={{ fontWeight: 400 }}>(tra cứu trước để mở)</span>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="muted" style={{ fontSize: 13 }}>Tên vật chất đề nghị *</span>
            <input value={proposedName} onChange={(e) => setProposedName(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="muted" style={{ fontSize: 13 }}>Mô tả / lý do</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <div>
            <button className="btn btn-primary" type="submit" disabled={createMut.isPending || !proposedName.trim()}>
              <Icon name="upload" size={15} /> Gửi đề nghị
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách đề nghị */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>Đề nghị gần đây</h2>
      {list.isLoading ? <Skeleton rows={5} /> : list.isError ? <ErrorState error={list.error} /> :
        !list.data?.data.length ? <EmptyState icon="clipboard" title="Chưa có đề nghị nào" /> : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                <th style={{ padding: '8px 12px' }}>Mã đề nghị</th><th>Tên đề nghị</th><th>Loại</th><th>Trạng thái</th>
              </tr></thead>
              <tbody>
                {list.data.data.map((cr) => (
                  <tr key={cr.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                    <td style={{ padding: '8px 12px' }} className="num">{cr.requestCode}</td>
                    <td>{cr.proposedName}</td>
                    <td>{cr.requestType}</td>
                    <td><StatusBadge status={cr.status} />{' '}
                      <span className="muted" style={{ fontSize: 12 }}>{CHANGE_REQUEST_STATUS_LABEL[cr.status] ?? ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
