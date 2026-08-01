import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Skeleton, ErrorState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE } from '../../lib/roles';
import { num, dateTime } from '../../lib/format';

interface Summary { barracks: { total: number; approved: number; pending: number } }
interface PendingRow {
  kind: 'barracks' | 'storage';
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  workflowStatus: string;
  updatedAt: string;
}
const KIND_LABEL: Record<PendingRow['kind'], string> = { barracks: 'Doanh trại', storage: 'Kho trạm' };
function actionBase(kind: PendingRow['kind'], id: string): string {
  return kind === 'barracks' ? `/barracks/${id}` : `/inventory/storage-locations/${id}`;
}

// Workspace KIỂM DUYỆT VIÊN — hàng chờ duyệt là trung tâm: duyệt/trả lại ngay tại chỗ,
// kèm chỉ số thông lượng. Người lập không tự duyệt hồ sơ của mình (server chặn).
export function ReviewWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canReview = can('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND');

  const sum = useQuery({
    queryKey: ['dashboard-summary', 'review'],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: 'NORMAL' } })).data,
    refetchInterval: 60_000,
  });
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
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success(v.action === 'approve' ? 'Đã duyệt hồ sơ.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const rows = q.data ?? [];
  const barracksPending = rows.filter((r) => r.kind === 'barracks').length;
  const storagePending = rows.filter((r) => r.kind === 'storage').length;

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
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); nav(r.kind === 'barracks' ? `/barracks/${r.id}` : '/storage'); }} title="Xem hồ sơ"><Icon name="search" size={13} /></button>
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
        eyebrow="Kiểm duyệt viên · Phê chuẩn hồ sơ"
        title={`Bàn kiểm duyệt${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.REVIEWER}
      />
      <QuickActions actions={quickActionsFor('review')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 22 }}>
        <KpiCard label="Đang chờ duyệt (tất cả)" value={num(rows.length)} unit="hồ sơ" icon="clock" dom="audit" />
        <KpiCard label="Doanh trại chờ duyệt" value={num(barracksPending)} unit="hồ sơ" icon="building" dom="asset" />
        <KpiCard label="Kho trạm chờ duyệt" value={num(storagePending)} unit="hồ sơ" icon="box" dom="stock" />
        <KpiCard label="Hồ sơ đã phê duyệt" value={num(sum.data?.barracks.approved ?? 0)} unit="hồ sơ" icon="check" dom="cap" onClick={() => nav('/barracks')} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="eyebrow">Hàng chờ duyệt</div>
        <button className="btn btn-sm" onClick={() => nav('/approvals')}><Icon name="check" size={14} /> Mở trang duyệt đầy đủ</button>
      </div>
      {q.isLoading ? <Skeleton rows={5} /> : q.isError ? <ErrorState error={q.error} /> : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.kind}-${r.id}`} emptyTitle="Không có hồ sơ chờ duyệt" />
      )}
    </>
  );
}
