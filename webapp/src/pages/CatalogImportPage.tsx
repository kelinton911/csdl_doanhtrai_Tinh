import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import type { ImportBatch, ImportError } from '../lib/catalog';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';

// SCR-DT01-02 — Nhập danh mục (wizard 5 bước): nguồn → upload → mapping cột →
// kiểm tra → xác nhận. CHẶN xác nhận khi còn lỗi nghiêm trọng (BR-DT01-001/002).
type Row = { rowNo: number; code: string; name: string; parentCode?: string; unitCode?: string };

const STEPS = ['Nguồn', 'Tải dữ liệu', 'Ghép cột', 'Kiểm tra', 'Xác nhận'];

// Phân tích CSV thô: mỗi dòng "code,name,parentCode,unitCode".
function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  let rowNo = 0;
  for (const line of lines) {
    const cells = line.split(/[,;\t]/).map((c) => c.trim());
    if (rowNo === 0 && /^(code|mã|ma)$/i.test(cells[0])) continue; // bỏ header.
    rowNo += 1;
    rows.push({ rowNo, code: cells[0] ?? '', name: cells[1] ?? '', parentCode: cells[2] || undefined, unitCode: cells[3] || undefined });
  }
  return rows;
}

// SHA-256 hex của nội dung file (đối chiếu chống nhập trùng — file_hash).
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function CatalogImportPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [versionCode, setVersionCode] = useState('');
  const [fileName, setFileName] = useState('danh-muc.csv');
  const [raw, setRaw] = useState('');
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);

  const rows = useMemo(() => parseCsv(raw), [raw]);

  const validateMut = useMutation({
    mutationFn: async () => {
      const fileHash = await sha256(raw);
      const created = (await api.post<ImportBatch>('/catalog/import-batches', { fileName, fileHash, versionCode: versionCode || undefined, rows })).data;
      const validated = (await api.post<ImportBatch>(`/catalog/import-batches/${created.id}/validate`, {})).data;
      const errs = (await api.get<ImportError[]>(`/catalog/import-batches/${created.id}/errors`)).data;
      return { validated, errs };
    },
    onSuccess: ({ validated, errs }) => {
      setBatch(validated);
      setErrors(errs);
      setStep(3);
    },
    onError: (e) => toast.problem(e, 'Kiểm tra thất bại'),
  });

  const canNext =
    (step === 0 && versionCode.trim().length > 0) ||
    (step === 1 && rows.length > 0) ||
    step === 2;
  const hasErrors = errors.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="DT-01 · Nhập danh mục"
        title="Nhập danh mục chuẩn (wizard)"
        description="Nguồn → tải dữ liệu → ghép cột → kiểm tra → xác nhận. Không cho công bố khi còn lỗi nghiêm trọng."
        actions={<Link className="btn btn-ghost btn-sm" to="/catalog"><Icon name="chevron" size={15} /> Về danh mục</Link>}
      />

      {/* Stepper */}
      <div className="panel" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
              background: i < step ? 'var(--ok-bg)' : i === step ? 'var(--color-accent-600, #2563eb)' : 'var(--color-neutral-200)',
              color: i === step ? '#fff' : i < step ? 'var(--ok-fg)' : 'var(--color-neutral-600)',
            }}>{i < step ? '✓' : i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: i === step ? 700 : 400 }}>{s}</span>
            {i < STEPS.length - 1 && <span style={{ color: 'var(--color-neutral-400)' }}>→</span>}
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 20 }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>Mã phiên bản danh mục *</span>
              <input value={versionCode} onChange={(e) => setVersionCode(e.target.value)} placeholder="VD: R00-DT-2026" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>Tên tệp nguồn</span>
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </label>
            <p className="muted" style={{ fontSize: 12.5 }}>Nguồn kế thừa Tổng danh mục R00 cấp trên (bắt đầu R00.00.00.00.00.000).</p>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>Dán nội dung CSV: mỗi dòng <code>mã,tên,mã_cha,ĐVT</code></div>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder={'R00.01,Doanh cụ,,\nR00.01.01,Bàn làm việc,R00.01,CAI'} style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }} />
            <div className="muted" style={{ fontSize: 12.5 }}>Đã nhận diện <b>{rows.length}</b> dòng.</div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Ghép cột (theo thứ tự CSV):</div>
            <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {[['Cột 1', 'Mã chuẩn (code)'], ['Cột 2', 'Tên (name)'], ['Cột 3', 'Mã cha (parentCode)'], ['Cột 4', 'Đơn vị tính (unitCode)']].map(([a, b]) => (
                  <tr key={a}><td style={{ padding: '4px 12px', color: 'var(--color-neutral-600)' }}>{a}</td><td style={{ padding: '4px 12px', fontWeight: 600 }}>→ {b}</td></tr>
                ))}
              </tbody>
            </table>
            <PreviewTable rows={rows.slice(0, 8)} />
          </div>
        )}

        {step === 3 && (
          <div>
            {validateMut.isPending ? (
              <div className="muted">Đang kiểm tra…</div>
            ) : batch ? (
              <>
                <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
                  <Stat label="Tổng dòng" value={batch.totalRows} />
                  <Stat label="Hợp lệ" value={batch.validRows} tone="ok" />
                  <Stat label="Lỗi" value={batch.errorRows} tone={batch.errorRows ? 'danger' : 'ok'} />
                </div>
                {hasErrors ? (
                  <div className="panel" style={{ padding: 0, overflow: 'hidden', borderColor: 'var(--danger-bd)' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger-fg)', fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Icon name="alert" size={16} /> {errors.length} lỗi — phải sửa nguồn trước khi công bố
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)' }}><th style={{ padding: '6px 10px' }}>Dòng</th><th>Trường</th><th>Mã lỗi</th><th>Chi tiết</th></tr></thead>
                      <tbody>
                        {errors.map((e) => (
                          <tr key={e.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                            <td style={{ padding: '6px 10px' }} className="num">{e.rowNo}</td>
                            <td>{e.fieldName ?? '—'}</td>
                            <td className="num">{e.errorCode}</td>
                            <td>{e.errorMessage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="panel" style={{ padding: 16, borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', color: 'var(--ok-fg)', display: 'flex', gap: 10 }}>
                    <Icon name="check" size={20} /> Không có lỗi — có thể xác nhận nhập.
                  </div>
                )}
              </>
            ) : (
              <div className="muted">Bấm “Kiểm tra dữ liệu” để chạy validate.</div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="panel" style={{ padding: 20, borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>
            <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={18} /> Lô nhập đã kiểm tra hợp lệ</div>
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              Phiên bản <b>{versionCode}</b> · {batch?.validRows ?? rows.length} dòng hợp lệ. Lô sẵn sàng đưa vào phiên bản nháp để rà soát & công bố.
            </div>
          </div>
        )}
      </div>

      {/* Điều hướng bước */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Quay lại</button>
        {step === 2 ? (
          <button className="btn btn-primary" onClick={() => validateMut.mutate()} disabled={validateMut.isPending || rows.length === 0}>
            <Icon name="check" size={15} /> Kiểm tra dữ liệu
          </button>
        ) : step === 3 ? (
          <button className="btn btn-primary" disabled={hasErrors || !batch} onClick={() => setStep(4)} title={hasErrors ? 'Còn lỗi — không thể tiếp tục' : ''}>
            Tiếp tục
          </button>
        ) : step === 4 ? (
          <button className="btn btn-primary" onClick={() => { toast.success('Đã hoàn tất nhập danh mục.'); nav('/catalog'); }}>
            <Icon name="check" size={15} /> Hoàn tất
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Tiếp tục</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'inherit';
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Chưa có dữ liệu để xem trước.</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 14 }}>
      <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)' }}><th style={{ padding: '6px 10px' }}>Mã</th><th>Tên</th><th>Mã cha</th><th>ĐVT</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rowNo} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
            <td style={{ padding: '6px 10px' }} className="num">{r.code}</td><td>{r.name}</td><td className="num">{r.parentCode ?? '—'}</td><td>{r.unitCode ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
