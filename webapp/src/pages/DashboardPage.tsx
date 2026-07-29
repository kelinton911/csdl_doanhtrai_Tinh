import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar } from 'react-chartjs-2';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth, ROLE_LABEL } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num } from '../lib/format';
import {
  CONDITION_COLOR,
  CONDITION_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../lib/charts';

interface Summary {
  generatedAt: string;
  barracks: { total: number; approved: number; pending: number; draft: number; capacity: number; landArea: number };
  facilities: { total: number; inUse: number; decommissioned: number };
  materials: { total: number; published: number };
  dataConfirmedRatio: number;
  criticalAlerts: number;
  charts: {
    facilitiesByCondition: Array<{ condition: string; count: number }>;
    barracksByStatus: Array<{ status: string; count: number }>;
  };
  topIssues: Array<{ severity: string; title: string; count: number }>;
}
interface Feature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] } | null;
  properties: Record<string, unknown>;
}
interface FC { type: 'FeatureCollection'; features: Feature[] }

const MODES = ['Bình thường', 'SSCĐ', 'Tình huống giả định'];
const MODE_CODE: Record<string, string> = { 'Bình thường': 'NORMAL', 'SSCĐ': 'SSCD', 'Tình huống giả định': 'SCENARIO' };
const SEV: Record<string, { fg: string; bg: string; bd: string }> = {
  danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' },
  warn: { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' },
  info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' },
};

export function DashboardPage() {
  const { profile, hasRole } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState(MODES[0]);
  const canReport = hasRole('PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN', 'REPORT_VIEWER');

  const q = useQuery({
    queryKey: ['dashboard-summary', mode],
    queryFn: async () => (await api.get<Summary>('/dashboard/summary', { params: { mode: MODE_CODE[mode] } })).data,
    refetchInterval: 60_000,
  });
  const geo = useQuery({
    queryKey: ['gis', 'barracks'],
    queryFn: async () => (await api.get<FC>('/gis/features', { params: { layer: 'barracks' } })).data,
  });

  const approveReport = useMutation({
    mutationFn: async () => (await api.post('/reports/jobs', { template: 'barracks-summary', format: 'pdf' })).data,
    onSuccess: () => { toast.success('Đã tạo báo cáo tổng hợp cho chỉ huy. Mở mục Báo cáo để tải khi hoàn tất.'); nav('/reports'); },
    onError: (e) => toast.problem(e, 'Không tạo được báo cáo'),
  });

  const points = (geo.data?.features ?? []).filter((f) => f.geometry?.coordinates);
  const mapCenter: [number, number] = points.length
    ? [points[0].geometry!.coordinates[1], points[0].geometry!.coordinates[0]]
    : [15.9, 108.2];

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan chỉ huy"
        title={`Xin chào, ${profile?.fullName ?? ''}`}
        description={`Vai trò: ${(profile?.roles ?? []).map((r) => ROLE_LABEL[r] ?? r).join(', ')}. Toàn bộ số liệu là dữ liệu giả lập phục vụ thiết kế.`}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-neutral-200)', padding: 4, borderRadius: 8 }}>
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="btn btn-sm"
                  style={{
                    border: 'none',
                    background: mode === m ? 'var(--surface-1)' : 'transparent',
                    fontWeight: mode === m ? 700 : 500,
                    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            {canReport && (
              <button className="btn btn-primary" disabled={approveReport.isPending} onClick={() => approveReport.mutate()}>
                <Icon name="download" size={16} /> Duyệt báo cáo cho chỉ huy
              </button>
            )}
          </div>
        }
      />

      {q.isLoading && <Skeleton rows={4} />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && (
        <>
          {mode !== 'Bình thường' && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, border: '1px dashed var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="target" size={16} /> Chế độ <b>{mode}</b> — vấn đề cần xử lý & cảnh báo đã tính lại theo bối cảnh {mode === 'SSCĐ' ? '(nhấn mức sẵn sàng chiến đấu)' : '(gồm thiệt hại mô phỏng, tách khỏi số liệu thực)'}.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            <KpiCard label="Tổng số doanh trại" value={num(q.data.barracks.total)} unit="hồ sơ" icon="building" dom="asset" hint={`${q.data.barracks.approved} đã duyệt`} onClick={() => nav('/barracks')} />
            <KpiCard label="Công trình đang khai thác" value={num(q.data.facilities.inUse)} unit={`/ ${num(q.data.facilities.total)}`} icon="grid" dom="cmd" trend={{ dir: 'flat', text: `${q.data.facilities.decommissioned} ngừng KT` }} />
            <KpiCard label="Tỷ lệ dữ liệu đã xác nhận" value={num(q.data.dataConfirmedRatio)} unit="%" icon="check" dom="cap" trend={{ dir: q.data.dataConfirmedRatio >= 60 ? 'up' : 'down', text: q.data.dataConfirmedRatio >= 60 ? 'Đạt mục tiêu' : 'Dưới mục tiêu' }} />
            <KpiCard label="Khả năng tiếp nhận" value={num(q.data.barracks.capacity)} unit="người" icon="user" dom="plan" />
            <KpiCard label="Cảnh báo trọng yếu" value={num(q.data.criticalAlerts)} icon="alert" dom="repair" hint="Mở trung tâm cảnh báo" onClick={() => nav('/alerts')} />
          </div>

          {/* Bản đồ tổng thể vật chất (Frontend §1.2 — bản đồ chiếm phần lớn canvas) */}
          <div className="card" style={{ padding: 0, marginTop: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--color-neutral-200)' }}>
              <div className="eyebrow">Bản đồ doanh trại toàn tỉnh</div>
              <button className="btn btn-sm" onClick={() => nav('/map')}><Icon name="map" size={14} /> Mở bản đồ đầy đủ</button>
            </div>
            <div style={{ height: '42vh', minHeight: 300 }}>
              <MapContainer center={mapCenter} zoom={9} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {points.map((f) => {
                  const [lng, lat] = f.geometry!.coordinates;
                  return (
                    <CircleMarker key={String(f.properties.id)} center={[lat, lng]} radius={7} pathOptions={{ color: '#10609e', fillColor: '#10609e', fillOpacity: 0.75, weight: 1.5 }}>
                      <Tooltip>{String(f.properties.name)}</Tooltip>
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <div style={{ fontWeight: 700 }}>{String(f.properties.name)}</div>
                          <div className="num" style={{ fontSize: 12, color: '#627d98' }}>{String(f.properties.code)}</div>
                          <button className="btn btn-sm btn-primary" style={{ marginTop: 6 }} onClick={() => nav(`/barracks/${f.properties.id}`)}>Mở hồ sơ</button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Cơ cấu chất lượng công trình</div>
              <div style={{ maxHeight: 260 }}>
                <Doughnut
                  data={{
                    labels: q.data.charts.facilitiesByCondition.map((c) => CONDITION_LABEL[c.condition] ?? c.condition),
                    datasets: [{
                      data: q.data.charts.facilitiesByCondition.map((c) => c.count),
                      backgroundColor: q.data.charts.facilitiesByCondition.map((c) => CONDITION_COLOR[c.condition] ?? '#9fb3c8'),
                      borderWidth: 0,
                    }],
                  }}
                  options={{ maintainAspectRatio: false, cutout: '60%' }}
                  height={240}
                />
              </div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Hồ sơ doanh trại theo trạng thái</div>
              <div style={{ maxHeight: 260 }}>
                <Bar
                  data={{
                    labels: q.data.charts.barracksByStatus.map((s) => STATUS_LABEL[s.status] ?? s.status),
                    datasets: [{
                      label: 'Số hồ sơ',
                      data: q.data.charts.barracksByStatus.map((s) => s.count),
                      backgroundColor: q.data.charts.barracksByStatus.map((s) => STATUS_COLOR[s.status] ?? '#829ab1'),
                      borderRadius: 6,
                    }],
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
                  height={240}
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="eyebrow">Vấn đề cần xử lý</div>
              <span className="muted" style={{ fontSize: 12 }}>Chốt số liệu: {new Date(q.data.generatedAt).toLocaleString('vi-VN')}</span>
            </div>
            {q.data.topIssues.length === 0 ? (
              <div className="muted">Không có vấn đề nổi cộm.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.data.topIssues.map((iss, i) => {
                  const s = SEV[iss.severity] ?? SEV.info;
                  return (
                    <button
                      key={i}
                      onClick={() => nav('/alerts')}
                      title="Mở trung tâm cảnh báo"
                      style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${s.bd}`, background: s.bg, borderRadius: 8 }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: s.fg, fontWeight: 600 }}>
                        <Icon name="alert" size={16} /> {iss.title}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.fg }}>
                        <span className="num" style={{ fontWeight: 700 }}>{num(iss.count)}</span>
                        <Icon name="chevron" size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
