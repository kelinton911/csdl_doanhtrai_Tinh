import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../lib/toast';
import {
  PLAN_STATUS_LABEL,
  REJECT_REASON_LABEL,
  approvePlan,
  balancePlan,
  createExecutionRequest,
  createPlan,
  lockPlan,
  reserveSource,
  revisePlan,
  useCandidates,
  useGapSummary,
  usePlan,
  usePlans,
  type BalanceLineView,
  type BalancePlan,
} from '../lib/dt09';

type Tab = 'plans' | 'detail';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'plans', label: 'Kế hoạch cân đối', icon: 'grid' },
  { key: 'detail', label: 'Chi tiết & cân đối', icon: 'target' },
];

export function BalancePage() {
  const [tab, setTab] = useState<Tab>('plans');
  const [planId, setPlanId] = useState<string | undefined>();
  const qc = useQueryClient();
  const plans = usePlans();

  const [form, setForm] = useState({ name: '', scenarioRunId: '', deadlineDays: '30' });
  const createMut = useMutation({
    mutationFn: () => createPlan({ name: form.name, scenarioRunId: form.scenarioRunId, deadlineDays: Number(form.deadlineDays) }),
    onSuccess: (p) => {
      toast.success(`Đã lập kế hoạch ${p.planCode} — nhận supply_required từ DT-08`);
      setForm({ name: '', scenarioRunId: '', deadlineDays: '30' });
      qc.invalidateQueries({ queryKey: ['dt09', 'plans'] });
      setPlanId(p.id);
      setTab('detail');
    },
    onError: (e) => toast.problem(e, 'Không lập được kế hoạch (kiểm tra scenario_run_id của DT-08)'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="DT-09 · Quyển IX"
        title="Cân đối bảo đảm"
        description="Nhận supply_required từ 1 lần chạy DT-08 (KHÔNG tính lại NC), cân đối với nguồn địa bàn: giữ chỗ chống overbooking (Σ ≤ khả dụng), gap → yêu cầu thực thi (DT-05), snapshot bất biến khi phê duyệt."
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'btn btn-primary' : 'btn'} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Lập kế hoạch cân đối</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Tên kế hoạch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="scenario_run_id (DT-08)" value={form.scenarioRunId} onChange={(e) => setForm({ ...form, scenarioRunId: e.target.value })} />
              <input className="input" placeholder="Deadline (ngày)" value={form.deadlineDays} onChange={(e) => setForm({ ...form, deadlineDays: e.target.value })} />
              <button className="btn btn-primary" disabled={!form.name || !form.scenarioRunId || createMut.isPending} onClick={() => createMut.mutate()}>
                <Icon name="plus" size={15} /> Lập kế hoạch
              </button>
            </div>
          </div>

          {plans.isLoading ? (
            <Skeleton rows={5} />
          ) : plans.error ? (
            <ErrorState error={plans.error} />
          ) : !plans.data?.data.length ? (
            <EmptyState icon="grid" title="Chưa có kế hoạch cân đối" hint="Lập kế hoạch từ một lần chạy DT-08." />
          ) : (
            <div className="panel" style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Mã</th><th>Tên</th><th>Rev</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {plans.data.data.map((p) => (
                    <tr key={p.id}>
                      <td>{p.planCode}</td>
                      <td>{p.name}</td>
                      <td>{p.revisionNo}</td>
                      <td>{PLAN_STATUS_LABEL[p.status] ?? p.status}</td>
                      <td><button className="btn" onClick={() => { setPlanId(p.id); setTab('detail'); }}>Mở</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'detail' && (planId ? <PlanDetail planId={planId} /> : <EmptyState icon="target" title="Chọn một kế hoạch" />)}
    </div>
  );
}

function PlanDetail({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const plan = usePlan(planId);
  const gap = useGapSummary(planId);
  const [lineId, setLineId] = useState<string | undefined>();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dt09', 'plan', planId] });
    qc.invalidateQueries({ queryKey: ['dt09', 'gap', planId] });
    qc.invalidateQueries({ queryKey: ['dt09', 'candidates', planId] });
  };

  const balanceMut = useMutation({ mutationFn: () => balancePlan(planId), onSuccess: () => { toast.success('Đã cân đối (planned/gap cập nhật)'); invalidate(); }, onError: (e) => toast.problem(e, 'Không cân đối được') });
  const approveMut = useMutation({ mutationFn: () => approvePlan(planId), onSuccess: () => { toast.success('Đã duyệt'); invalidate(); }, onError: (e) => toast.problem(e, 'Không duyệt được') });
  const lockMut = useMutation({ mutationFn: () => lockPlan(planId), onSuccess: () => { toast.success('Đã khóa + tạo snapshot bất biến'); invalidate(); }, onError: (e) => toast.problem(e, 'Không khóa được') });
  const reviseMut = useMutation({ mutationFn: () => revisePlan(planId), onSuccess: (p: BalancePlan) => { toast.success(`Đã tạo bản sửa ${p.planCode}`); qc.invalidateQueries({ queryKey: ['dt09', 'plans'] }); }, onError: (e) => toast.problem(e, 'Không tạo bản sửa được') });

  if (plan.isLoading) return <Skeleton rows={6} />;
  if (plan.error) return <ErrorState error={plan.error} />;
  const p = plan.data!;
  const locked = p.status === 'LOCKED';

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>{p.name} <span className="muted">({p.planCode} · rev {p.revisionNo})</span></h3>
          <div className="muted">Trạng thái: {PLAN_STATUS_LABEL[p.status] ?? p.status} · run DT-08: {p.scenarioRunId?.slice(0, 8)} · deadline {p.deadlineDays ?? '—'}d</div>
          {p.checksum && <div className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>checksum {p.checksum.slice(0, 16)}… · fingerprint {p.sourceFingerprint?.slice(0, 12)}…</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button className="btn" disabled={locked || balanceMut.isPending} onClick={() => balanceMut.mutate()}>Cân đối</button>
          <button className="btn" disabled={locked || approveMut.isPending} onClick={() => approveMut.mutate()}>Duyệt</button>
          <button className="btn" disabled={locked || lockMut.isPending} onClick={() => lockMut.mutate()}>Khóa + snapshot</button>
          <button className="btn" onClick={() => reviseMut.mutate()}>Tạo bản sửa</button>
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Vật chất</th><th>NC (supply_required)</th><th>Đã giữ chỗ</th><th>Gap</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {(p.lines ?? []).map((l) => (
              <tr key={l.id} style={lineId === l.id ? { background: 'var(--color-neutral-100, #f3f4f6)' } : undefined}>
                <td style={{ fontFamily: 'monospace' }}>{l.materialCatalogId.slice(0, 12)}…</td>
                <td>{l.supplyRequired}</td>
                <td>{l.plannedSourceQty}</td>
                <td style={{ color: l.gapQty > 0 ? 'var(--color-danger-600,#dc2626)' : 'var(--color-success-600,#16a34a)' }}>{l.gapQty}</td>
                <td>{l.status}</td>
                <td><button className="btn" disabled={locked} onClick={() => setLineId(l.id)}>Gợi ý nguồn</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lineId && <LinePanel planId={planId} line={(p.lines ?? []).find((l) => l.id === lineId)!} deadlineDays={p.deadlineDays} onDone={invalidate} />}

      {gap.data && (
        <div className="panel" style={{ padding: 16 }}>
          <h4 style={{ marginTop: 0 }}>Tổng hợp Gap</h4>
          <div className="muted">
            NC {gap.data.totals.supplyRequired} · Đã giữ {gap.data.totals.plannedSourceQty} · Gap {gap.data.totals.gapQty} · Đã giao {gap.data.totals.deliveredQty}
          </div>
        </div>
      )}
    </div>
  );
}

function LinePanel({ planId, line, deadlineDays, onDone }: { planId: string; line: BalanceLineView; deadlineDays: number | null; onDone: () => void }) {
  const candidates = useCandidates(planId, line.id, deadlineDays);
  const [qty, setQty] = useState('');
  const [exec, setExec] = useState({ requestedQty: '', organizationId: '' });

  const reserveMut = useMutation({
    mutationFn: (sourceMaterialId: string) => reserveSource(line.id, { sourceMaterialId, reservedQty: Number(qty) }),
    onSuccess: () => { toast.success('Đã giữ chỗ nguồn'); onDone(); },
    onError: (e) => toast.problem(e, 'Không giữ được (vượt khả dụng?)'),
  });

  const execMut = useMutation({
    mutationFn: () => createExecutionRequest(line.id, { requestedQty: Number(exec.requestedQty), organizationId: exec.organizationId || undefined, spawnDocument: !!exec.organizationId }),
    onSuccess: () => { toast.success('Đã tạo yêu cầu thực thi → DT-05'); setExec({ requestedQty: '', organizationId: '' }); onDone(); },
    onError: (e) => toast.problem(e, 'Không tạo được yêu cầu thực thi'),
  });

  return (
    <div className="panel" style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div>
        <h4 style={{ margin: 0 }}>Gợi ý nguồn (candidate 8 bước) — dòng {line.materialCatalogId.slice(0, 10)}…</h4>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
          <input className="input" placeholder="Số lượng giữ chỗ" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        {candidates.isLoading ? (
          <Skeleton rows={3} />
        ) : candidates.error ? (
          <ErrorState error={candidates.error} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>#</th><th>Nguồn</th><th>Khả dụng</th><th>Lead</th><th>KC (km)</th><th></th></tr></thead>
              <tbody>
                {candidates.data!.ranked.map((c) => (
                  <tr key={c.sourceMaterialId}>
                    <td className="num">{c.rank}</td>
                    <td>{c.sourceName ?? c.sourceCode ?? c.sourceMaterialId.slice(0, 8)}</td>
                    <td>{c.availableQty}</td>
                    <td>{c.leadTimeDays ?? '—'}</td>
                    <td>{c.distanceKm ?? '—'}</td>
                    <td><ReserveButton disabled={!qty || reserveMut.isPending} onClick={() => reserveMut.mutate(c.sourceMaterialId)} /></td>
                  </tr>
                ))}
                {!candidates.data!.ranked.length && (
                  <tr><td colSpan={6} className="muted">Không có nguồn đủ điều kiện.</td></tr>
                )}
              </tbody>
            </table>
            {!!candidates.data!.rejected.length && (
              <details style={{ marginTop: 8 }}>
                <summary className="muted">Nguồn bị loại ({candidates.data!.rejected.length}) — lý do</summary>
                <ul>
                  {candidates.data!.rejected.map((r) => (
                    <li key={r.sourceMaterialId} className="muted">{r.sourceMaterialId.slice(0, 8)}…: {REJECT_REASON_LABEL[r.reason] ?? r.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: 0 }}>Yêu cầu thực thi → DT-05 (BR-028)</h4>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Số lượng yêu cầu" value={exec.requestedQty} onChange={(e) => setExec({ ...exec, requestedQty: e.target.value })} />
          <input className="input" placeholder="organizationId (lập chứng từ DT-05)" value={exec.organizationId} onChange={(e) => setExec({ ...exec, organizationId: e.target.value })} />
          <button className="btn btn-primary" disabled={!exec.requestedQty || execMut.isPending} onClick={() => execMut.mutate()}>
            <Icon name="file" size={14} /> Tạo yêu cầu thực thi
          </button>
        </div>
      </div>
    </div>
  );
}

function ReserveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button className="btn" disabled={disabled} onClick={onClick}>
      <Icon name="check" size={14} /> Giữ chỗ
    </button>
  );
}
