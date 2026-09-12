import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { EDITABLE_STATUSES } from '../lib/workflow';
import type { CommunePotential } from '../lib/communePotential';

// M17 — Danh sách bản khai Tiềm lực HC-KT khu vực cấp xã. Cùng luồng khai báo → duyệt
// như doanh trại/kho: DRAFT → (gửi duyệt) PENDING_REVIEW → (chỉ huy xã duyệt) APPROVED.
export function CommunePotentialListPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const size = 15;
  const canManage = can('COMMUNE_USER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');
  const canReview = can('REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const q = useQuery({
    queryKey: ['commune-potentials', page, search, status],
    queryFn: async () =>
      (await api.get('/commune-potentials', { params: { page, size, search: search || undefined, status: status || undefined } }))
        .data as { data: CommunePotential[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'submit' | 'approve' | 'request-changes' }) =>
      api.post(`/commune-potentials/${id}/${action}`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['commune-potentials'] });
      toast.success(v.action === 'submit' ? 'Đã gửi duyệt bản khai.' : v.action === 'approve' ? 'Đã duyệt bản khai.' : 'Đã trả lại để bổ sung.');
    },
    onError: (e) => toast.problem(e, 'Không thực hiện được'),
  });

  const columns: Column<CommunePotential>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 150 },
    { key: 'title', header: 'Tên bản khai', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'area', header: 'Khu vực', render: (r) => r.areaName ?? '—' },
    { key: 'period', header: 'Kỳ', render: (r) => r.periodLabel ?? '—', width: 120 },
    { key: 'wf', header: 'Trạng thái', render: (r) => <StatusBadge status={r.workflowStatus} />, width: 130 },
    {
      key: 'act', header: '', align: 'right', render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {canManage && EDITABLE_STATUSES.includes(r.workflowStatus) && (
            <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'submit' })}>
              <Icon name="upload" size={13} /> Gửi duyệt
            </button>
          )}
          {canReview && r.workflowStatus === 'PENDING_REVIEW' && (
            <>
              <button className="btn btn-sm" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'request-changes' })}>Trả lại</button>
              <button className="btn btn-sm btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: 'approve' })}><Icon name="check" size={13} /> Duyệt</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tiềm lực Hậu cần - Kỹ thuật"
        title="Khai báo tiềm lực HC-KT khu vực"
        description="Cấp xã khai báo tiềm lực HC-KT trên địa bàn (dân số/nhân lực, lương thực, y tế, xăng dầu, vận tải, cơ sở huy động) theo kỳ; gửi chỉ huy duyệt."
        actions={canManage ? (
          <button className="btn btn-primary" onClick={() => nav('/commune-potential/new')}><Icon name="plus" size={16} /> Khai báo tiềm lực</button>
        ) : undefined}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Tìm theo mã hoặc tên bản khai…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="CHANGES_REQUESTED">Yêu cầu bổ sung</option>
          <option value="APPROVED">Đã duyệt</option>
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable
            columns={columns}
            rows={q.data?.data}
            loading={q.isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/commune-potential/${r.id}/edit`)}
            emptyTitle="Chưa có bản khai tiềm lực"
            emptyHint="Bấm 'Khai báo tiềm lực' để tạo bản khai đầu tiên."
          />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}
