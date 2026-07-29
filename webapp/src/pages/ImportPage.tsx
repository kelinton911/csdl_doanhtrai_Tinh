import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
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
    onSuccess: (b) => { setBatch(b); setCommitted(null); setError(null); toast.info(`Đã kiểm tra: ${b.validRows} hợp lệ, ${b.errorRows} lỗi.`); },
    onError: (e) => { setError(toProblem(e).title); setBatch(null); toast.problem(e, 'Tải tệp thất bại'); },
  });

  const commit = useMutation({
    mutationFn: async () => (await api.post(`/imports/${batch!.id}/commit`)).data as ImportBatch,
    onSuccess: (b) => { const n = b.committedCount ?? b.validRows; setCommitted(n); setBatch(b); qc.invalidateQueries({ queryKey: ['materials'] }); toast.success(`Đã commit ${n} dòng vào danh mục vật chất.`); },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e, 'Commit thất bại'); },
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

interface SyncItemResult {
  localId: string;
  status: 'applied' | 'conflict' | 'failed';
  message?: string;
  serverVersion?: number;
  server?: { name?: string; address?: string };
}
interface Barracks { id: string; name: string; address: string | null; rowVersion?: number }

const RESULT_STYLE: Record<string, { fg: string; bg: string; bd: string; label: string }> = {
  applied: { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)', label: 'Đã áp dụng' },
  conflict: { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)', label: 'Xung đột phiên bản' },
  failed: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)', label: 'Thất bại' },
};

// UC-22 — Soạn & gửi lô thay đổi ngoài tuyến (chỉ entityType=barracks), idempotent theo batchKey,
// phát hiện xung đột phiên bản (baseVersion vs serverVersion) và cho phép giải quyết (lấy bản máy chủ).
function SyncSection() {
  const [targetId, setTargetId] = useState('');
  const [baseVersion, setBaseVersion] = useState('0');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [results, setResults] = useState<SyncItemResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');

  const barracks = useQuery({ queryKey: ['barracks-all'], queryFn: async () => (await api.get('/barracks', { params: { size: 200 } })).data as { data: Barracks[] } });

  const pick = (id: string) => {
    setTargetId(id);
    const b = (barracks.data?.data ?? []).find((x) => x.id === id);
    setName(b?.name ?? '');
    setAddress(b?.address ?? '');
    setBaseVersion(String(b?.rowVersion ?? 0));
  };

  const send = useMutation({
    mutationFn: async () => {
      const body = {
        batchKey: (globalThis.crypto?.randomUUID?.() as string) ?? `batch-${Date.now()}`,
        clientId: 'webapp-offline',
        items: [{ localId: 'local-1', entityType: 'barracks', targetId, baseVersion: Number(baseVersion), payload: { name, address } }],
      };
      return (await api.post('/sync/batches', body)).data as { items?: SyncItemResult[]; results?: SyncItemResult[] };
    },
    onSuccess: (b) => {
      const items = b.items ?? b.results ?? [];
      setResults(items);
      setError(null);
      const applied = items.filter((i) => i.status === 'applied').length;
      const conflict = items.filter((i) => i.status === 'conflict').length;
      if (conflict) toast.warn(`Có ${conflict} bản ghi xung đột phiên bản — cần giải quyết.`);
      else if (applied) toast.success(`Đã đồng bộ ${applied} bản ghi.`);
    },
    onError: (e) => { setError(toProblem(e).title); toast.problem(e, 'Gửi lô đồng bộ thất bại'); },
  });

  const lookup = useMutation({
    mutationFn: async () => (await api.get(`/sync/batches/${lookupId.trim()}`)).data as { status?: string; items?: SyncItemResult[]; results?: SyncItemResult[] },
    onSuccess: (b) => { setResults(b.items ?? b.results ?? []); setError(null); },
    onError: (e) => { setError(toProblem(e).title); setResults(null); },
  });

  // Giải quyết xung đột: lấy bản máy chủ (version + giá trị) để soạn lại rồi gửi.
  const resolveFromServer = (r: SyncItemResult) => {
    if (r.serverVersion != null) setBaseVersion(String(r.serverVersion));
    if (r.server?.name != null) setName(r.server.name);
    if (r.server?.address != null) setAddress(r.server.address);
    toast.info('Đã nạp bản máy chủ. Chỉnh sửa nếu cần rồi gửi lại để hợp nhất.');
  };

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Đồng bộ ngoài tuyến (UC-22)</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Soạn thay đổi khi mất kết nối rồi gửi lên khi trực tuyến. Lô gửi idempotent theo <span className="num">batchKey</span> (tự sinh). Nếu phiên bản gốc đã bị người khác thay đổi, hệ thống báo <b>xung đột</b> và không ghi đè.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Doanh trại</label>
          <select className="input" value={targetId} onChange={(e) => pick(e.target.value)}>
            <option value="">— Chọn doanh trại —</option>
            {(barracks.data?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Phiên bản gốc (baseVersion)</label>
          <input className="input num" type="number" min={0} value={baseVersion} onChange={(e) => setBaseVersion(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Tên (payload)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Địa chỉ (payload)</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" disabled={!targetId || send.isPending} onClick={() => send.mutate()}>
        <Icon name="upload" size={16} /> {send.isPending ? 'Đang gửi…' : 'Gửi lô đồng bộ'}
      </button>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-neutral-200)' }}>
        <input className="input num" style={{ maxWidth: 340 }} placeholder="Tra cứu theo UUID lô…" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
        <button className="btn" disabled={!lookupId.trim() || lookup.isPending} onClick={() => lookup.mutate()}><Icon name="search" size={15} /> Tra cứu lô</button>
      </div>

      {error && <div style={{ color: 'var(--danger-fg)', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}><Icon name="alert" size={15} /> {error}</div>}

      {results && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow">Kết quả xử lý ({results.length})</div>
          {results.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Không có bản ghi.</div>}
          {results.map((r) => {
            const s = RESULT_STYLE[r.status] ?? RESULT_STYLE.failed;
            return (
              <div key={r.localId} style={{ padding: '10px 12px', border: `1px solid ${s.bd}`, background: s.bg, color: s.fg, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Icon name={r.status === 'applied' ? 'check' : 'alert'} size={15} /> {s.label}
                  </span>
                  <span className="num" style={{ fontSize: 12 }}>{r.localId}</span>
                </div>
                {r.message && <div style={{ fontSize: 12.5, marginTop: 4 }}>{r.message}</div>}
                {r.status === 'conflict' && (
                  <div style={{ fontSize: 12.5, marginTop: 6 }}>
                    <div>Phiên bản máy chủ: <span className="num">{r.serverVersion}</span></div>
                    {r.server && <div>Bản máy chủ: <b>{r.server.name}</b>{r.server.address ? ` · ${r.server.address}` : ''}</div>}
                    <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => resolveFromServer(r)}>
                      <Icon name="refresh" size={13} /> Lấy bản máy chủ & thử lại
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
