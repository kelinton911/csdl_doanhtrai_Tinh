import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { DOC_TYPE_LABEL, STATUS_LABEL, statusColor, FIELD_LABEL, CONFIDENTIALITY_LABEL, confidentialityColor } from '../lib/legalDoc';

interface Row {
  id: string; code: string; docNumber: string; title: string; docType: string; issuingBody: string | null;
  issuedDate: string | null; effectiveStatus: string; field: string; confidentiality: string;
}
interface Summary { total: number; effective: number; expired: number; expiringSoon: number }

export function DocStatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{STATUS_LABEL[status] ?? status}</span>;
}

export function LegalDocsListPage() {
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [status, setStatus] = useState('');
  const [field, setField] = useState('');
  const size = 15;

  const summary = useQuery({ queryKey: ['legaldocs-summary'], queryFn: async () => (await api.get('/legal-documents/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['legal-documents', page, search, docType, status, field],
    queryFn: async () => (await api.get('/legal-documents', { params: { page, size, search: search || undefined, docType: docType || undefined, effectiveStatus: status || undefined, field: field || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const columns: Column<Row>[] = [
    { key: 'docNumber', header: 'Số/ký hiệu', render: (r) => r.docNumber, mono: true, width: 160 },
    { key: 'title', header: 'Trích yếu', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted" style={{ fontSize: 11 }}>{DOC_TYPE_LABEL[r.docType] ?? r.docType}{r.issuingBody ? ` · ${r.issuingBody}` : ''}</div></div> },
    { key: 'field', header: 'Lĩnh vực', render: (r) => FIELD_LABEL[r.field] ?? r.field },
    { key: 'issued', header: 'Ngày BH', render: (r) => r.issuedDate ?? '—', align: 'right', mono: true },
    { key: 'conf', header: 'Độ mật', render: (r) => <span style={{ color: confidentialityColor(r.confidentiality), fontWeight: 600, fontSize: 12 }}>{CONFIDENTIALITY_LABEL[r.confidentiality] ?? r.confidentiality}</span> },
    { key: 'status', header: 'Hiệu lực', render: (r) => <DocStatusChip status={r.effectiveStatus} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Văn bản & định mức"
        title="Văn bản, tiêu chuẩn, định mức"
        description="Kho văn bản pháp quy: số/ký hiệu, ngày ban hành, hiệu lực, liên kết thay thế; tra cứu và cảnh báo hết hiệu lực. Văn bản độ mật cao chỉ hiển thị theo thẩm quyền."
        actions={<button className="btn btn-primary" onClick={() => nav('/legal-documents/new')}><Icon name="plus" size={16} /> Thêm văn bản</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng số văn bản" value={summary.data?.total ?? 0} />
        <Kpi label="Đang hiệu lực" value={summary.data?.effective ?? 0} tone="ok" />
        <Kpi label="Sắp hết hiệu lực (60n)" value={summary.data?.expiringSoon ?? 0} tone={(summary.data?.expiringSoon ?? 0) > 0 ? 'warn' : undefined} />
        <Kpi label="Hết hiệu lực" value={summary.data?.expired ?? 0} tone={(summary.data?.expired ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tra cứu số/ký hiệu, trích yếu, từ khóa…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 160 }} value={docType} onChange={(e) => { setPage(1); setDocType(e.target.value); }}>
          <option value="">Mọi loại</option>
          {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 150 }} value={field} onChange={(e) => { setPage(1); setField(e.target.value); }}>
          <option value="">Mọi lĩnh vực</option>
          {Object.entries(FIELD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi hiệu lực</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(r) => nav(`/legal-documents/${r.id}`)} emptyTitle="Không có văn bản" emptyHint="Thêm văn bản hoặc đổi bộ lọc/từ khóa." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div></div>);
}
