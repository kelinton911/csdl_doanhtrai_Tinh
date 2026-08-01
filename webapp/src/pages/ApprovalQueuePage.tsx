import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { dateTime } from '../lib/format';

// Hàng chờ duyệt GỘP: chỉ huy xã (và Ban doanh trại Tỉnh) duyệt hồ sơ doanh trại +
// kho trạm tại một chỗ. Duyệt xong = dữ liệu chính thức để cấp Tỉnh nắm.
interface PendingRow {
  kind: 'barracks' | 'storage';
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  workflowStatus: string;
  updatedAt: string;
}

const KIND_LABEL: Record<PendingRow['kind'], string> = {
  barracks: 'Doanh trại',
  storage: 'Kho trạm',
};

// Endpoint duyệt/trả lại theo loại hồ sơ.
function actionBase(kind: PendingRow['kind'], id: string): string {
  return kind === 'barracks' ? `/barracks/${id}` : `/inventory/storage-locations/${id}`;
}

export function ApprovalQueuePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canReview = can('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => (await api.get('/approvals')).data as PendingRow[],
    refetchInterval: 60_000,
  });

  const act = useMutation({
    mutationFn: async ({ row, action }: { row: PendingRow; action: 'approve' | 'request-changes' }) =>
      api.post(`${actionBase(row.kind, row.id)}/${action}`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['storage-list'] });
      toast.success(v.action === 'approve' ? 'Đã duyệt hồ sơ.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const columns: Column<PendingRow>[] = [
    { key: 'kind', header: 'Loại', render: (r) => <span style={{ fontWeight: 600 }}>{KIND_LABEL[r.kind]}</span>, width: 110 },
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 130 },
    { key: 'name', header: 'Tên hồ sơ', render: (r) => r.name },
    { key: 'area', header: 'Địa bàn', render: (r) => r.areaName ?? '—' },
    { key: 'wf', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} /> },
    { key: 'time', header: 'Gửi lúc', render: (r) => dateTime(r.updatedAt), mono: true, width: 150 },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); navigate(r.kind === 'barracks' ? `/barracks/${r.id}` : '/storage'); }} title="Xem hồ sơ"><Icon name="search" size={13} /></button>
          {canReview && (
            <>
              <button className="btn btn-sm" disabled={act.isPending} onClick={(e) => { e.stopPropagation(); act.mutate({ row: r, action: 'request-changes' }); }}>Trả lại</button>
              <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={(e) => { e.stopPropagation(); act.mutate({ row: r, action: 'approve' }); }}><Icon name="check" size={13} /> Duyệt</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Duyệt & kiểm tra"
        title="Hàng chờ duyệt"
        description="Hồ sơ đang chờ duyệt trong phạm vi phụ trách (doanh trại + kho trạm). Người lập không tự duyệt hồ sơ của mình."
      />
      {q.isError ? <ErrorState error={q.error} /> : (
        <DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(r) => `${r.kind}-${r.id}`} emptyTitle="Không có hồ sơ chờ duyệt" />
      )}
    </>
  );
}
