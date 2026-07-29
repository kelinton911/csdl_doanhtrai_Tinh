import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { num, dateTime } from '../lib/format';

interface Job { id: string; template: string; format: string; status: string; rowCount: number; snapshotAt: string | null; createdAt: string }

const TEMPLATES = [
  { key: 'barracks-summary', label: 'Tổng hợp doanh trại', icon: 'building' as const, dom: 'asset' },
  { key: 'inventory-summary', label: 'Tồn kho vật chất', icon: 'box' as const, dom: 'stock' },
  { key: 'facility-quality', label: 'Chất lượng công trình', icon: 'grid' as const, dom: 'cmd' },
];
const TEMPLATE_LABEL: Record<string, string> = Object.fromEntries(TEMPLATES.map((t) => [t.key, t.label]));
const PENDING = ['QUEUED', 'PROCESSING', 'PENDING', 'RUNNING'];
const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Hoàn tất', QUEUED: 'Chờ xử lý', PROCESSING: 'Đang tạo', FAILED: 'Thất bại' };

export function ReportsPage() {
  const qc = useQueryClient();
  const [template, setTemplate] = useState('barracks-summary');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'word'>('pdf');
  const [preview, setPreview] = useState<{ job: Job; url: string } | null>(null);

  const jobs = useQuery({
    queryKey: ['report-jobs'],
    queryFn: async () => (await api.get('/reports/jobs')).data as Job[],
    // Polling khi còn job đang xử lý → tự cập nhật trạng thái không cần tải lại trang.
    refetchInterval: (query) => ((query.state.data ?? []).some((j: Job) => PENDING.includes(j.status)) ? 2500 : false),
  });

  const create = useMutation({
    mutationFn: async () => api.post('/reports/jobs', { template, format }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report-jobs'] }); toast.success('Đã tạo yêu cầu báo cáo. Đang xử lý…'); },
    onError: (e) => toast.problem(e, 'Không tạo được báo cáo'),
  });

  const openPreview = useMutation({
    mutationFn: async (job: Job) => {
      const { data } = await api.get(`/reports/${job.id}/download-url`);
      return { job, url: data.url as string };
    },
    onSuccess: (r) => setPreview(r),
    onError: (e) => toast.problem(e, 'Không mở được báo cáo'),
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
    { key: 'status', header: 'Trạng thái', render: (j) => <JobStatus status={j.status} /> },
    {
      key: 'act', header: '', align: 'right', render: (j) => j.status !== 'COMPLETED' ? null : (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openPreview.mutate(j); }}><Icon name="search" size={14} /> Xem</button>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); download(j.id); }}><Icon name="download" size={14} /> Tải</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Báo cáo - phân tích" title="Báo cáo & xuất dữ liệu" description="Mỗi báo cáo ghi nguồn dữ liệu và thời điểm chốt. Xuất PDF/Excel; số liệu tái lập từ snapshot. Trạng thái tự cập nhật khi đang tạo." />

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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="field-label">Định dạng:</span>
          {(['pdf', 'excel', 'word'] as const).map((f) => (
            <button key={f} className="btn btn-sm" onClick={() => setFormat(f)} style={{ background: format === f ? 'var(--color-accent-600)' : 'var(--surface-1)', color: format === f ? '#fff' : 'var(--color-text)', borderColor: format === f ? 'var(--color-accent-600)' : 'var(--color-neutral-400)', textTransform: 'uppercase' }}>{f}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
            <Icon name="file" size={16} /> {create.isPending ? 'Đang tạo…' : 'Tạo & xuất báo cáo'}
          </button>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Báo cáo đã tạo</div>
      <DataTable columns={columns} rows={jobs.data} loading={jobs.isLoading} rowKey={(j) => j.id} emptyTitle="Chưa có báo cáo" emptyHint="Chọn mẫu và bấm 'Tạo & xuất báo cáo'." />

      {preview && (
        <Modal open title={`Xem trước · ${TEMPLATE_LABEL[preview.job.template] ?? preview.job.template}`} onClose={() => setPreview(null)} width={860}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="muted num" style={{ fontSize: 12 }}>
              {preview.job.format.toUpperCase()} · {num(preview.job.rowCount)} dòng · chốt {dateTime(preview.job.snapshotAt ?? preview.job.createdAt)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => window.open(preview.url, '_blank')}><Icon name="download" size={14} /> Tải xuống</button>
            </div>
          </div>
          {preview.job.format === 'pdf' ? (
            <iframe title="preview" src={preview.url} style={{ width: '100%', height: '62vh', border: '1px solid var(--color-neutral-300)', borderRadius: 8, background: '#fff' }} />
          ) : (
            <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
              <Icon name="box" size={28} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>Tệp Excel không xem trước trực tiếp</div>
              <p className="muted" style={{ fontSize: 13 }}>Bấm “Tải xuống” để mở bằng phần mềm bảng tính.</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function JobStatus({ status }: { status: string }) {
  const pending = PENDING.includes(status);
  const failed = status === 'FAILED';
  const color = status === 'COMPLETED' ? 'var(--ok-fg)' : failed ? 'var(--danger-fg)' : 'var(--warn-fg)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontWeight: 600, fontSize: 12 }}>
      {pending && (
        <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'csdl-spin 0.8s linear infinite' }} />
      )}
      {STATUS_LABEL[status] ?? status}
      <style>{'@keyframes csdl-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}
