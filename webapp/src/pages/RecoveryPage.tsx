import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/States';
import { Modal } from '../components/Modal';
import { AsyncPicker } from '../components/AsyncPicker';
import { Icon } from '../components/Icon';
import { currency } from '../lib/format';
import {
  SEVERITY_LABEL, severityColor, SEVERITY_OPTIONS,
  RECOVERY_STATUS_LABEL, recoveryStatusColor, RECOVERY_STATUS_OPTIONS,
} from '../lib/readiness';

interface Row {
  id: string; code: string; title: string; severity: string; dangerZone: boolean;
  status: string; scenario: boolean; estimatedLoss: number; targetName: string | null;
}
interface Summary { recovery: { open: number; dangerZones: number; heavy: number } }

const NEXT: Record<string, string[]> = {
  ASSESSING: ['COORDINATING'], COORDINATING: ['IN_PROGRESS'], IN_PROGRESS: ['RECOVERED'],
};

export function RecoveryPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [scenario, setScenario] = useState('');
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  const size = 15;
  const canManage = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  const summary = useQuery({ queryKey: ['readiness-summary'], queryFn: async () => (await api.get('/readiness/summary')).data as Summary });
  const q = useQuery({
    queryKey: ['recovery', page, search, status, scenario],
    queryFn: async () => (await api.get('/readiness/recovery', { params: { page, size, search: search || undefined, status: status || undefined, scenario: scenario || undefined } })).data as { data: Row[]; meta: { total: number } },
    placeholderData: keepPreviousData,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['recovery'] }); qc.invalidateQueries({ queryKey: ['readiness-summary'] }); };
  const setStatusMut = useMutation({
    mutationFn: async (v: { id: string; status: string }) => api.post(`/readiness/recovery/${v.id}/status`, { status: v.status }),
    onSuccess: () => { refresh(); toast.success('Đã cập nhật trạng thái khắc phục.'); },
    onError: (e) => toast.problem(e),
  });

  const columns: Column<Row>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span>{r.scenario && <span title="Mô phỏng" style={{ color: 'var(--info-fg)' }}>◇ </span>}{r.code}</span>, mono: true, width: 110 },
    { key: 'title', header: 'Nội dung', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted" style={{ fontSize: 11 }}>{r.targetName ?? '—'}{r.dangerZone ? ' · ⚠ vùng nguy hiểm' : ''}</div></div> },
    { key: 'sev', header: 'Mức', render: (r) => <span style={{ color: severityColor(r.severity), fontWeight: 700, fontSize: 12.5 }}>{SEVERITY_LABEL[r.severity] ?? r.severity}</span> },
    { key: 'loss', header: 'Thiệt hại ước tính', render: (r) => r.estimatedLoss > 0 ? currency(r.estimatedLoss) : '—', align: 'right', mono: true },
    { key: 'status', header: 'Trạng thái', render: (r) => { const c = recoveryStatusColor(r.status); return <span style={{ fontSize: 12, fontWeight: 600, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, padding: '2px 8px', borderRadius: 12 }}>{RECOVERY_STATUS_LABEL[r.status] ?? r.status}</span>; } },
    { key: 'act', header: '', align: 'right', render: (r) => {
      if (!canManage || r.status === 'RECOVERED') return null;
      const nexts = NEXT[r.status] ?? [];
      return <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {nexts.map((nx) => <button key={nx} className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setStatusMut.mutate({ id: r.id, status: nx }); }}>{RECOVERY_STATUS_LABEL[nx]}</button>)}
        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEdit(r); }}><Icon name="edit" size={13} /></button>
      </div>;
    } },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Khắc phục hậu quả"
        title="Thiệt hại & phục hồi"
        description="Ghi nhận thiệt hại, đánh dấu vùng nguy hiểm, điều phối vật liệu – lực lượng và theo dõi tiến trình khắc phục (tách dữ liệu mô phỏng)."
        actions={canManage && <button className="btn btn-primary" onClick={() => setEdit('new')}><Icon name="plus" size={16} /> Ghi nhận thiệt hại</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Đang khắc phục" value={summary.data?.recovery.open ?? 0} tone={(summary.data?.recovery.open ?? 0) > 0 ? 'warn' : undefined} />
        <Kpi label="Vùng nguy hiểm" value={summary.data?.recovery.dangerZones ?? 0} tone={(summary.data?.recovery.dangerZones ?? 0) > 0 ? 'danger' : undefined} />
        <Kpi label="Thiệt hại nặng/phá hủy" value={summary.data?.recovery.heavy ?? 0} tone={(summary.data?.recovery.heavy ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-neutral-500)' }}><Icon name="search" size={16} /></span>
          <input className="input" placeholder="Tìm mã, nội dung…" style={{ paddingLeft: 32 }} value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="input" style={{ maxWidth: 180 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(RECOVERY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 170 }} value={scenario} onChange={(e) => { setPage(1); setScenario(e.target.value); }}>
          <option value="">Thực + mô phỏng</option>
          <option value="false">Chỉ dữ liệu thực</option>
          <option value="true">Chỉ mô phỏng</option>
        </select>
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <>
          <DataTable columns={columns} rows={q.data?.data} loading={q.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có nhiệm vụ khắc phục" emptyHint="Ghi nhận thiệt hại để điều phối khắc phục." />
          <Pagination page={page} size={size} total={q.data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}

      {edit && <RecoveryModal row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function RecoveryModal({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void }) {
  const isEdit = !!row;
  const detail = useQuery({ queryKey: ['recovery', row?.id], queryFn: async () => (await api.get(`/readiness/recovery/${row!.id}`)).data as Record<string, unknown>, enabled: isEdit });
  const [f, setF] = useState({ code: '', title: '', severity: 'MODERATE', dangerZone: false, barracksId: '', description: '', neededMaterials: '', neededForces: '', estimatedLoss: '', scenario: false });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  if (isEdit && detail.data && !loaded) {
    const d = detail.data;
    setF({
      code: String(d.code ?? ''), title: String(d.title ?? ''), severity: String(d.severity ?? 'MODERATE'), dangerZone: !!d.dangerZone,
      barracksId: String((d.barracksId as string) ?? ''), description: String(d.description ?? ''), neededMaterials: String(d.neededMaterials ?? ''),
      neededForces: String(d.neededForces ?? ''), estimatedLoss: d.estimatedLoss != null ? String(d.estimatedLoss) : '', scenario: !!d.scenario,
    });
    setLoaded(true);
  }
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: f.title.trim(), severity: f.severity, dangerZone: f.dangerZone, barracksId: f.barracksId || undefined,
        description: f.description || undefined, neededMaterials: f.neededMaterials || undefined, neededForces: f.neededForces || undefined,
        estimatedLoss: f.estimatedLoss ? Number(f.estimatedLoss) : undefined, scenario: f.scenario,
      };
      if (isEdit) return api.put(`/readiness/recovery/${row!.id}`, body);
      return api.post('/readiness/recovery', { code: f.code.trim(), ...body });
    },
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title={isEdit ? `Cập nhật khắc phục · ${row!.code}` : 'Ghi nhận thiệt hại & khắc phục'} onClose={onClose} width={560}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!isEdit && <div><label className="field-label">Mã *</label><input className="input num" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="VD: KP-001" /></div>}
        <div><label className="field-label">Nội dung *</label><input className="input" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mức thiệt hại</label><select className="input" value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}>{SEVERITY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Thiệt hại ước tính (VND)</label><input className="input num" type="number" min={0} value={f.estimatedLoss} onChange={(e) => setF((s) => ({ ...s, estimatedLoss: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Đối tượng (doanh trại)</label><AsyncPicker endpoint="/barracks" value={f.barracksId} onChange={(v) => setF((s) => ({ ...s, barracksId: v }))} placeholder="Tìm doanh trại…" /></div>
        <div><label className="field-label">Vật liệu cần</label><input className="input" value={f.neededMaterials} onChange={(e) => setF((s) => ({ ...s, neededMaterials: e.target.value }))} /></div>
        <div><label className="field-label">Lực lượng cần</label><input className="input" value={f.neededForces} onChange={(e) => setF((s) => ({ ...s, neededForces: e.target.value }))} /></div>
        <div><label className="field-label">Mô tả</label><textarea className="input" rows={2} value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={f.dangerZone} onChange={(e) => setF((s) => ({ ...s, dangerZone: e.target.checked }))} /> Khu vực nguy hiểm</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={f.scenario} onChange={(e) => setF((s) => ({ ...s, scenario: e.target.checked }))} /> Dữ liệu mô phỏng</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.title.trim().length < 3 || (!isEdit && f.code.trim().length < 3) || save.isPending} onClick={() => save.mutate()}>{isEdit ? 'Lưu' : 'Ghi nhận'}</button></div>
      </div>
    </Modal>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div></div>);
}
