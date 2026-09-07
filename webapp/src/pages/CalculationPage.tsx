import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../lib/toast';
import { dateTime, num } from '../lib/format';
import {
  HC_STATUS_LABEL,
  RULE_STATUS_LABEL,
  SCENARIO_STATUS_LABEL,
  compareRuns,
  createScenario,
  lockScenario,
  reviseScenario,
  runScenario,
  useMaterialTrace,
  useRunExceptions,
  useRunMaterials,
  useRunSupply,
  useScenarioRuns,
  useScenarios,
  type CalcRun,
  type CompareLine,
  type MaterialCalc,
  type Scenario,
  type ScenarioMaterial,
} from '../lib/calc';

type Tab = 'scenarios' | 'results' | 'compare';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'scenarios', label: 'Kịch bản & chạy', icon: 'target' },
  { key: 'results', label: 'Bảng kết quả NC', icon: 'grid' },
  { key: 'compare', label: 'So sánh kịch bản', icon: 'chart' },
];

function statusTone(status: string): 'ok' | 'warn' | 'danger' | 'info' {
  if (status === 'SELECTED') return 'ok';
  if (status === 'CONFLICT') return 'danger';
  if (status === 'LOCKED' || status === 'CALCULATED') return 'info';
  return 'warn';
}

export function CalculationPage() {
  const [tab, setTab] = useState<Tab>('scenarios');
  // Chọn kịch bản/run xuyên tab (lập → chạy → xem kết quả → so sánh).
  const [scenarioId, setScenarioId] = useState<string | undefined>();
  const [runId, setRunId] = useState<string | undefined>();

  const openResults = (sid: string, rid: string) => {
    setScenarioId(sid);
    setRunId(rid);
    setTab('results');
  };

  return (
    <div>
      <PageHeader
        eyebrow="DT-08 · Quyển VIII"
        title="Tính toán nhu cầu vật chất"
        description="Engine tính NC = TT + PC_SSCĐ − HC theo nhiệm vụ/kịch bản: định mức (DT-07) + thực lực HC as-of (DT-04) + dự trữ SSCĐ (DT-06). NC âm giữ nguyên dấu; supply_required = max(NC,0) — không bao giờ ngầm coi = 0."
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'btn btn-primary' : 'btn'} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && <ScenariosTab selectedId={scenarioId} onSelect={setScenarioId} onOpenResults={openResults} />}
      {tab === 'results' && <ResultsTab runId={runId} onRunId={setRunId} scenarioId={scenarioId} onScenarioId={setScenarioId} />}
      {tab === 'compare' && <CompareTab />}
    </div>
  );
}

// ============================ SCR-DT08-01/02/07 — Kịch bản & chạy ============================
function ScenariosTab({
  selectedId,
  onSelect,
  onOpenResults,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenResults: (scenarioId: string, runId: string) => void;
}) {
  const scenarios = useScenarios();
  const list = scenarios.data?.data ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 460px) 1fr', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <NewScenarioForm onCreated={(s) => onSelect(s.id)} />
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Danh sách kịch bản (SCR-DT08-01)</div>
          {scenarios.isLoading && <Skeleton rows={4} />}
          {scenarios.isError && <ErrorState error={scenarios.error} />}
          {!scenarios.isLoading && list.length === 0 && (
            <EmptyState icon="target" title="Chưa có kịch bản" hint="Lập kịch bản mới ở khung bên trên." />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((s) => (
              <button
                key={s.id}
                className="panel"
                onClick={() => onSelect(s.id)}
                style={{
                  padding: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: selectedId === s.id ? 'var(--info-bd)' : undefined,
                  background: selectedId === s.id ? 'var(--info-bg)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{s.name}</b>
                  <TinyBadge status={s.status} label={SCENARIO_STATUS_LABEL[s.status] ?? s.status} />
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {s.scenarioCode} · rev {s.revisionNo} · {(s.scopeJson?.materials ?? []).length} vật chất
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {!selectedId && (
          <EmptyState icon="grid" title="Chọn hoặc lập kịch bản" hint="Chọn một kịch bản để chạy engine, xem các lần chạy và khóa bàn giao DT-09." />
        )}
        {selectedId && <ScenarioDetail scenarioId={selectedId} onOpenResults={onOpenResults} />}
      </div>
    </div>
  );
}

function TinyBadge({ status, label }: { status: string; label: string }) {
  const tone = statusTone(status);
  return (
    <span
      className="num"
      style={{
        fontSize: 11,
        padding: '1px 8px',
        borderRadius: 999,
        color: `var(--${tone}-fg)`,
        background: `var(--${tone}-bg)`,
        border: `1px solid var(--${tone}-bd)`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function NewScenarioForm({ onCreated }: { onCreated: (s: Scenario) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [effectiveTime, setEffectiveTime] = useState('');
  const [hcSnapshotId, setHcSnapshotId] = useState('');
  const [mission, setMission] = useState('');
  const [org, setOrg] = useState('');
  const [materials, setMaterials] = useState<ScenarioMaterial[]>([{ materialCatalogId: '', phases: ['PREPARATION', 'COMBAT'], scale: 1, daysPrep: 1, daysCombat: 1 }]);

  const create = useMutation({
    mutationFn: () =>
      createScenario({
        name: name.trim(),
        effectiveTime: effectiveTime || undefined,
        hcSnapshotId: hcSnapshotId.trim() || undefined,
        scope: {
          mission: mission.trim() || undefined,
          org: org.trim() || undefined,
          materials: materials
            .filter((m) => m.materialCatalogId.trim())
            .map((m) => ({ ...m, materialCatalogId: m.materialCatalogId.trim() })),
        },
      }),
    onSuccess: (s) => {
      toast.success('Đã lập kịch bản');
      qc.invalidateQueries({ queryKey: ['dt08', 'scenarios'] });
      setName('');
      onCreated(s);
    },
    onError: (e) => toast.problem(e, 'Không lập được kịch bản'),
  });

  const setMat = (i: number, patch: Partial<ScenarioMaterial>) =>
    setMaterials((arr) => arr.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const togglePhase = (i: number, phase: string) =>
    setMaterials((arr) =>
      arr.map((m, idx) => {
        if (idx !== i) return m;
        const cur = new Set(m.phases ?? []);
        cur.has(phase) ? cur.delete(phase) : cur.add(phase);
        return { ...m, phases: [...cur] };
      }),
    );

  const canSubmit = name.trim() && materials.some((m) => m.materialCatalogId.trim());

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Lập kịch bản (SCR-DT08-02)</div>

      <label className="form-label">Tên kịch bản</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên kịch bản" style={{ width: '100%', marginBottom: 10 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label className="form-label">Nhiệm vụ (mission)</label>
          <input className="input" value={mission} onChange={(e) => setMission(e.target.value)} placeholder="mission" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="form-label">Đơn vị (org)</label>
          <input className="input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="org" style={{ width: '100%' }} />
        </div>
      </div>

      <label className="form-label">Tại thời điểm (effective_time)</label>
      <input className="input" type="datetime-local" value={effectiveTime} onChange={(e) => setEffectiveTime(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />

      <label className="form-label">Snapshot HC (DT-04 — bắt buộc để tính HC as-of)</label>
      <input className="input" value={hcSnapshotId} onChange={(e) => setHcSnapshotId(e.target.value)} placeholder="hc_snapshot_id (UUID)" style={{ width: '100%', marginBottom: 12 }} />

      <div className="eyebrow" style={{ marginBottom: 6 }}>Vật chất mục tiêu</div>
      {materials.map((m, i) => (
        <div key={i} className="panel" style={{ padding: 10, marginBottom: 8 }}>
          <input
            className="input"
            value={m.materialCatalogId}
            onChange={(e) => setMat(i, { materialCatalogId: e.target.value })}
            placeholder="material_catalog_id (UUID)"
            style={{ width: '100%', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            {['PREPARATION', 'COMBAT'].map((p) => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
                <input type="checkbox" checked={(m.phases ?? []).includes(p)} onChange={() => togglePhase(i, p)} />
                {p === 'PREPARATION' ? 'GĐCB (chuẩn bị)' : 'GĐCĐ (chiến đấu)'}
              </label>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div>
              <label className="form-label">Quy mô</label>
              <input className="input" type="number" value={m.scale ?? 1} onChange={(e) => setMat(i, { scale: Number(e.target.value) })} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="form-label">Ngày GĐCB</label>
              <input className="input" type="number" value={m.daysPrep ?? 1} onChange={(e) => setMat(i, { daysPrep: Number(e.target.value) })} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="form-label">Ngày GĐCĐ</label>
              <input className="input" type="number" value={m.daysCombat ?? 1} onChange={(e) => setMat(i, { daysCombat: Number(e.target.value) })} style={{ width: '100%' }} />
            </div>
          </div>
          {materials.length > 1 && (
            <button className="btn" style={{ marginTop: 6 }} onClick={() => setMaterials((arr) => arr.filter((_, idx) => idx !== i))}>
              Bỏ dòng
            </button>
          )}
        </div>
      ))}
      <button
        className="btn"
        style={{ marginBottom: 12 }}
        onClick={() => setMaterials((arr) => [...arr, { materialCatalogId: '', phases: ['PREPARATION', 'COMBAT'], scale: 1, daysPrep: 1, daysCombat: 1 }])}
      >
        <Icon name="plus" size={13} /> Thêm vật chất
      </button>

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? 'Đang lập…' : 'Lập kịch bản'}
      </button>
    </div>
  );
}

function ScenarioDetail({ scenarioId, onOpenResults }: { scenarioId: string; onOpenResults: (sid: string, rid: string) => void }) {
  const qc = useQueryClient();
  const runsQ = useScenarioRuns(scenarioId);
  const scenarios = useScenarios();
  const scenario = scenarios.data?.data.find((s) => s.id === scenarioId);
  const runs = runsQ.data ?? [];

  const doRun = useMutation({
    mutationFn: () => runScenario(scenarioId),
    onSuccess: (r) => {
      toast.success(`Đã chạy engine (run #${r.runNo}) — ${r.exceptionCount} dòng cần xử lý`);
      qc.invalidateQueries({ queryKey: ['dt08', 'runs', scenarioId] });
      qc.invalidateQueries({ queryKey: ['dt08', 'scenarios'] });
      onOpenResults(scenarioId, r.id);
    },
    onError: (e) => toast.problem(e, 'Không chạy được engine'),
  });

  const doLock = useMutation({
    mutationFn: () => lockScenario(scenarioId),
    onSuccess: () => {
      toast.success('Đã khóa kịch bản — sẵn sàng bàn giao DT-09');
      qc.invalidateQueries({ queryKey: ['dt08', 'scenarios'] });
    },
    onError: (e) => toast.problem(e, 'Không khóa được kịch bản'),
  });

  const doRevise = useMutation({
    mutationFn: () => reviseScenario(scenarioId, {}),
    onSuccess: (s) => {
      toast.success(`Đã tạo bản sửa (rev ${s.revisionNo})`);
      qc.invalidateQueries({ queryKey: ['dt08', 'scenarios'] });
    },
    onError: (e) => toast.problem(e, 'Không tạo được bản sửa'),
  });

  const locked = scenario?.status === 'LOCKED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{scenario?.name ?? 'Kịch bản'}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {scenario?.scenarioCode} · {scenario && SCENARIO_STATUS_LABEL[scenario.status]} · engine {scenario?.engineVersion}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" disabled={locked || doRun.isPending} onClick={() => doRun.mutate()}>
              <Icon name="target" size={14} /> {doRun.isPending ? 'Đang chạy…' : 'Chạy engine'}
            </button>
            <button className="btn" disabled={scenario?.status !== 'CALCULATED' || doLock.isPending} onClick={() => doLock.mutate()}>
              <Icon name="lock" size={14} /> Khóa & bàn giao (SCR-07)
            </button>
            <button className="btn" disabled={doRevise.isPending} onClick={() => doRevise.mutate()}>
              <Icon name="refresh" size={14} /> Tạo bản sửa
            </button>
          </div>
        </div>
        {locked && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
            Kịch bản đã khóa (bất biến). Muốn đổi nguồn → dùng “Tạo bản sửa” (clone) — BR-DT08-011/012.
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Các lần chạy</div>
        {runsQ.isLoading && <Skeleton rows={3} />}
        {!runsQ.isLoading && runs.length === 0 && <EmptyState icon="clock" title="Chưa chạy lần nào" hint="Bấm “Chạy engine” để tạo lần chạy đầu tiên." />}
        {runs.length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Trạng thái</th>
                <th>Dòng</th>
                <th>Ngoại lệ</th>
                <th>output_hash</th>
                <th>Kết thúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r: CalcRun) => (
                <tr key={r.id}>
                  <td className="num">#{r.runNo}</td>
                  <td>{r.status}</td>
                  <td className="num">{r.lineCount}</td>
                  <td className="num" style={{ color: r.exceptionCount ? 'var(--warn-fg)' : undefined }}>{r.exceptionCount}</td>
                  <td className="num" title={r.outputHash ?? ''} style={{ fontSize: 11 }}>{r.outputHash?.slice(0, 10) ?? '—'}…</td>
                  <td className="muted" style={{ fontSize: 12 }}>{dateTime(r.finishedAt)}</td>
                  <td>
                    <button className="btn" onClick={() => onOpenResults(scenarioId, r.id)}>Xem bảng NC</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================ SCR-DT08-03/04/05 — Bảng kết quả NC + trace + ngoại lệ ============================
function ResultsTab({
  runId,
  onRunId,
  scenarioId,
  onScenarioId,
}: {
  runId?: string;
  onRunId: (id: string) => void;
  scenarioId?: string;
  onScenarioId: (id: string) => void;
}) {
  const scenarios = useScenarios();
  const runsQ = useScenarioRuns(scenarioId);
  const materials = useRunMaterials(runId);
  const exceptions = useRunExceptions(runId);
  const supply = useRunSupply(runId);
  const [traceMid, setTraceMid] = useState<string | undefined>();

  if (!runId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="panel" style={{ padding: 16 }}>
          <label className="form-label">Chọn kịch bản</label>
          <select className="input" value={scenarioId ?? ''} onChange={(e) => onScenarioId(e.target.value)} style={{ width: '100%', maxWidth: 460, marginBottom: 10 }}>
            <option value="">— chọn —</option>
            {(scenarios.data?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.scenarioCode})</option>
            ))}
          </select>
          {scenarioId && (
            <div>
              <label className="form-label">Chọn lần chạy</label>
              <select className="input" value="" onChange={(e) => e.target.value && onRunId(e.target.value)} style={{ width: '100%', maxWidth: 460 }}>
                <option value="">— chọn —</option>
                {(runsQ.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>#{r.runNo} · {r.status} · {r.exceptionCount} ngoại lệ</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <EmptyState icon="grid" title="Chưa chọn lần chạy" hint="Chọn kịch bản + lần chạy để xem bảng NC." />
      </div>
    );
  }

  const rows = materials.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {supply.data && (
        <div className="panel" style={{ padding: 12, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><span className="muted">Đã tính:</span> <b className="num">{supply.data.items.length}</b></div>
          <div><span className="muted">Cần xử lý:</span> <b className="num" style={{ color: supply.data.pendingExceptions ? 'var(--warn-fg)' : undefined }}>{supply.data.pendingExceptions}</b></div>
          <div style={{ fontSize: 12 }}><span className="muted">output_hash:</span> <span className="num">{supply.data.outputHash?.slice(0, 16)}…</span></div>
          <div style={{ fontSize: 12 }}><span className="muted">engine:</span> <span className="num">{supply.data.engineVersion}</span></div>
        </div>
      )}

      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Bảng kết quả NC (SCR-DT08-03)</div>
        {materials.isLoading && <Skeleton rows={5} />}
        {materials.isError && <ErrorState error={materials.error} />}
        {!materials.isLoading && rows.length === 0 && <EmptyState icon="grid" title="Không có dòng" hint="Lần chạy này chưa có vật chất." />}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Vật chất</th>
                  <th className="num">TT_GĐCB</th>
                  <th className="num">TT_GĐCĐ</th>
                  <th className="num">TT</th>
                  <th className="num">PC_SSCĐ</th>
                  <th className="num">HC</th>
                  <th className="num">NC</th>
                  <th className="num">supply_required</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m: MaterialCalc) => {
                  const flagged = m.ruleStatus !== 'SELECTED' || m.hcStatus !== 'OK';
                  return (
                    <tr key={m.id} style={{ background: flagged ? 'var(--warn-bg)' : undefined }}>
                      <td className="num" title={m.materialCatalogId} style={{ fontSize: 11 }}>{m.materialCatalogId.slice(0, 8)}…</td>
                      <td className="num">{m.ttGdcb != null ? num(m.ttGdcb) : '—'}</td>
                      <td className="num">{m.ttGdcd != null ? num(m.ttGdcd) : '—'}</td>
                      <td className="num">{m.tt != null ? num(m.tt) : '—'}</td>
                      <td className="num">{m.pcSscd != null ? num(m.pcSscd) : '—'}</td>
                      <td className="num">{m.hc != null ? num(m.hc) : '—'}</td>
                      <td className="num" style={{ color: m.nc != null && Number(m.nc) < 0 ? 'var(--danger-fg)' : undefined, fontWeight: 700 }}>
                        {m.nc != null ? num(m.nc) : '—'}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>{m.supplyRequired != null ? num(m.supplyRequired) : '—'}</td>
                      <td>
                        <TinyBadge status={m.ruleStatus} label={m.hcStatus !== 'OK' ? HC_STATUS_LABEL[m.hcStatus] : RULE_STATUS_LABEL[m.ruleStatus] ?? m.ruleStatus} />
                      </td>
                      <td>
                        <button className="btn" onClick={() => setTraceMid(m.id)}>Diễn giải</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {traceMid && <TracePanel runId={runId} materialCalcId={traceMid} onClose={() => setTraceMid(undefined)} />}

      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Hàng chờ ngoại lệ — NO_RULE / CONFLICT / NO_HC_SNAPSHOT (SCR-DT08-05)</div>
        {exceptions.isLoading && <Skeleton rows={2} />}
        {!exceptions.isLoading && (exceptions.data ?? []).length === 0 && (
          <div className="muted" style={{ fontSize: 13 }}>Không có ngoại lệ — mọi dòng đều tính được.</div>
        )}
        {(exceptions.data ?? []).length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Vật chất</th><th>Nguyên nhân</th></tr>
            </thead>
            <tbody>
              {(exceptions.data ?? []).map((e) => (
                <tr key={e.materialCalculationId}>
                  <td className="num" title={e.materialCatalogId} style={{ fontSize: 11 }}>{e.materialCatalogId.slice(0, 8)}…</td>
                  <td><TinyBadge status={e.reason === 'NO_HC_SNAPSHOT' ? 'CONFLICT' : e.reason} label={e.reason === 'NO_HC_SNAPSHOT' ? HC_STATUS_LABEL.NO_HC_SNAPSHOT : RULE_STATUS_LABEL[e.reason] ?? e.reason} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TracePanel({ runId, materialCalcId, onClose }: { runId: string; materialCalcId: string; onClose: () => void }) {
  const trace = useMaterialTrace(runId, materialCalcId);
  return (
    <div className="panel" style={{ padding: 16, borderColor: 'var(--info-bd)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="eyebrow">Diễn giải 1 dòng — trace tới nguồn (SCR-DT08-04)</div>
        <button className="btn" onClick={onClose}>Đóng</button>
      </div>
      {trace.isLoading && <Skeleton rows={4} />}
      {trace.data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trace.data.trace.map((n) => (
            <div key={n.id} className="panel" style={{ padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TinyBadge status={n.stepType === 'FORMULA' ? 'CALCULATED' : 'SELECTED'} label={n.stepType} />
                <b style={{ fontSize: 13 }}>{n.formula}</b>
                {n.outputValue != null && <span className="num" style={{ marginLeft: 'auto' }}>{num(n.outputValue)}</span>}
              </div>
              {n.note && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{n.note}</div>}
              {n.stepType === 'NORM' && (n.inputRefs as { sourceReference?: string }).sourceReference && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Căn cứ: {(n.inputRefs as { sourceReference?: string }).sourceReference}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================ SCR-DT08-06 — So sánh kịch bản (ΔNC) ============================
function CompareTab() {
  const scenarios = useScenarios();
  const [baseSid, setBaseSid] = useState('');
  const [targetSid, setTargetSid] = useState('');
  const baseRuns = useScenarioRuns(baseSid || undefined);
  const targetRuns = useScenarioRuns(targetSid || undefined);
  const [baseRun, setBaseRun] = useState('');
  const [targetRun, setTargetRun] = useState('');
  const [result, setResult] = useState<CompareLine[] | null>(null);

  const run = useMutation({
    mutationFn: () => compareRuns(baseRun, targetRun),
    onSuccess: (r) => setResult(r.lines),
    onError: (e) => toast.problem(e, 'Không so sánh được'),
  });

  const scenList = scenarios.data?.data ?? [];
  const changedCount = useMemo(() => (result ?? []).filter((l) => l.changed).length, [result]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Chọn 2 lần chạy để so sánh ΔNC</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Gốc (base)', sid: baseSid, setSid: setBaseSid, runs: baseRuns.data ?? [], run: baseRun, setRun: setBaseRun },
            { label: 'Đích (target)', sid: targetSid, setSid: setTargetSid, runs: targetRuns.data ?? [], run: targetRun, setRun: setTargetRun },
          ].map((col) => (
            <div key={col.label}>
              <label className="form-label">{col.label} — kịch bản</label>
              <select className="input" value={col.sid} onChange={(e) => { col.setSid(e.target.value); col.setRun(''); }} style={{ width: '100%', marginBottom: 8 }}>
                <option value="">— chọn —</option>
                {scenList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="form-label">{col.label} — lần chạy</label>
              <select className="input" value={col.run} onChange={(e) => col.setRun(e.target.value)} style={{ width: '100%' }}>
                <option value="">— chọn —</option>
                {col.runs.map((r) => <option key={r.id} value={r.id}>#{r.runNo} · {r.status}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!baseRun || !targetRun || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? 'Đang so sánh…' : 'So sánh ΔNC'}
        </button>
      </div>

      {result && (
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Chênh lệch nhu cầu — {changedCount} dòng thay đổi (SCR-DT08-06)</div>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Vật chất</th>
                <th className="num">NC gốc</th>
                <th className="num">NC đích</th>
                <th className="num">ΔNC</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {result.map((l) => (
                <tr key={l.materialCatalogId} style={{ background: l.changed ? 'var(--info-bg)' : undefined }}>
                  <td className="num" title={l.materialCatalogId} style={{ fontSize: 11 }}>{l.materialCatalogId.slice(0, 8)}…</td>
                  <td className="num">{l.baseNc ?? '—'}</td>
                  <td className="num">{l.targetNc ?? '—'}</td>
                  <td className="num" style={{ fontWeight: 700, color: l.deltaNc && l.deltaNc !== 0 ? 'var(--info-fg)' : undefined }}>
                    {l.deltaNc == null ? '—' : l.deltaNc > 0 ? `+${l.deltaNc}` : l.deltaNc}
                  </td>
                  <td style={{ fontSize: 12 }}>{l.baseStatus} → {l.targetStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
