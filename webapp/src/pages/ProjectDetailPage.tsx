import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, currency, dateTime } from '../lib/format';
import { PhaseChip, ProgressBar } from './ProjectsListPage';
import {
  PROJECT_TYPE_LABEL, FUNDING_LABEL, PHASE_LABEL, PHASE_ORDER, phaseColor,
  MILESTONE_KIND_LABEL, MILESTONE_KIND_OPTIONS, nextPhase,
} from '../lib/project';

interface Project {
  id: string; code: string; name: string; projectType: string; fundingSource: string | null;
  totalEstimate: string; approvedCapital: string; disbursed: number; contractValue: string;
  contractorName: string | null; contractNo: string | null; contractSignedDate: string | null;
  startDate: string | null; plannedEndDate: string | null; actualEndDate: string | null;
  progressPercent: number; phase: string; facilityId: string | null; barracksId: string | null;
  barracksName: string | null; areaName: string | null; orgName: string | null; description: string | null; notes: string | null; updatedAt: string;
}
interface Milestone { id: string; title: string; milestoneDate: string; kind: string; progressPercent: number | null; amount: number | null; note: string | null }

const TABS = ['Tổng quan & vòng đời', 'Nhật ký & giải ngân'] as const;

export function ProjectDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan & vòng đời');
  const [docs, setDocs] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const p = useQuery({ queryKey: ['project', id], queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data });
  const milestones = useQuery({
    queryKey: ['project', id, 'milestones'],
    queryFn: async () => (await api.get<Milestone[]>(`/projects/${id}/milestones`)).data,
    enabled: tab === 'Nhật ký & giải ngân',
  });
  const canManage = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND');

  const phaseMut = useMutation({
    mutationFn: async (phase: string) => (await api.post(`/projects/${id}/phase`, { phase })).data,
    onSuccess: (_d, phase) => { setActionError(null); qc.invalidateQueries({ queryKey: ['project', id] }); qc.invalidateQueries({ queryKey: ['projects-summary'] }); toast.success(phase === 'CANCELLED' ? 'Đã hủy dự án.' : `Đã chuyển sang: ${PHASE_LABEL[phase] ?? phase}`); },
    onError: (e) => { setActionError(toProblem(e).title); toast.problem(e); },
  });
  const delMs = useMutation({
    mutationFn: async (mid: string) => api.delete(`/projects/${id}/milestones/${mid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id, 'milestones'] }); qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Đã xóa mốc.'); },
    onError: (e) => toast.problem(e),
  });

  if (p.isLoading) return <Skeleton rows={6} />;
  if (p.isError || !p.data) return <ErrorState error={p.error} />;
  const d = p.data;
  const next = nextPhase(d.phase);
  const isTerminal = ['CLOSED', 'CANCELLED'].includes(d.phase);
  const delayed = d.plannedEndDate && !['HANDED_OVER', 'WARRANTY', 'CLOSED', 'CANCELLED'].includes(d.phase) && new Date(d.plannedEndDate) < new Date();
  const approved = Number(d.approvedCapital);
  const disbursedPct = approved > 0 ? Math.round((d.disbursed / approved) * 100) : 0;
  const overBudget = approved > 0 && d.disbursed > approved;

  const msCols: Column<Milestone>[] = [
    { key: 'date', header: 'Ngày', render: (m) => m.milestoneDate, mono: true, width: 110 },
    { key: 'kind', header: 'Loại', render: (m) => MILESTONE_KIND_LABEL[m.kind] ?? m.kind },
    { key: 'title', header: 'Nội dung', render: (m) => <span style={{ fontWeight: 600 }}>{m.title}</span> },
    { key: 'val', header: 'Giá trị', render: (m) => m.kind === 'PAYMENT' && m.amount != null ? currency(m.amount) : m.progressPercent != null ? `${m.progressPercent}%` : '—', align: 'right', mono: true },
    { key: 'act', header: '', align: 'right', render: (m) => canManage ? <button className="btn btn-sm btn-ghost" onClick={() => delMs.mutate(m.id)}><Icon name="logout" size={13} /></button> : null },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/projects')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách dự án
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${PROJECT_TYPE_LABEL[d.projectType] ?? d.projectType}`}
        title={d.name}
        description={`${d.barracksName ? d.barracksName + ' · ' : ''}${FUNDING_LABEL[d.fundingSource ?? ''] ?? ''} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <PhaseChip phase={d.phase} />
            <button className="btn" onClick={() => setDocs(true)}><Icon name="file" size={16} /> Hồ sơ dự án</button>
            {canManage && !isTerminal && <button className="btn" onClick={() => nav(`/projects/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && next && <button className="btn btn-primary" disabled={phaseMut.isPending} onClick={() => phaseMut.mutate(next)}><Icon name="chevron" size={16} /> Chuyển: {PHASE_LABEL[next]}</button>}
            {canManage && !isTerminal && <button className="btn" disabled={phaseMut.isPending} onClick={() => { if (confirm('Hủy dự án này?')) phaseMut.mutate('CANCELLED'); }}><Icon name="alert" size={16} /> Hủy</button>}
          </div>
        }
      />

      {delayed && <Banner tone="danger" icon="clock">Dự án chậm tiến độ — hạn kế hoạch {String(d.plannedEndDate).slice(0, 10)}.</Banner>}
      {overBudget && <Banner tone="danger" icon="alert">Đã giải ngân ({currency(d.disbursed)}) vượt vốn được duyệt ({currency(approved)}).</Banner>}
      {d.facilityId && d.barracksId && <Banner tone="ok" icon="check">Dự án đã bàn giao — công trình đã được ghi nhận vào tài sản doanh trại. <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => nav(`/barracks/${d.barracksId}`)}>Xem doanh trại</button></Banner>}
      {actionError && <Banner tone="danger" icon="alert">{actionError}</Banner>}

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={{ all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{t}</button>)}
      </div>

      {tab === 'Tổng quan & vòng đời' && (
        <>
          {/* Vòng đời */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Giai đoạn vòng đời</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.phase === 'CANCELLED' ? <PhaseChip phase="CANCELLED" /> : PHASE_ORDER.map((ph, i) => {
                const curIdx = PHASE_ORDER.indexOf(d.phase);
                const done = i < curIdx, active = i === curIdx;
                const c = phaseColor(ph);
                return (
                  <span key={ph} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? c.fg : done ? 'var(--ok-fg)' : 'var(--color-neutral-500)', background: active ? c.bg : 'transparent', border: `1px solid ${active ? c.bd : 'var(--color-neutral-300)'}`, padding: '4px 10px', borderRadius: 14 }}>
                    {done && <Icon name="check" size={12} />}{PHASE_LABEL[ph]}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="field-grid">
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Dự toán & giải ngân</div>
              <Field label="Tổng dự toán" value={currency(d.totalEstimate)} mono />
              <Field label="Vốn được duyệt" value={currency(d.approvedCapital)} mono />
              <Field label="Đã giải ngân" value={currency(d.disbursed)} mono />
              <div style={{ margin: '10px 0 4px', fontSize: 12, color: 'var(--color-neutral-600)' }}>Tỉ lệ giải ngân / vốn duyệt</div>
              <ProgressBar pct={disbursedPct} />
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-neutral-600)' }}>Tiến độ thi công</div>
              <div style={{ marginTop: 4 }}><ProgressBar pct={d.progressPercent} /></div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Nhà thầu, hợp đồng & mốc thời gian</div>
              <Field label="Nhà thầu" value={d.contractorName ?? '—'} />
              <Field label="Số hợp đồng" value={d.contractNo ?? '—'} mono />
              <Field label="Giá trị hợp đồng" value={Number(d.contractValue) > 0 ? currency(d.contractValue) : '—'} mono />
              <Field label="Ngày ký HĐ" value={d.contractSignedDate ? String(d.contractSignedDate).slice(0, 10) : '—'} mono />
              <Field label="Bắt đầu" value={d.startDate ? String(d.startDate).slice(0, 10) : '—'} mono />
              <Field label="Hạn kế hoạch" value={d.plannedEndDate ? String(d.plannedEndDate).slice(0, 10) : '—'} mono />
              <Field label="Hoàn thành thực tế" value={d.actualEndDate ? String(d.actualEndDate).slice(0, 10) : '—'} mono />
              <Field label="Địa bàn" value={d.areaName ?? '—'} />
            </div>
          </div>
          {d.description && <div className="card" style={{ padding: 16, marginTop: 16 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Mô tả</div><p style={{ fontSize: 13.5, margin: 0 }}>{d.description}</p></div>}
        </>
      )}

      {tab === 'Nhật ký & giải ngân' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Nhật ký tiến độ · nghiệm thu · giải ngân</div>
            {canManage && !isTerminal && <button className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Thêm mốc</button>}
          </div>
          <DataTable columns={msCols} rows={milestones.data} loading={milestones.isLoading} rowKey={(m) => m.id} emptyTitle="Chưa có mốc nào" emptyHint="Ghi nhận tiến độ, nghiệm thu, giải ngân theo từng mốc." />
        </>
      )}

      {docs && <EvidenceDrawer entityType="project" entityId={id!} title={`Hồ sơ dự án · ${d.code}`} onClose={() => setDocs(false)} />}
      {addOpen && <AddMilestoneModal projectId={id!} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['project', id, 'milestones'] }); qc.invalidateQueries({ queryKey: ['project', id] }); }} />}
    </>
  );
}

function AddMilestoneModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', milestoneDate: new Date().toISOString().slice(0, 10), kind: 'PROGRESS', progressPercent: '', amount: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/projects/${projectId}/milestones`, {
      title: f.title.trim(), milestoneDate: f.milestoneDate, kind: f.kind,
      progressPercent: f.kind === 'PROGRESS' && f.progressPercent ? Number(f.progressPercent) : undefined,
      amount: f.kind === 'PAYMENT' && f.amount ? Number(f.amount) : undefined,
      note: f.note || undefined,
    }),
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Thêm mốc dự án" onClose={onClose} width={480}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Loại mốc</label><select className="input" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))}>{MILESTONE_KIND_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></div>
        <div><label className="field-label">Nội dung</label><input className="input" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></div>
        <div><label className="field-label">Ngày</label><input className="input" type="date" value={f.milestoneDate} onChange={(e) => setF((s) => ({ ...s, milestoneDate: e.target.value }))} /></div>
        {f.kind === 'PROGRESS' && <div><label className="field-label">Tiến độ (%)</label><input className="input num" type="number" min={0} max={100} value={f.progressPercent} onChange={(e) => setF((s) => ({ ...s, progressPercent: e.target.value }))} /></div>}
        {f.kind === 'PAYMENT' && <div><label className="field-label">Số tiền giải ngân (VND)</label><input className="input num" type="number" min={0} value={f.amount} onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))} /></div>}
        <div><label className="field-label">Ghi chú</label><input className="input" value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.title.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>Lưu mốc</button></div>
      </div>
    </Modal>
  );
}

function Banner({ tone, icon, children }: { tone: 'ok' | 'danger'; icon: 'clock' | 'alert' | 'check'; children: React.ReactNode }) {
  const c = tone === 'ok' ? { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' } : { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
  return <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}><Icon name={icon} size={18} /> {children}</div>;
}
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span></div>);
}
