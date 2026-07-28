import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { num, dateTime } from '../lib/format';

interface Campaign { id: string; code: string; name: string; status: string }
interface Sheet { id: string; campaignId: string; barracksId: string | null; status: string; note: string | null; createdAt: string }
interface Task { id: string; sheetId: string; status: string; submittedBy: string | null; createdAt: string }
interface Barracks { id: string; name: string }

export function InspectionPage() {
  const { hasRole } = useAuth();
  const canReview = hasRole('REVIEWER', 'BARRACKS_OFFICER', 'SYS_ADMIN');
  const [tab, setTab] = useState<'sheets' | 'review'>('sheets');

  return (
    <>
      <PageHeader
        eyebrow="Kiểm kê - biến động"
        title="Kiểm kê vật chất"
        description="Tổ chức đợt kiểm kê, lập phiếu số liệu hiện trạng và kiểm duyệt chênh lệch."
      />
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        <TabBtn active={tab === 'sheets'} onClick={() => setTab('sheets')}>Phiếu kiểm kê</TabBtn>
        {canReview && <TabBtn active={tab === 'review'} onClick={() => setTab('review')}>Kiểm duyệt</TabBtn>}
      </div>
      {tab === 'sheets' ? <SheetsTab /> : <ReviewTab />}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ all: 'unset', cursor: 'pointer', padding: '10px 16px', fontWeight: active ? 700 : 500, color: active ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: active ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{children}</button>
  );
}

function SheetsTab() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = useState('');
  const [creating, setCreating] = useState(false);

  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: async () => (await api.get('/inspection-campaigns', { params: { size: 100 } })).data as { data: Campaign[] } });
  const activeCampaign = campaignId || campaigns.data?.data?.[0]?.id || '';
  const progress = useQuery({
    queryKey: ['campaign-progress', activeCampaign],
    queryFn: async () => (await api.get(`/inspection-campaigns/${activeCampaign}/progress`)).data as { total: number; approved: number; completion: number },
    enabled: !!activeCampaign,
  });
  const sheets = useQuery({
    queryKey: ['sheets', activeCampaign],
    queryFn: async () => (await api.get('/inspection-sheets', { params: { campaignId: activeCampaign, size: 100 } })).data as { data: Sheet[] },
    enabled: !!activeCampaign,
  });

  const columns: Column<Sheet>[] = [
    { key: 'note', header: 'Ghi chú phiếu', render: (s) => <span style={{ fontWeight: 600 }}>{s.note || '(chưa đặt)'}</span> },
    { key: 'created', header: 'Tạo lúc', render: (s) => dateTime(s.createdAt), mono: true },
    { key: 'status', header: 'Trạng thái', render: (s) => <StatusBadge status={s.status} /> },
  ];

  if (campaigns.isLoading) return <Skeleton rows={4} />;
  if (campaigns.isError) return <ErrorState error={campaigns.error} />;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 320 }} value={activeCampaign} onChange={(e) => setCampaignId(e.target.value)}>
          {(campaigns.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
        </select>
        {progress.data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 320 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--color-neutral-300)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress.data.completion}%`, height: '100%', background: 'var(--teal)' }} />
            </div>
            <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>{progress.data.completion}% ({progress.data.approved}/{progress.data.total})</span>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo phiếu</button>
      </div>

      <DataTable columns={columns} rows={sheets.data?.data} loading={sheets.isLoading} rowKey={(s) => s.id} onRowClick={(s) => nav(`/inspection/sheet/${s.id}`)} emptyTitle="Chưa có phiếu kiểm kê" emptyHint="Bấm 'Tạo phiếu' để bắt đầu nhập số liệu." />

      {creating && <CreateSheetModal campaignId={activeCampaign} onClose={() => setCreating(false)} onCreated={(id) => { qc.invalidateQueries({ queryKey: ['sheets'] }); nav(`/inspection/sheet/${id}`); }} />}
    </>
  );
}

function CreateSheetModal({ campaignId, onClose, onCreated }: { campaignId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [barracksId, setBarracksId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const barracks = useQuery({ queryKey: ['barracks-all'], queryFn: async () => (await api.get('/barracks', { params: { size: 200 } })).data as { data: Barracks[] } });
  const create = useMutation({
    mutationFn: async () => (await api.post('/inspection-sheets', { campaignId, barracksId: barracksId || undefined, note: note || undefined })).data as { id: string },
    onSuccess: (d) => onCreated(d.id),
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Tạo phiếu kiểm kê" onClose={onClose}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="field-label">Doanh trại</label>
          <select className="input" value={barracksId} onChange={(e) => setBarracksId(e.target.value)}>
            <option value="">— Chọn doanh trại —</option>
            {(barracks.data?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Ghi chú</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Phạm vi phiếu…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}><Icon name="check" size={15} /> Tạo & nhập số liệu</button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewTab() {
  const qc = useQueryClient();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const tasks = useQuery({ queryKey: ['review-tasks'], queryFn: async () => (await api.get('/review-tasks', { params: { status: 'PENDING', size: 100 } })).data as { data: Task[] } });

  if (tasks.isLoading) return <Skeleton rows={4} />;
  if (tasks.isError) return <ErrorState error={tasks.error} />;
  if ((tasks.data?.data ?? []).length === 0) return <EmptyState icon="check" title="Không có phiếu chờ duyệt" hint="Hàng đợi kiểm duyệt đang trống." />;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(tasks.data?.data ?? []).map((t) => (
          <div key={t.id} className="panel" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="clipboard" size={16} /> Phiếu chờ duyệt</div>
              <div className="muted num" style={{ fontSize: 12 }}>Gửi lúc {dateTime(t.createdAt)}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setOpenTask(t.id)}>Kiểm duyệt</button>
          </div>
        ))}
      </div>
      {openTask && <ReviewModal taskId={openTask} onClose={() => setOpenTask(null)} onDone={() => { setOpenTask(null); qc.invalidateQueries({ queryKey: ['review-tasks'] }); }} />}
    </>
  );
}

function ReviewModal({ taskId, onClose, onDone }: { taskId: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const task = useQuery({ queryKey: ['review-task', taskId], queryFn: async () => (await api.get(`/review-tasks/${taskId}`)).data as { sheet: { note: string | null; lines: Array<{ label: string; unitCode: string | null; expectedQuantity: number | null; countedQuantity: number | null; variance: number | null }> } } });
  const decide = useMutation({
    mutationFn: async (action: 'approve' | 'request-revision') => api.post(`/review-tasks/${taskId}/${action}`, { note: note || undefined }),
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });

  return (
    <Modal open title="Kiểm duyệt phiếu kiểm kê" onClose={onClose} width={640}>
      {task.isLoading ? <Skeleton rows={4} /> : (
        <>
          {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
          <div className="panel scrl" style={{ overflow: 'auto', maxHeight: '40vh', marginBottom: 14 }}>
            <table className="data">
              <thead><tr><th>Đối tượng</th><th>ĐVT</th><th style={{ textAlign: 'right' }}>Sổ</th><th style={{ textAlign: 'right' }}>Thực tế</th><th style={{ textAlign: 'right' }}>Chênh lệch</th></tr></thead>
              <tbody>
                {(task.data?.sheet.lines ?? []).map((l, i) => (
                  <tr key={i} style={{ background: l.variance && l.variance !== 0 ? 'var(--warn-bg)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{l.label}</td>
                    <td>{l.unitCode ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.expectedQuantity != null ? num(l.expectedQuantity) : '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.countedQuantity != null ? num(l.countedQuantity) : '—'}</td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: l.variance == null ? 'inherit' : l.variance === 0 ? 'var(--ok-fg)' : 'var(--danger-fg)' }}>{l.variance == null ? '—' : (l.variance > 0 ? '+' : '') + num(l.variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="field-label">Nhận xét / lý do</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bắt buộc nêu lý do khi yêu cầu bổ sung" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => decide.mutate('request-revision')} disabled={decide.isPending}><Icon name="alert" size={15} /> Yêu cầu bổ sung</button>
            <button className="btn btn-primary" onClick={() => decide.mutate('approve')} disabled={decide.isPending}><Icon name="check" size={15} /> Phê duyệt</button>
          </div>
        </>
      )}
    </Modal>
  );
}
