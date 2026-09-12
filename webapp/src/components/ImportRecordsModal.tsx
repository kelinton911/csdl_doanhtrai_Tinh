import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { DataTable, type Column } from './DataTable';

// Import Excel/CSV hàng loạt cho các bản ghi gốc (doanh trại / khu đất / vật chất…).
// Tái dùng pipeline /imports (staging → soát lỗi theo dòng → commit ACID). Hai bước rõ ràng:
//   1) Tải & kiểm tra (STAGED)  2) Commit dòng hợp lệ.

interface ImportError { row: number; column?: string; message: string }
interface ImportBatch {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  committedCount?: number;
  errors: ImportError[];
}

export function ImportRecordsModal({
  target,
  title,
  templateCsv,
  hint,
  onClose,
  onDone,
}: {
  target: string;
  title: string;
  templateCsv: string;
  hint?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [committed, setCommitted] = useState<number | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      return (await api.post('/imports', fd, { params: { target } })).data as ImportBatch;
    },
    onSuccess: (b) => { setBatch(b); setCommitted(null); toast.info(`Đã kiểm tra: ${b.validRows} hợp lệ, ${b.errorRows} lỗi.`); },
    onError: (e) => toast.problem(e, 'Tải tệp thất bại'),
  });

  const commit = useMutation({
    mutationFn: async () => (await api.post(`/imports/${batch!.id}/commit`)).data as ImportBatch,
    onSuccess: (b) => { const n = b.committedCount ?? b.validRows; setCommitted(n); setBatch(b); toast.success(`Đã nhập ${n} dòng.`); onDone(); },
    onError: (e) => toast.problem(e, 'Commit thất bại'),
  });

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + templateCsv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mau-nhap-${target}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const errCols: Column<ImportError>[] = [
    { key: 'row', header: 'Dòng', render: (e) => e.row, mono: true, align: 'right', width: 70 },
    { key: 'col', header: 'Cột', render: (e) => e.column ?? '—', mono: true, width: 130 },
    { key: 'msg', header: 'Lỗi', render: (e) => <span style={{ color: 'var(--danger-fg)' }}>{e.message}</span> },
  ];

  return (
    <Modal open title={title} onClose={onClose} width={720}>
      <div style={{ display: 'grid', gap: 14 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Cột bắt buộc: <span className="num">code, name</span>. {hint} Hỗ trợ <span className="num">.xlsx</span> và <span className="num">.csv</span>.
          Dòng trùng mã / thiếu bắt buộc / toạ độ sai sẽ bị đánh dấu lỗi và không được ghi.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={downloadTemplate}><Icon name="download" size={14} /> Tải mẫu CSV</button>
          <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setBatch(null); setCommitted(null); }} />
          <button className="btn btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            <Icon name="search" size={15} /> {upload.isPending ? 'Đang kiểm tra…' : 'Tải & kiểm tra'}
          </button>
        </div>

        {upload.isError && (
          <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', fontSize: 13 }}>
            {toProblem(upload.error).title}
          </div>
        )}
        {committed !== null && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--ok-bg)', color: 'var(--ok-fg)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon name="check" size={15} /> Đã nhập {committed} dòng.
          </div>
        )}

        {batch && (
          <>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13.5 }}>
              <Stat label="Tổng dòng" value={String(batch.totalRows)} />
              <Stat label="Hợp lệ" value={String(batch.validRows)} tone="ok" />
              <Stat label="Lỗi" value={String(batch.errorRows)} tone={batch.errorRows > 0 ? 'danger' : undefined} />
              <Stat label="Trạng thái" value={batch.status === 'COMMITTED' ? 'Đã ghi' : 'Chờ ghi'} />
            </div>
            {batch.errors.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Chi tiết lỗi ({batch.errors.length})</div>
                <DataTable columns={errCols} rows={batch.errors} rowKey={(e) => `${e.row}-${e.column ?? ''}`} emptyTitle="Không có lỗi" />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
              {batch.status !== 'COMMITTED' && (
                <button className="btn btn-primary" disabled={batch.validRows === 0 || commit.isPending} onClick={() => commit.mutate()}>
                  <Icon name="check" size={15} /> {commit.isPending ? 'Đang ghi…' : `Nhập ${batch.validRows} dòng hợp lệ`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  const color = tone === 'ok' ? 'var(--ok-fg)' : tone === 'danger' ? 'var(--danger-fg)' : 'var(--color-text)';
  return (
    <div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
