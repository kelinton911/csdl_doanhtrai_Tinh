import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';

// M14 — Nhập liệu hàng loạt (UC-21) và đồng bộ offline (UC-22).
interface ValidationError { row: number; column?: string; message: string }
interface ImportBatch {
  id: string;
  filename: string;
  status: string; // STAGED | COMMITTED
  totalRows: number;
  validRows: number;
  errorRows: number;
  committedCount?: number;
  errors: ValidationError[];
}

export function ImportPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tích hợp & đồng bộ"
        title="Nhập liệu hàng loạt & đồng bộ ngoài tuyến"
        description="Tải CSV vào vùng đệm, kiểm tra lỗi theo dòng/cột rồi commit các dòng hợp lệ (giao dịch ACID). Tra cứu và gửi lô đồng bộ offline (idempotent, phát hiện xung đột phiên bản)."
      />
      <div style={{ display: 'grid', gap: 24 }}>
        <ImportCsvSection />
        <SyncSection />
      </div>
    </>
  );
}

function ImportCsvSection() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<number | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      return (await api.post('/imports', fd, { params: { target: 'materials' } })).data as ImportBatch;
    },
    onSuccess: (b) => { setBatch(b); setCommitted(null); setError(null); },
    onError: (e) => { setError(toProblem(e).title); setBatch(null); },
  });

  const commit = useMutation({
    mutationFn: async () => (await api.post(`/imports/${batch!.id}/commit`)).data as ImportBatch,
    onSuccess: (b) => { setCommitted(b.committedCount ?? b.validRows); setBatch(b); qc.invalidateQueries({ queryKey: ['materials'] }); },
    onError: (e) => setError(toProblem(e).title),
  });

  const errCols: Column<ValidationError>[] = [
    { key: 'row', header: 'Dòng', render: (e) => e.row, mono: true, align: 'right', width: 80 },
    { key: 'col', header: 'Cột', render: (e) => e.column ?? '—', mono: true, width: 140 },
    { key: 'msg', header: 'Lỗi', render: (e) => <span style={{ color: 'var(--danger-fg)' }}>{e.message}</span> },
  ];

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Nhập vật chất từ CSV (UC-21)</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Cột bắt buộc: <span className="num">code, name</span>. Cột tùy chọn: <span className="num">categoryCode, unitCode</span>. Dòng trùng mã hoặc thiếu bắt buộc sẽ bị đánh dấu lỗi và không được commit.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setBatch(null); setCommitted(null); }} />
        <button className="btn btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          <Icon name="upload" size={16} /> {upload.isPending ? 'Đang tải…' : 'Tải & kiểm tra'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <Icon name="alert" size={15} /> {error}
        </div>
      )}

      {committed !== null && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <Icon name="check" size={15} /> Đã commit {committed} dòng vào danh mục vật chất (trạng thái nháp).
        </div>
      )}

      {batch && (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14, fontSize: 13.5 }}>
            <Stat label="Tệp" value={batch.filename} />
            <Stat label="Tổng dòng" value={String(batch.totalRows)} />
            <Stat label="Hợp lệ" value={String(batch.validRows)} tone="ok" />
            <Stat label="Lỗi" value={String(batch.errorRows)} tone={batch.errorRows > 0 ? 'danger' : undefined} />
            <Stat label="Trạng thái" value={batch.status === 'COMMITTED' ? 'Đã commit' : 'Chờ commit'} />
          </div>
          {batch.errors.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Chi tiết lỗi ({batch.errors.length})</div>
              <DataTable columns={errCols} rows={batch.errors} rowKey={(e) => `${e.row}-${e.column ?? ''}`} emptyTitle="Không có lỗi" />
            </div>
          )}
          {batch.status !== 'COMMITTED' && (
            <button className="btn btn-primary" disabled={batch.validRows === 0 || commit.isPending} onClick={() => commit.mutate()}>
              <Icon name="check" size={16} /> {commit.isPending ? 'Đang commit…' : `Commit ${batch.validRows} dòng hợp lệ`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function SyncSection() {
  const [id, setId] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: async () => (await api.get(`/sync/batches/${id.trim()}`)).data as Record<string, unknown>,
    onSuccess: (b) => { setResult(b); setError(null); },
    onError: (e) => { setError(toProblem(e).title); setResult(null); },
  });

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Đồng bộ ngoài tuyến (UC-22)</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Các lô đồng bộ do client offline gửi lên (idempotent theo <span className="num">batchKey</span>). Nhập mã lô để tra cứu trạng thái xử lý và kết quả từng bản ghi (applied / conflict / failed).
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input className="input num" style={{ maxWidth: 380 }} placeholder="UUID lô đồng bộ…" value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn" disabled={!id.trim() || lookup.isPending} onClick={() => lookup.mutate()}><Icon name="search" size={15} /> Tra cứu</button>
      </div>
      {error && <div style={{ color: 'var(--danger-fg)', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      {result && (
        <pre className="num" style={{ background: 'var(--surface-2, var(--color-neutral-100))', padding: 14, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 320 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
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
