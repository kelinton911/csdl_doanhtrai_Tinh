import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { useDeclarations, type Declaration } from '../lib/materialDeclarations';

const QUICK = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { key: 'CHANGES_REQUESTED', label: 'Yêu cầu bổ sung' },
  { key: 'APPROVED', label: 'Đã duyệt' },
];

const DECLARERS = ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'COMMUNE_USER', 'UNIT_USER'];

// Khai báo vật chất của xã/đơn vị — danh sách (lọc theo phạm vi đơn vị ở tầng server).
export function MaterialDeclarationsListPage() {
  const nav = useNavigate();
  const { hasRole } = useAuth();
  const [status, setStatus] = useState('');
  const q = useDeclarations();
  const rows = (q.data ?? []).filter((r) => !status || r.workflowStatus === status);

  const columns: Column<Declaration>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 160 },
    { key: 'title', header: 'Tên bản khai báo', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'period', header: 'Kỳ', render: (r) => r.periodLabel ?? '—' },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
    { key: 'updated', header: 'Cập nhật', render: (r) => new Date(r.updatedAt).toLocaleDateString('vi-VN') },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Khai báo vật chất (xã/đơn vị)"
        title="Bản khai báo vật chất"
        description="Đơn vị cấp cơ sở khai báo vật chất theo danh mục chuẩn. Toàn quyền nhập khi chưa duyệt; duyệt xong khóa. Muốn sửa sau duyệt phải đề nghị cấp trên."
        actions={
          hasRole(...DECLARERS) ? (
            <button className="btn btn-primary" onClick={() => nav('/material-declarations/new')}>
              <Icon name="plus" size={16} /> Tạo bản khai báo
            </button>
          ) : null
        }
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {QUICK.map((f) => (
          <button
            key={f.key}
            className="btn btn-sm"
            onClick={() => setStatus(f.key)}
            style={{ background: status === f.key ? 'var(--color-accent-600)' : 'var(--surface-1)', color: status === f.key ? '#fff' : 'var(--color-text)', borderColor: status === f.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/material-declarations/${r.id}`)}
          emptyTitle="Chưa có bản khai báo"
          emptyHint="Bấm 'Tạo bản khai báo' để bắt đầu khai báo vật chất."
        />
      )}
    </>
  );
}
