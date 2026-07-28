import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { num, dateTime } from '../lib/format';

interface Job { id: string; template: string; format: string; status: string; rowCount: number; snapshotAt: string | null; createdAt: string }

const TEMPLATES = [
  { key: 'barracks-summary', label: 'Tổng hợp doanh trại', icon: 'building' as const, dom: 'asset' },
  { key: 'inventory-summary', label: 'Tồn kho vật chất', icon: 'box' as const, dom: 'stock' },
  { key: 'facility-quality', label: 'Chất lượng công trình', icon: 'grid' as const, dom: 'cmd' },
];
const TEMPLATE_LABEL: Record<string, string> = Object.fromEntries(TEMPLATES.map((t) => [t.key, t.label]));

export function ReportsPage() {
  const qc = useQueryClient();
  const [template, setTemplate] = useState('barracks-summary');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [error, setError] = useState<string | null>(null);

  const jobs = useQuery({ queryKey: ['report-jobs'], queryFn: async () => (await api.get('/reports/jobs')).data as Job[] });
  const create = useMutation({
    mutationFn: async () => api.post('/reports/jobs', { template, format }),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ['report-jobs'] }); },
    onError: (e) => setError(toProblem(e).title),
  });
  async function download(id: string) {
    const { data } = await api.get(`/reports/${id}/download-url`);
    window.open(data.url, '_blank');
  }

  const columns: Column<Job>[] = [
    { key: 'template', header: 'Báo cáo', render: (j) => <span style={{ fontWeight: 600 }}>{TEMPLATE_LABEL[j.template] ?? j.template}</span> },
    { key: 'format', header: 'Định dạng', render: (j) => <span style={{ textTransform: 'uppercase', fontSize: 12, fontWeight: 700, color: j.format === 'pdf' ? 'var(--danger-fg)' : 'var(--ok-fg)' }}>{j.format}</span> },
    { key: 'rows', header: 'Số dòng', render: (j) => num(j.rowCount), align: 'right', mono: true },
    { key: 'snap', header: 'Thời điểm chốt', render: (j) => dateTime(j.snapshotAt ?? j.createdAt), mono: true },
    { key: 'status', header: 'Trạng thái', render: (j) => <span style={{ color: j.status === 'COMPLETED' ? 'var(--ok-fg)' : 'var(--warn-fg)', fontWeight: 600, fontSize: 12 }}>{j.status === 'COMPLETED' ? 'Hoàn tất' : j.status}</span> },
    { key: 'act', header: '', align: 'right', render: (j) => j.status !== 'COMPLETED' ? null : <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); download(j.id); }}><Icon name="download" size={14} /> Tải</button> },
  ];

  return (
    <>
      <PageHeader eyebrow="Báo cáo - phân tích" title="Báo cáo & xuất dữ liệu" description="Mỗi báo cáo ghi nguồn dữ liệu và thời điểm chốt. Xuất PDF/Excel; số liệu tái lập từ snapshot." />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Tạo báo cáo mới</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => setTemplate(t.key)} style={{ all: 'unset', cursor: 'pointer', padding: 16, borderRadius: 10, border: `2px solid ${template === t.key ? `var(--dom-${t.dom})` : 'var(--color-neutral-300)'}`, background: template === t.key ? `color-mix(in srgb, var(--dom-${t.dom}) 8%, transparent)` : 'var(--surface-1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ color: `var(--dom-${t.dom})` }}><Icon name={t.icon} size={22} /></span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="field-label">Định dạng:</span>
          {(['pdf', 'excel'] as const).map((f) => (
            <button key={f} className="btn btn-sm" onClick={() => setFormat(f)} style={{ background: format === f ? 'var(--color-accent-600)' : 'var(--surface-1)', color: format === f ? '#fff' : 'var(--color-text)', borderColor: format === f ? 'var(--color-accent-600)' : 'var(--color-neutral-400)', textTransform: 'uppercase' }}>{f}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
            <Icon name="file" size={16} /> {create.isPending ? 'Đang tạo…' : 'Tạo & xuất báo cáo'}
          </button>
        </div>
        {error && <div style={{ marginTop: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Báo cáo đã tạo</div>
      <DataTable columns={columns} rows={jobs.data} loading={jobs.isLoading} rowKey={(j) => j.id} emptyTitle="Chưa có báo cáo" emptyHint="Chọn mẫu và bấm 'Tạo & xuất báo cáo'." />
    </>
  );
}
