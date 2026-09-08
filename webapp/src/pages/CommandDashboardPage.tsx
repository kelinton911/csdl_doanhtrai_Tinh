import { useState, type CSSProperties } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon } from '../components/Icon';
import { toast } from '../lib/toast';
import {
  ALERT_STATUS_LABEL,
  FRESHNESS_LABEL,
  SEMANTIC_LABEL,
  SEVERITY_LABEL,
  ackAlert,
  addCriterion,
  addOption,
  computeMetric,
  createSession,
  evaluateAlerts,
  recordDecision,
  refreshDataMart,
  resolveAlert,
  scoreSession,
  useAlerts,
  useCommandOverview,
  useDataMartFreshness,
  useDecisionSession,
  useKpiDefinitions,
  useMapMaterials,
  useMetricDrillDown,
  useSemantics,
} from '../lib/dt12';

// DT-12 — Dashboard chỉ huy & hỗ trợ quyết định (Quyển XII). SCR-DT12-01..08: tổng quan KPI + freshness →
// bản đồ theo quyền vị trí → drill-down KPI→nguồn → semantic explorer → cảnh báo (lifecycle+SLA) →
// what-if cách ly → hỗ trợ quyết định → độ tươi dữ liệu. Mọi KPI có lineage (AC-15). Business rule ở backend.
const FRESHNESS_TONE: Record<string, string> = { FRESH: '#16a34a', STALE: '#d97706', NO_SOURCE: '#6b7280' };
const SEVERITY_TONE: Record<string, string> = { INFO: '#2563eb', WARN: '#d97706', CRITICAL: '#dc2626' };
// Badge nhỏ tự chứa (không phụ thuộc class CSS ngoài) — viền theo tone.
const BADGE: CSSProperties = { border: '1px solid', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' };

export function CommandDashboardPage() {
  const qc = useQueryClient();
  const overview = useCommandOverview();
  const semantics = useSemantics();
  const kpis = useKpiDefinitions();
  const alerts = useAlerts();
  const freshness = useDataMartFreshness();
  const map = useMapMaterials();

  const [metricId, setMetricId] = useState<string>();
  const drilldown = useMetricDrillDown(metricId);
  const [sessionId, setSessionId] = useState<string>();
  const session = useDecisionSession(sessionId);
  const [ranking, setRanking] = useState<Array<{ optionKey?: string; total: number }>>();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['dt12'] });

  // SCR-01: tính (compute) metric cho toàn bộ KPI để có as_of_time + lineage + freshness.
  const computeAll = useMutation({
    mutationFn: async () => {
      const list = kpis.data ?? [];
      for (const k of list) await computeMetric({ kpiCode: k.kpiCode });
      return list.length;
    },
    onSuccess: (n) => { toast.success(`Đã tính ${n} KPI (có lineage + freshness)`); invalidate(); },
    onError: () => toast.error('Không tính được KPI'),
  });

  // SCR-03: mở drill-down cho 1 KPI — compute metric rồi lấy dòng nguồn (khớp tổng).
  const drillMut = useMutation({
    mutationFn: async (kpiCode: string) => (await computeMetric({ kpiCode })).id,
    onSuccess: (id) => { setMetricId(id); toast.info('Drill-down KPI → nguồn'); },
    onError: () => toast.error('Không mở được drill-down'),
  });

  const refreshMut = useMutation({
    mutationFn: (factType: string) => refreshDataMart(factType),
    onSuccess: () => { toast.success('Đã refresh Data Mart (qua outbox)'); invalidate(); },
    onError: () => toast.error('Refresh thất bại'),
  });

  const evalMut = useMutation({
    mutationFn: () => evaluateAlerts(),
    onSuccess: (r) => { toast.success(`Quét cảnh báo: sinh ${r.created}/${r.evaluated} rule`); invalidate(); },
    onError: () => toast.error('Quét cảnh báo thất bại'),
  });
  const ackMut = useMutation({ mutationFn: (id: string) => ackAlert(id), onSuccess: () => { toast.info('Đã tiếp nhận'); invalidate(); } });
  const resolveMut = useMutation({ mutationFn: (id: string) => resolveAlert(id, 'Đã xử lý từ dashboard'), onSuccess: () => { toast.success('Đã xử lý'); invalidate(); } });

  // SCR-06/07: mở phiên what-if (cách ly) + 2 phương án + 1 tiêu chí, chấm điểm, ghi quyết định.
  const openWhatIf = useMutation({
    mutationFn: async () => {
      const s = await createSession({ title: `What-if ${new Date().toLocaleString('vi-VN')}`, paramsJson: { note: 'kịch bản giả định' } });
      await addOption(s.id, { optionKey: 'A', label: 'Bổ sung tại chỗ' });
      await addOption(s.id, { optionKey: 'B', label: 'Điều chuyển liên vùng' });
      await addCriterion(s.id, { criterionKey: 'gapReduce', label: 'Giảm GAP', weight: 2, direction: 'HIGHER_BETTER' });
      await addCriterion(s.id, { criterionKey: 'cost', label: 'Chi phí', weight: 1, direction: 'LOWER_BETTER' });
      return s.id;
    },
    onSuccess: (id) => { setSessionId(id); setRanking(undefined); toast.info('Đã mở phiên what-if (cách ly, không ghi ngược vận hành)'); },
    onError: () => toast.error('Không mở được phiên'),
  });
  const scoreMut = useMutation({
    mutationFn: async () => scoreSession(sessionId!, [
      { optionKey: 'A', criterionKey: 'gapReduce', rawValue: 8 },
      { optionKey: 'B', criterionKey: 'gapReduce', rawValue: 4 },
      { optionKey: 'A', criterionKey: 'cost', rawValue: 30 },
      { optionKey: 'B', criterionKey: 'cost', rawValue: 12 },
    ]),
    onSuccess: (r) => { setRanking(r.ranking); toast.success('Đã chấm điểm phương án'); },
    onError: () => toast.error('Chấm điểm thất bại'),
  });
  const recordMut = useMutation({
    mutationFn: () => recordDecision(sessionId!, { chosenOptionKey: ranking?.[0]?.optionKey, rationale: 'Điểm tổng hợp cao nhất' }),
    onSuccess: () => { toast.success('Đã ghi quyết định'); if (sessionId) qc.invalidateQueries({ queryKey: ['dt12', 'session', sessionId] }); },
    onError: () => toast.error('Ghi quyết định thất bại'),
  });

  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('vi-VN'));

  return (
    <div>
      <PageHeader
        eyebrow="DT-12 · Quyển XII"
        title="Dashboard chỉ huy & hỗ trợ quyết định"
        description="Lớp semantic/KPI đọc snapshot chuẩn (DT-04/06/08/09/10). Mọi KPI có lineage về nguồn (AC-15); metric kèm as_of_time + độ tươi; what-if cách ly."
        actions={<button className="btn btn-primary" disabled={computeAll.isPending || !(kpis.data?.length)} onClick={() => computeAll.mutate()}><Icon name="refresh" size={14} /> Tính tất cả KPI</button>}
      />

      {/* SCR-01 — Tổng quan chỉ huy (KPI + freshness) */}
      <div className="panel">
        <h3><Icon name="chart" size={16} /> Tổng quan chỉ huy (KPI semantic + độ tươi)</h3>
        {overview.isLoading ? <Skeleton rows={3} /> : overview.error ? <ErrorState error={overview.error} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
            {(overview.data?.kpis ?? []).map((k) => (
              <div key={k.kpiCode} className="panel" style={{ margin: 0, cursor: 'pointer' }} onClick={() => drillMut.mutate(k.kpiCode)} title="Bấm để drill-down về nguồn">
                <div className="muted" style={{ fontSize: 12 }}>{k.name}</div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(k.value)} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{k.unit}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ ...BADGE, color: FRESHNESS_TONE[k.freshness], borderColor: FRESHNESS_TONE[k.freshness] }}>{FRESHNESS_LABEL[k.freshness] ?? k.freshness}</span>
                  <span className="muted" style={{ fontSize: 11 }}>lineage: {(k.lineage?.length ?? 0)} nguồn</span>
                </div>
                {k.asOfTime && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>as_of: {new Date(k.asOfTime).toLocaleString('vi-VN')}</div>}
              </div>
            ))}
            {(overview.data?.kpis?.length ?? 0) === 0 && <EmptyState title="Chưa có KPI" hint="Chạy seed:dashboard-dt12 hoặc tạo KPI để hiển thị." />}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* SCR-04 — Semantic explorer */}
        <div className="panel">
          <h3><Icon name="shield" size={16} /> Semantic explorer (HC / HC-AVAILABLE / … / GAP)</h3>
          {semantics.isLoading ? <Skeleton rows={4} /> : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>Semantic</th><th>Giá trị</th><th>Độ tươi</th></tr></thead>
              <tbody>
                {(semantics.data?.items ?? []).map((s) => (
                  <tr key={s.semantic}>
                    <td>{SEMANTIC_LABEL[s.semantic] ?? s.semantic}</td>
                    <td>{fmt(s.value)}</td>
                    <td><span style={{ ...BADGE, color: FRESHNESS_TONE[s.freshness], borderColor: FRESHNESS_TONE[s.freshness] }}>{FRESHNESS_LABEL[s.freshness] ?? s.freshness}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* SCR-03 — Drill-down KPI → nguồn */}
        <div className="panel">
          <h3><Icon name="target" size={16} /> Drill-down KPI → nguồn (khớp tổng)</h3>
          {!metricId ? <EmptyState title="Chưa chọn KPI" hint="Bấm một thẻ KPI ở Tổng quan để drill-down về dòng snapshot nguồn." /> : drilldown.isLoading ? <Skeleton rows={3} /> : drilldown.data ? (
            <div>
              <div className="muted" style={{ fontSize: 13 }}>
                {drilldown.data.kpiCode} · nguồn {drilldown.data.sourceType} · metric={fmt(drilldown.data.metricValue)} · Σ dòng={fmt(drilldown.data.drillDownTotal)}
                {drilldown.data.metricValue === drilldown.data.drillDownTotal && <strong style={{ color: '#16a34a' }}> · KHỚP</strong>}
              </div>
              <table className="table" style={{ marginTop: 8 }}>
                <thead><tr><th>Vật chất</th><th>Giá trị</th></tr></thead>
                <tbody>{drilldown.data.rows.slice(0, 20).map((r, i) => (<tr key={i}><td className="muted" style={{ fontSize: 11 }}>{r.materialCatalogId}</td><td>{fmt(r.value)}</td></tr>))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Không có dữ liệu" hint="Nguồn chưa có snapshot." />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* SCR-05 — Cảnh báo (lifecycle + SLA) */}
        <div className="panel">
          <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><Icon name="bell" size={16} /> Cảnh báo (OPEN → ACK → RESOLVED + SLA)</span>
            <button className="btn btn-small" disabled={evalMut.isPending} onClick={() => evalMut.mutate()}>Quét cảnh báo</button>
          </h3>
          {alerts.isLoading ? <Skeleton rows={3} /> : (alerts.data?.length ?? 0) === 0 ? <EmptyState title="Không có cảnh báo" hint="Bấm Quét cảnh báo để đánh giá KPI theo ngưỡng." /> : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>Mức</th><th>Giá trị</th><th>Trạng thái</th><th>SLA</th><th></th></tr></thead>
              <tbody>
                {(alerts.data ?? []).map((a) => (
                  <tr key={a.id}>
                    <td><span style={{ ...BADGE, color: SEVERITY_TONE[a.severity], borderColor: SEVERITY_TONE[a.severity] }}>{SEVERITY_LABEL[a.severity] ?? a.severity}</span></td>
                    <td>{fmt(a.value ? Number(a.value) : null)}</td>
                    <td>{ALERT_STATUS_LABEL[a.status] ?? a.status}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{a.dueAt ? new Date(a.dueAt).toLocaleDateString('vi-VN') : '—'}</td>
                    <td>
                      {a.status === 'OPEN' && <button className="btn btn-small" onClick={() => ackMut.mutate(a.id)}>Tiếp nhận</button>}
                      {a.status !== 'RESOLVED' && <button className="btn btn-small" onClick={() => resolveMut.mutate(a.id)}>Xử lý</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* SCR-08 — Độ tươi dữ liệu & nguồn (Data Mart) */}
        <div className="panel">
          <h3><Icon name="refresh" size={16} /> Độ tươi dữ liệu & nguồn (Data Mart)</h3>
          {freshness.isLoading ? <Skeleton rows={3} /> : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>Fact</th><th>Độ tươi</th><th>Dòng</th><th></th></tr></thead>
              <tbody>
                {(freshness.data?.items ?? []).map((f) => (
                  <tr key={f.factType}>
                    <td>{f.factType}</td>
                    <td><span style={{ ...BADGE, color: FRESHNESS_TONE[f.freshness], borderColor: FRESHNESS_TONE[f.freshness] }}>{FRESHNESS_LABEL[f.freshness] ?? f.freshness}</span></td>
                    <td>{f.rowCount}</td>
                    <td><button className="btn btn-small" disabled={refreshMut.isPending} onClick={() => refreshMut.mutate(f.factType)}>Refresh</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* SCR-02 — Bản đồ vật chất theo phân quyền vị trí */}
        <div className="panel">
          <h3><Icon name="map" size={16} /> Bản đồ vật chất theo quyền vị trí (data-scope)</h3>
          {map.isLoading ? <Skeleton rows={3} /> : (map.data?.items?.length ?? 0) === 0 ? <EmptyState title="Không có dữ liệu trong phạm vi" hint="Chỉ hiển thị vị trí thuộc phạm vi được giao." /> : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>Đơn vị</th><th>HC</th></tr></thead>
              <tbody>{(map.data?.items ?? []).map((m) => (<tr key={m.organizationId}><td className="muted" style={{ fontSize: 11 }}>{m.organizationId}</td><td>{fmt(m.hc)}</td></tr>))}</tbody>
            </table>
          )}
        </div>

        {/* SCR-06/07 — What-if cách ly + hỗ trợ quyết định */}
        <div className="panel">
          <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><Icon name="clipboard" size={16} /> What-if & hỗ trợ quyết định (cách ly)</span>
            <button className="btn btn-small" disabled={openWhatIf.isPending} onClick={() => openWhatIf.mutate()}>Mở phiên what-if</button>
          </h3>
          {!sessionId ? <EmptyState title="Chưa mở phiên" hint="Mở phiên what-if để so sánh phương án; thay đổi tham số KHÔNG ghi ngược dữ liệu vận hành." /> : (
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Phiên {session.data?.session.sessionCode} · trạng thái {session.data?.session.status}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" disabled={scoreMut.isPending} onClick={() => scoreMut.mutate()}>Chấm điểm phương án</button>
                <button className="btn btn-primary" disabled={!ranking || recordMut.isPending} onClick={() => recordMut.mutate()}>Ghi quyết định</button>
              </div>
              {ranking && (
                <table className="table" style={{ marginTop: 8 }}>
                  <thead><tr><th>Xếp hạng phương án</th><th>Điểm</th></tr></thead>
                  <tbody>{ranking.map((r, i) => (<tr key={r.optionKey ?? i}><td>{i + 1}. {r.optionKey}</td><td>{r.total.toFixed(3)}</td></tr>))}</tbody>
                </table>
              )}
              {(session.data?.records?.length ?? 0) > 0 && <div className="muted" style={{ marginTop: 8, color: '#16a34a' }}>Đã ghi quyết định: chọn phương án {session.data?.options.find((o) => o.id === session.data?.records[0].chosenOptionId)?.optionKey ?? '—'}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
