import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/States';
import { num } from '../lib/format';

interface Supply { code: string; name: string; unit: string; required: number; available: number; shortage: number; coverageDays: number; meetsDemand: boolean }
interface Metrics { accommodation: { capacity: number; effectiveCapacity: number; required: number; shortage: number; meetsDemand: boolean }; supplies: Supply[]; confidence: number; overallMeets: boolean }
interface Run { id: string; version: number; metrics: Metrics; createdAt: string }
interface Scenario { id: string; code: string; name: string; status: string }
interface Plan { id: string; code: string; name: string; status: string; scenarioRunId: string; allocations: { metricsSnapshot?: Metrics } }

export function ScenarioPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState({ troopCount: '5000', durationDays: '30', damageLevel: '0.2' });
  const [run, setRun] = useState<Run | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans', { params: { size: 50 } })).data as { data: Plan[] } });

  const calc = useMutation({
    mutationFn: async () => {
      const code = `TH-${Date.now().toString().slice(-6)}`;
      const sc = (await api.post('/scenarios', { code, name: `Tình huống ${code}`, parameters: { troopCount: Number(params.troopCount), durationDays: Number(params.durationDays), damageLevel: Number(params.damageLevel) } })).data as Scenario;
      setScenarioId(sc.id);
      return (await api.post(`/scenarios/${sc.id}/runs`)).data as Run;
    },
    onSuccess: (r) => { setRun(r); setError(null); },
    onError: (e) => setError(toProblem(e).title),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const code = `PA-${Date.now().toString().slice(-6)}`;
      return api.post('/plans', { code, name: `Phương án ${code}`, scenarioRunId: run!.id, assumptions: `Quân số ${params.troopCount}, ${params.durationDays} ngày, hư hỏng ${Number(params.damageLevel) * 100}%` });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });

  const approve = useMutation({ mutationFn: async (id: string) => api.post(`/plans/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }) });

  const m = run?.metrics;

  return (
    <>
      <PageHeader eyebrow="Kế hoạch và tình huống" title="Lập tình huống & phương án bảo đảm" description="Nhập giả định, chạy engine tính khả năng đáp ứng và thiếu hụt. Kết quả mô phỏng, tách khỏi tồn kho thực." />

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
        {/* Panel giả định */}
        <div className="card" style={{ padding: 18, height: 'fit-content' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Giả định tình huống</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="field-label">Quân số cần bảo đảm</label><input className="input num" type="number" value={params.troopCount} onChange={(e) => setParams((p) => ({ ...p, troopCount: e.target.value }))} /></div>
            <div><label className="field-label">Thời gian (ngày)</label><input className="input num" type="number" value={params.durationDays} onChange={(e) => setParams((p) => ({ ...p, durationDays: e.target.value }))} /></div>
            <div>
              <label className="field-label">Mức hư hỏng hạ tầng: {Math.round(Number(params.damageLevel) * 100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={params.damageLevel} onChange={(e) => setParams((p) => ({ ...p, damageLevel: e.target.value }))} style={{ width: '100%' }} />
            </div>
            {error && <div style={{ color: 'var(--danger-fg)', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => calc.mutate()} disabled={calc.isPending}>
              <Icon name="target" size={16} /> {calc.isPending ? 'Đang tính…' : 'Chạy tính toán'}
            </button>
          </div>
        </div>

        {/* Panel kết quả */}
        <div>
          {calc.isPending && <Skeleton rows={5} />}
          {!run && !calc.isPending && (
            <div className="panel" style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-600)' }}>
              <Icon name="target" size={34} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>Nhập giả định và bấm "Chạy tính toán"</div>
              <div className="muted" style={{ fontSize: 13 }}>Engine đối chiếu nhu cầu với khả năng tiếp nhận và tồn kho hiện có.</div>
            </div>
          )}
          {m && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <ResultCard title="Khả năng tiếp nhận" ok={m.accommodation.meetsDemand} main={`${num(m.accommodation.effectiveCapacity)}`} sub={`Cần ${num(m.accommodation.required)} · ${m.accommodation.meetsDemand ? 'Đáp ứng' : `Thiếu ${num(m.accommodation.shortage)}`}`} />
                <ResultCard title="Mức tin cậy dữ liệu" ok={m.confidence >= 70} main={`${m.confidence}%`} sub={m.confidence >= 70 ? 'Đủ tin cậy' : 'Cần bổ sung dữ liệu'} />
                <ResultCard title="Kết luận tổng thể" ok={m.overallMeets} main={m.overallMeets ? 'Đáp ứng' : 'Thiếu hụt'} sub={m.overallMeets ? 'Bảo đảm theo giả định' : 'Có hạng mục thiếu'} />
              </div>

              <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Cân đối vật chất theo định mức</div>
                <table className="data">
                  <thead><tr><th>Vật chất</th><th style={{ textAlign: 'right' }}>Nhu cầu</th><th style={{ textAlign: 'right' }}>Hiện có</th><th style={{ textAlign: 'right' }}>Thiếu hụt</th><th style={{ textAlign: 'right' }}>Bảo đảm</th></tr></thead>
                  <tbody>
                    {m.supplies.map((s) => (
                      <tr key={s.code} style={{ background: s.meetsDemand ? undefined : 'var(--danger-bg)' }}>
                        <td style={{ fontWeight: 600 }}>{s.name} <span className="muted">({s.unit})</span></td>
                        <td className="num" style={{ textAlign: 'right' }}>{num(s.required)}</td>
                        <td className="num" style={{ textAlign: 'right' }}>{num(s.available)}</td>
                        <td className="num" style={{ textAlign: 'right', color: s.shortage > 0 ? 'var(--danger-fg)' : 'var(--ok-fg)', fontWeight: 700 }}>{s.shortage > 0 ? num(s.shortage) : '0'}</td>
                        <td className="num" style={{ textAlign: 'right' }}>{num(s.coverageDays)} ngày</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-primary" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                <Icon name="check" size={16} /> Lưu thành phương án
              </button>
            </>
          )}
        </div>
      </div>

      {/* So sánh phương án */}
      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>So sánh & chốt phương án</div>
        {plans.isLoading ? <Skeleton rows={2} /> : (plans.data?.data ?? []).length === 0 ? (
          <div className="muted">Chưa có phương án. Chạy tính toán và lưu thành phương án để so sánh.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {(plans.data?.data ?? []).slice(0, 6).map((p) => {
              const pm = p.allocations?.metricsSnapshot;
              return (
                <div key={p.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="num muted" style={{ fontSize: 11, marginBottom: 10 }}>{p.code}</div>
                  {pm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <Row label="Tin cậy" value={`${pm.confidence}%`} />
                      <Row label="Chỗ ở" value={pm.accommodation.meetsDemand ? 'Đáp ứng' : `Thiếu ${num(pm.accommodation.shortage)}`} ok={pm.accommodation.meetsDemand} />
                      <Row label="Tổng thể" value={pm.overallMeets ? 'Đáp ứng' : 'Thiếu hụt'} ok={pm.overallMeets} />
                    </div>
                  )}
                  {p.status !== 'APPROVED' && p.status !== 'LOCKED' && (
                    <button className="btn btn-sm btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => approve.mutate(p.id)}>
                      <Icon name="check" size={14} /> Chốt phương án
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ResultCard({ title, main, sub, ok }: { title: string; main: string; sub: string; ok: boolean }) {
  return (
    <div className="card" style={{ padding: 16, borderLeft: `4px solid ${ok ? 'var(--ok-fg)' : 'var(--danger-fg)'}` }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <div className="num" style={{ fontSize: 24, fontWeight: 700, color: ok ? 'var(--ok-fg)' : 'var(--danger-fg)' }}>{main}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600, color: ok === undefined ? 'inherit' : ok ? 'var(--ok-fg)' : 'var(--danger-fg)' }}>{value}</span>
    </div>
  );
}
