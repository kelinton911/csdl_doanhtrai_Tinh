import { useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { AsyncPicker } from '../components/AsyncPicker';
import { num } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';
import {
  CATEGORY_LABEL, CATEGORY_COLOR, RESOURCE_TYPE_LABEL, MOBILIZATION_LABEL,
  RELIABILITY_LABEL, reliabilityColor, AGREEMENT_LABEL,
} from '../lib/localResource';

interface Row {
  id: string; code: string; name: string; category: string; resourceType: string;
  ownerName: string | null; mobilizationTime: string; reliability: string;
  agreementStatus: string; agreementValidUntil: string | null; capacityQty: number; capacityUnit: string | null;
  areaName: string | null;
}
interface NearbyRow {
  id: string; code: string; name: string; category: string; resourceType: string;
  ownerName: string | null; mobilizationTime: string; reliability: string;
  capacityQty: number; capacityUnit: string | null; distanceKm: number;
}

const CATS = [{ key: '', label: 'Tất cả' }, ...Object.entries(CATEGORY_LABEL).map(([key, label]) => ({ key, label }))];

export function CatChip({ category }: { category: string }) {
  const color = CATEGORY_COLOR[category] ?? 'var(--color-neutral-500)';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{CATEGORY_LABEL[category] ?? category}</span>;
}
export function RelChip({ v }: { v: string }) {
  return <span style={{ color: reliabilityColor(v), fontWeight: 700, fontSize: 12.5 }}>{RELIABILITY_LABEL[v] ?? v}</span>;
}

// M16 — Danh sách nguồn lực huy động + công cụ "Chọn nguồn tối ưu" theo khoảng cách.
export function LocalResourcesListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [mob, setMob] = useState('');
  const size = 15;

  // Công cụ tìm nguồn gần đơn vị.
  const [finderOpen, setFinderOpen] = useState(false);
  const [barracksId, setBarracksId] = useState('');
  const [radiusKm, setRadiusKm] = useState('30');
  const [finderCat, setFinderCat] = useState('');

  const q = useQuery({
    queryKey: ['local-resources', page, search, category, mob],
    queryFn: async () =>
      (await api.get('/local-resources', { params: { page, size, search: search || undefined, category: category || undefined, mobilizationTime: mob || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const nearby = useQuery({
    queryKey: ['local-resources-nearby', barracksId, radiusKm, finderCat],
    queryFn: async () => (await api.get('/local-resources/nearby', { params: { barracksId, radiusKm, category: finderCat || undefined, limit: 30 } })).data as { count: number; radiusKm: number; resources: NearbyRow[] },
    enabled: finderOpen && !!barracksId,
  });

  const exporting = useMutation({
    mutationFn: async () => {
      const all = (await api.get('/local-resources', { params: { page: 1, size: 1000, search: search || undefined, category: category || undefined, mobilizationTime: mob || undefined } })).data.data as Row[];
      const cols: CsvColumn<Row>[] = [
        { header: 'Mã', value: (r) => r.code }, { header: 'Tên', value: (r) => r.name },
        { header: 'Nhóm', value: (r) => CATEGORY_LABEL[r.category] ?? r.category },
        { header: 'Loại', value: (r) => RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType },
        { header: 'Chủ thể', value: (r) => r.ownerName ?? '' },
        { header: 'Năng lực', value: (r) => `${r.capacityQty} ${r.capacityUnit ?? ''}`.trim() },
        { header: 'Thời gian huy động', value: (r) => MOBILIZATION_LABEL[r.mobilizationTime] ?? r.mobilizationTime },
        { header: 'Độ tin cậy', value: (r) => RELIABILITY_LABEL[r.reliability] ?? r.reliability },
        { header: 'Hiệp đồng', value: (r) => AGREEMENT_LABEL[r.agreementStatus] ?? r.agreementStatus },
        { header: 'Hạn hiệp đồng', value: (r) => r.agreementValidUntil ?? '' },
      ];
      downloadCsv(`nguon-luc-huy-dong-${new Date().toISOString().slice(0, 10)}`, all, cols);
      return all.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 90 },
    { key: 'name', header: 'Tên nguồn lực', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted" style={{ fontSize: 11 }}>{RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType}</div></div> },
    { key: 'cat', header: 'Nhóm', render: (r) => <CatChip category={r.category} /> },
    { key: 'owner', header: 'Chủ thể', render: (r) => r.ownerName ?? '—' },
    { key: 'cap', header: 'Năng lực', render: (r) => <span className="num">{num(r.capacityQty)} {r.capacityUnit ?? ''}</span>, align: 'right' },
    { key: 'mob', header: 'Huy động', render: (r) => MOBILIZATION_LABEL[r.mobilizationTime] ?? r.mobilizationTime },
    { key: 'rel', header: 'Tin cậy', render: (r) => <RelChip v={r.reliability} /> },
    { key: 'agr', header: 'Hiệp đồng', render: (r) => <AgreementCell status={r.agreementStatus} validUntil={r.agreementValidUntil} /> },
  ];

  const nearbyCols: Column<NearbyRow>[] = [
    { key: 'dist', header: 'K.cách', render: (r) => <span className="num" style={{ fontWeight: 700, color: 'var(--color-accent-700)' }}>{r.distanceKm} km</span>, align: 'right', width: 90 },
    { key: 'name', header: 'Nguồn lực', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted" style={{ fontSize: 11 }}>{RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType}</div></div> },
    { key: 'cat', header: 'Nhóm', render: (r) => <CatChip category={r.category} /> },
    { key: 'cap', header: 'Năng lực', render: (r) => <span className="num">{num(r.capacityQty)} {r.capacityUnit ?? ''}</span>, align: 'right' },
    { key: 'mob', header: 'Huy động', render: (r) => MOBILIZATION_LABEL[r.mobilizationTime] ?? r.mobilizationTime },
    { key: 'rel', header: 'Tin cậy', render: (r) => <RelChip v={r.reliability} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Nguồn lực & bảo đảm"
        title="Nguồn lực huy động tại địa phương"
        description="Cơ sở, máy móc, vật liệu, nhân lực, nhà thầu có thể huy động; chủ thể, khả năng cung ứng, thời gian, độ tin cậy, hiệp đồng — chọn nguồn tối ưu theo khoảng cách."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setFinderOpen((o) => !o)}><Icon name="target" size={16} /> Chọn nguồn tối ưu</button>
            <button className="btn btn-primary" onClick={() => nav('/local-resources/new')}><Icon name="plus" size={16} /> Thêm nguồn lực</button>
          </div>
        }
      />

      {finderOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: '3px solid var(--color-accent-600)' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Tìm nguồn gần đơn vị cần bảo đảm</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 240, flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Doanh trại (tâm tìm kiếm)</span>
              <AsyncPicker endpoint="/barracks" value={barracksId} onChange={setBarracksId} placeholder="Chọn doanh trại…" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Bán kính (km)</span>
              <input className="input num" style={{ width: 110 }} type="number" min={1} max={300} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Nhóm nguồn lực</span>
              <select className="input" value={finderCat} onChange={(e) => setFinderCat(e.target.value)}>
                <option value="">Tất cả</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          {!barracksId ? (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Chọn doanh trại để tìm nguồn lực gần nhất (sắp theo khoảng cách).</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Tìm thấy {nearby.data?.count ?? 0} nguồn lực trong bán kính {nearby.data?.radiusKm ?? radiusKm} km.</div>
              <DataTable columns={nearbyCols} rows={nearby.data?.resources} loading={nearby.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/local-resources/${r.id}`)} emptyTitle="Không có nguồn lực trong bán kính" emptyHint="Tăng bán kính hoặc đổi nhóm nguồn lực." />
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, tên, chủ thể…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATS.map((f) => (
            <button key={f.key} className="btn btn-sm" onClick={() => { setPage(1); setCategory(f.key); }} style={{ background: category === f.key ? 'var(--color-accent-600)' : 'var(--surface-1)', color: category === f.key ? '#fff' : 'var(--color-text)', borderColor: category === f.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}>{f.label}</button>
          ))}
        </div>
        <select className="input" style={{ maxWidth: 190 }} value={mob} onChange={(e) => { setPage(1); setMob(e.target.value); }}>
          <option value="">Mọi thời gian huy động</option>
          {Object.entries(MOBILIZATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting.isPending} onClick={() => exporting.mutate()}><Icon name="download" size={14} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}</button>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/local-resources/${r.id}`)} emptyTitle="Chưa có nguồn lực" emptyHint="Thêm nguồn lực huy động hoặc đổi bộ lọc." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

export function AgreementCell({ status, validUntil }: { status: string; validUntil: string | null }) {
  const expired = status === 'SIGNED' && validUntil && new Date(validUntil) < new Date();
  const soon = status === 'SIGNED' && validUntil && !expired && new Date(validUntil) < new Date(Date.now() + 30 * 86400000);
  const color = status === 'NONE' ? 'var(--color-neutral-500)' : expired ? 'var(--danger-fg)' : soon ? 'var(--warn-fg)' : 'var(--ok-fg)';
  const label = status === 'NONE' ? 'Chưa có' : expired ? 'Hết hạn' : soon ? 'Sắp hết hạn' : 'Còn hiệu lực';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <span style={{ color, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
      {validUntil && <span className="muted num" style={{ fontSize: 10.5 }}>{validUntil}</span>}
    </span>
  );
}
