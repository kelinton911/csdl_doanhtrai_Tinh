import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { Modal } from '../components/Modal';
import { AsyncPicker } from '../components/AsyncPicker';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { dateTime } from '../lib/format';
import { InspStatusChip } from './InspectionsListPage';
import {
  TYPE_LABEL, STATUS_LABEL, SEVERITY_LABEL, severityColor, SEVERITY_OPTIONS,
  FINDING_STATUS_LABEL, findingStatusColor,
} from '../lib/oversight';

interface Finding {
  id: string; title: string; severity: string; recommendation: string | null; dueDate: string | null;
  status: string; resolutionNote: string | null; resolvedAt: string | null;
  responsibleOrgName: string | null; responsibleAreaName: string | null;
}
interface Inspection {
  id: string; code: string; title: string; inspectionType: string; scope: string | null; status: string;
  leadName: string | null; teamNote: string | null; plannedDate: string | null; startDate: string | null; endDate: string | null;
  conclusion: string | null; targetOrgName: string | null; targetAreaName: string | null; targetBarracksName: string | null;
  updatedAt: string; findings: Finding[];
}

const NEXT: Record<string, { to: string; label: string }[]> = {
  PLANNED: [{ to: 'IN_PROGRESS', label: 'Bắt đầu kiểm tra' }],
  IN_PROGRESS: [{ to: 'REPORTED', label: 'Lập biên bản' }],
  REPORTED: [{ to: 'CLOSED', label: 'Kết thúc' }],
};

export function InspectionDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [docs, setDocs] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resolve, setResolve] = useState<{ finding: Finding; target: 'RESOLVED' | 'ACCEPTED' } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const i = useQuery({ queryKey: ['inspection', id], queryFn: async () => (await api.get<Inspection>(`/inspections/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inspection', id] }); qc.invalidateQueries({ queryKey: ['inspections-summary'] }); };

  const setStatus = useMutation({
    mutationFn: async (status: string) => (await api.post(`/inspections/${id}/status`, { status })).data,
    onSuccess: (_d, st) => { setErr(null); refresh(); toast.success(`Đã chuyển: ${STATUS_LABEL[st] ?? st}`); },
    onError: (e) => { setErr(toProblem(e).title); toast.problem(e); },
  });
  const findingStatus = useMutation({
    mutationFn: async (v: { fid: string; status: string; note?: string }) => (await api.post(`/inspections/${id}/findings/${v.fid}/status/${v.status}`, { resolutionNote: v.note })).data,
    onSuccess: () => { refresh(); toast.success('Đã cập nhật kiến nghị.'); },
    onError: (e) => toast.problem(e),
  });
  const delFinding = useMutation({
    mutationFn: async (fid: string) => api.delete(`/inspections/${id}/findings/${fid}`),
    onSuccess: () => { refresh(); toast.success('Đã xóa phát hiện.'); },
    onError: (e) => toast.problem(e),
  });

  if (i.isLoading) return <Skeleton rows={6} />;
  if (i.isError || !i.data) return <ErrorState error={i.error} />;
  const d = i.data;
  const canManage = hasRole('AUDITOR', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN');
  const canResolve = hasRole('AUDITOR', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN', 'COMMUNE_USER');
  const terminal = ['CLOSED', 'CANCELLED'].includes(d.status);
  const nexts = NEXT[d.status] ?? [];
  const target = d.targetOrgName || d.targetBarracksName || d.targetAreaName || '—';

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/audits')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách kiểm tra
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${TYPE_LABEL[d.inspectionType] ?? d.inspectionType}`}
        title={d.title}
        description={`Đối tượng: ${target} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <InspStatusChip status={d.status} />
            <button className="btn" onClick={() => setDocs(true)}><Icon name="file" size={16} /> Biên bản/chứng cứ</button>
            {canManage && !terminal && <button className="btn" onClick={() => nav(`/audits/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && nexts.map((n) => <button key={n.to} className="btn btn-primary" disabled={setStatus.isPending} onClick={() => setStatus.mutate(n.to)}><Icon name="chevron" size={16} /> {n.label}</button>)}
            {canManage && !terminal && <button className="btn" disabled={setStatus.isPending} onClick={() => { if (confirm('Hủy cuộc kiểm tra?')) setStatus.mutate('CANCELLED'); }}>Hủy</button>}
          </div>
        }
      />
      {err && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={16} /> {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="field-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin cuộc kiểm tra</div>
          <Field label="Đối tượng" value={target} />
          <Field label="Trưởng đoàn" value={d.leadName ?? '—'} />
          <Field label="Ngày kế hoạch" value={d.plannedDate ? String(d.plannedDate).slice(0, 10) : '—'} mono />
          <Field label="Bắt đầu → Kết thúc" value={`${d.startDate ? String(d.startDate).slice(0, 10) : '—'} → ${d.endDate ? String(d.endDate).slice(0, 10) : '—'}`} mono />
          {d.scope && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}><b>Phạm vi:</b> {d.scope}</p>}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Kết luận</div>
          {d.conclusion ? <p style={{ fontSize: 13.5, margin: 0 }}>{d.conclusion}</p> : <p className="muted" style={{ fontSize: 13 }}>Chưa có kết luận (cập nhật khi lập biên bản).</p>}
          {d.teamNote && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}><b>Đoàn:</b> {d.teamNote}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="eyebrow">Phát hiện & kiến nghị ({d.findings.length})</div>
        {canManage && d.status !== 'CANCELLED' && <button className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Thêm phát hiện</button>}
      </div>

      {d.findings.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>Chưa ghi nhận phát hiện/kiến nghị.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.findings.map((f) => {
            const overdue = f.dueDate && !['RESOLVED', 'ACCEPTED'].includes(f.status) && new Date(f.dueDate) < new Date();
            const fc = findingStatusColor(f.status);
            return (
              <div key={f.id} className="card" style={{ padding: 14, borderLeft: `4px solid ${severityColor(f.severity)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ color: severityColor(f.severity), fontWeight: 700, fontSize: 12 }}>{SEVERITY_LABEL[f.severity] ?? f.severity}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: fc.fg, background: fc.bg, border: `1px solid ${fc.bd}`, padding: '1px 8px', borderRadius: 10 }}>{FINDING_STATUS_LABEL[f.status] ?? f.status}</span>
                      {f.dueDate && <span className="num" style={{ fontSize: 11.5, color: overdue ? 'var(--danger-fg)' : 'var(--color-neutral-600)', fontWeight: overdue ? 700 : 400 }}>Hạn {String(f.dueDate).slice(0, 10)}{overdue ? ' ⚠' : ''}</span>}
                      {(f.responsibleOrgName || f.responsibleAreaName) && <span className="muted" style={{ fontSize: 11.5 }}>TN: {f.responsibleOrgName || f.responsibleAreaName}</span>}
                    </div>
                    {f.recommendation && <div style={{ fontSize: 13, marginTop: 6 }}><b>Kiến nghị:</b> {f.recommendation}</div>}
                    {f.resolutionNote && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--ok-fg)' }}><b>Khắc phục:</b> {f.resolutionNote}</div>}
                  </div>
                  {canResolve && d.status !== 'CANCELLED' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      {['OPEN'].includes(f.status) && <button className="btn btn-sm" onClick={() => findingStatus.mutate({ fid: f.id, status: 'IN_PROGRESS' })}>Đang khắc phục</button>}
                      {['OPEN', 'IN_PROGRESS'].includes(f.status) && <button className="btn btn-sm" onClick={() => setResolve({ finding: f, target: 'RESOLVED' })}>Đã khắc phục</button>}
                      {f.status === 'RESOLVED' && canManage && <button className="btn btn-sm btn-primary" onClick={() => setResolve({ finding: f, target: 'ACCEPTED' })}>Xác nhận</button>}
                      {['RESOLVED', 'ACCEPTED'].includes(f.status) && <button className="btn btn-sm" onClick={() => findingStatus.mutate({ fid: f.id, status: 'IN_PROGRESS' })}>Mở lại</button>}
                      {canManage && <button className="btn btn-sm btn-ghost" onClick={() => delFinding.mutate(f.id)}><Icon name="logout" size={13} /></button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {docs && <EvidenceDrawer entityType="inspection_audit" entityId={id!} title={`Biên bản/chứng cứ · ${d.code}`} onClose={() => setDocs(false)} />}
      {addOpen && <AddFindingModal inspectionId={id!} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); refresh(); }} />}
      {resolve && <ResolveModal label={resolve.target === 'ACCEPTED' ? 'Xác nhận khắc phục' : 'Ghi nhận đã khắc phục'} onClose={() => setResolve(null)} onSubmit={(note) => { findingStatus.mutate({ fid: resolve.finding.id, status: resolve.target, note }); setResolve(null); }} />}
    </>
  );
}

function AddFindingModal({ inspectionId, onClose, onDone }: { inspectionId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', severity: 'MEDIUM', recommendation: '', responsibleAreaId: '', dueDate: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/inspections/${inspectionId}/findings`, { title: f.title.trim(), severity: f.severity, recommendation: f.recommendation || undefined, responsibleAreaId: f.responsibleAreaId || undefined, dueDate: f.dueDate || undefined }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Thêm phát hiện / kiến nghị" onClose={onClose} width={540}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Nội dung phát hiện</label><input className="input" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mức độ</label><select className="input" value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}>{SEVERITY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Hạn khắc phục</label><input className="input" type="date" value={f.dueDate} onChange={(e) => setF((s) => ({ ...s, dueDate: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Kiến nghị</label><textarea className="input" rows={2} value={f.recommendation} onChange={(e) => setF((s) => ({ ...s, recommendation: e.target.value }))} /></div>
        <div><label className="field-label">Đơn vị/địa bàn chịu trách nhiệm</label><AsyncPicker endpoint="/administrative-areas" value={f.responsibleAreaId} onChange={(v) => setF((s) => ({ ...s, responsibleAreaId: v }))} placeholder="Tìm xã/phường…" /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.title.trim().length < 3 || save.isPending} onClick={() => save.mutate()}>Lưu phát hiện</button></div>
      </div>
    </Modal>
  );
}

function ResolveModal({ label, onClose, onSubmit }: { label: string; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal open title={label} onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Nội dung khắc phục / xác nhận</label><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" onClick={() => onSubmit(note)}>Xác nhận</button></div>
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span></div>);
}
