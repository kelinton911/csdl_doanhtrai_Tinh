import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { DataTable, type Column } from './DataTable';

// Import Excel/CSV dòng vật chất cho một bản khai báo. Hai bước: soát lỗi (dryRun) → xác nhận ghi.
// Khớp danh mục chuẩn ở backend (theo mã → tên → alias). Tái dùng shape lỗi theo dòng/cột của /imports.

interface ImportError { row: number; column?: string; message: string }
interface ImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ImportError[];
  committed: number;
}

const TEMPLATE =
  'materialCode,openingQty,increaseQty,decreaseQty,closingQty,inUseQty,ministryStoreQty,unitStoreQty,grade1,grade2,grade3,grade4,grade5,unitPrice,note\n' +
  'VC-001,100,20,5,115,80,20,15,90,15,10,0,0,12,Ví dụ';

export function ImportLinesModal({
  declarationId,
  onClose,
  onDone,
}: {
  declarationId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);

  const send = (dryRun: boolean) =>
    (async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      return (await api.post(`/material-declarations/${declarationId}/lines/import`, fd, { params: { dryRun } })).data as ImportSummary;
    })();

  const check = useMutation({
    mutationFn: () => send(true),
    onSuccess: (s) => { setPreview(s); toast.info(`Đã soát: ${s.validRows} hợp lệ, ${s.errorRows} lỗi.`); },
    onError: (e) => toast.problem(e, 'Soát tệp thất bại'),
  });

  const commit = useMutation({
    mutationFn: () => send(false),
    onSuccess: (s) => {
      toast.success(`Đã nhập ${s.committed} dòng vào bản khai báo.`);
      onDone();
    },
    onError: (e) => toast.problem(e, 'Ghi dữ liệu thất bại'),
  });

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mau-nhap-vat-chat.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const errCols: Column<ImportError>[] = [
    { key: 'row', header: 'Dòng', render: (e) => e.row, mono: true, align: 'right', width: 70 },
    { key: 'col', header: 'Cột', render: (e) => e.column ?? '—', mono: true, width: 130 },
    { key: 'msg', header: 'Lỗi', render: (e) => <span style={{ color: 'var(--danger-fg)' }}>{e.message}</span> },
  ];

  return (
    <Modal open title="Nhập dòng vật chất từ Excel/CSV" onClose={onClose} width={720}>
      <div style={{ display: 'grid', gap: 14 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Cột <span className="num">materialCode</span> (hoặc tên khớp danh mục) là bắt buộc. Các cột số:
          đầu kỳ/tăng/giảm/cuối kỳ, đang dùng/kho Bộ-Ngành/kho đơn vị, grade1–5, đơn giá.
          Hỗ trợ tệp <span className="num">.xlsx</span> và <span className="num">.csv</span>. Dòng không khớp danh mục sẽ bị bỏ qua.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={downloadTemplate}><Icon name="download" size={14} /> Tải mẫu CSV</button>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
          />
          <button className="btn btn-primary" disabled={!file || check.isPending} onClick={() => check.mutate()}>
            <Icon name="search" size={15} /> {check.isPending ? 'Đang soát…' : 'Soát lỗi'}
          </button>
        </div>

        {check.isError && (
          <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', fontSize: 13 }}>
            {toProblem(check.error).title}
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13.5 }}>
              <Stat label="Tổng dòng" value={String(preview.totalRows)} />
              <Stat label="Hợp lệ" value={String(preview.validRows)} tone="ok" />
              <Stat label="Lỗi" value={String(preview.errorRows)} tone={preview.errorRows > 0 ? 'danger' : undefined} />
            </div>
            {preview.errors.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Chi tiết lỗi ({preview.errors.length})</div>
                <DataTable columns={errCols} rows={preview.errors} rowKey={(e) => `${e.row}-${e.column ?? ''}`} emptyTitle="Không có lỗi" />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
              <button className="btn btn-primary" disabled={preview.validRows === 0 || commit.isPending} onClick={() => commit.mutate()}>
                <Icon name="check" size={15} /> {commit.isPending ? 'Đang ghi…' : `Nhập ${preview.validRows} dòng hợp lệ`}
              </button>
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
