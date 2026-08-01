import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { downloadCsv } from '../lib/csv';
import { dateTime } from '../lib/format';

interface AreaReadiness {
  id: string;
  code: string;
  name: string;
  type: string;
  barracksCount: number;
  avgCompleteness: number;
  incompleteCount: number;
  staleCount: number;
  lastUpdated: string | null;
}
interface Resp {
  generatedAt: string;
  staleDays: number;
  areas: AreaReadiness[];
}

const TYPE_LABEL: Record<string, string> = { COMMUNE: 'Xã', WARD: 'Phường', SPECIAL_ZONE: 'Đặc khu' };

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--ok-fg)';
  if (v >= 50) return 'var(--warn-fg)';
  return 'var(--danger-fg)';
}

// M15 — So sánh mức hoàn chỉnh & độ tươi hồ sơ doanh trại giữa các địa bàn cấp xã.
export function CommuneReadinessPage() {
  const [staleDays, setStaleDays] = useState('90');
  const q = useQuery({
    queryKey: ['commune-readiness', staleDays],
    queryFn: async () => (await api.get('/dashboard/commune-readiness', { params: { staleDays } })).data as Resp,
  });

  const areas = q.data?.areas ?? [];
  const summary = {
    total: areas.length,
    withData: areas.filter((a) => a.barracksCount > 0).length,
    empty: areas.filter((a) => a.barracksCount === 0).length,
    stale: areas.reduce((s, a) => s + a.staleCount, 0),
  };

  const columns: Column<AreaReadiness>[] = [
    { key: 'name', header: 'Địa bàn', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.name}</div>
        <div className="muted num" style={{ fontSize: 11 }}>{r.code} · {TYPE_LABEL[r.type] ?? r.type}</div>
      </div>
    ) },
    { key: 'barracks', header: 'Hồ sơ DT', align: 'right', mono: true, render: (r) => r.barracksCount },
    { key: 'completeness', header: 'Điểm hoàn chỉnh TB', align: 'right', render: (r) => (
      r.barracksCount === 0 ? <span className="muted">—</span> : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${r.avgCompleteness}%`, background: scoreColor(r.avgCompleteness) }} />
          </span>
          <strong className="num" style={{ color: scoreColor(r.avgCompleteness), minWidth: 36, textAlign: 'right' }}>{r.avgCompleteness}%</strong>
        </span>
      )
    ) },
    { key: 'incomplete', header: 'Chưa đầy đủ', align: 'right', mono: true, render: (r) => r.incompleteCount || <span className="muted">0</span> },
    { key: 'stale', header: `Chưa cập nhật >${q.data?.staleDays ?? staleDays}n`, align: 'right', render: (r) => (
      r.staleCount > 0 ? <span style={{ color: 'var(--danger-fg)', fontWeight: 700 }} className="num">{r.staleCount}</span> : <span className="muted num">0</span>
    ) },
    { key: 'updated', header: 'Cập nhật gần nhất', align: 'right', mono: true, render: (r) => (r.lastUpdated ? dateTime(r.lastUpdated) : <span className="muted">Chưa có</span>) },
  ];

  const exportCsv = () =>
    downloadCsv('muc-hoan-chinh-ho-so-theo-xa', areas, [
      { header: 'Mã', value: (r) => r.code },
      { header: 'Địa bàn', value: (r) => r.name },
      { header: 'Loại', value: (r) => TYPE_LABEL[r.type] ?? r.type },
      { header: 'Số hồ sơ', value: (r) => r.barracksCount },
      { header: 'Điểm hoàn chỉnh TB (%)', value: (r) => r.avgCompleteness },
      { header: 'Chưa đầy đủ', value: (r) => r.incompleteCount },
      { header: 'Chưa cập nhật', value: (r) => r.staleCount },
      { header: 'Cập nhật gần nhất', value: (r) => (r.lastUpdated ? dateTime(r.lastUpdated) : '') },
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Cấp xã"
        title="Mức hoàn chỉnh hồ sơ theo địa bàn"
        description="Chấm điểm mức độ hoàn chỉnh hồ sơ doanh trại điện tử và cảnh báo địa bàn chưa cập nhật, phục vụ đôn đốc và kiểm tra của cấp Tỉnh."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Ngưỡng (ngày):</label>
            <select className="input" style={{ width: 90 }} value={staleDays} onChange={(e) => setStaleDays(e.target.value)}>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="180">180</option>
              <option value="365">365</option>
            </select>
            <button className="btn" onClick={exportCsv} disabled={areas.length === 0}>
              <Icon name="download" size={16} /> Xuất CSV
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <div className="panel" style={{ padding: 16 }}><Skeleton rows={8} /></div>
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Kpi label="Địa bàn" value={summary.total} />
            <Kpi label="Đã có hồ sơ" value={summary.withData} />
            <Kpi label="Chưa có hồ sơ" value={summary.empty} tone={summary.empty > 0 ? 'warn' : undefined} />
            <Kpi label="Hồ sơ quá hạn cập nhật" value={summary.stale} tone={summary.stale > 0 ? 'danger' : undefined} />
          </div>
          <DataTable
            columns={columns}
            rows={areas}
            rowKey={(r) => r.id}
            emptyTitle="Chưa có địa bàn cấp xã"
            emptyHint="Cần seed/nhập danh sách xã/phường/đặc khu."
          />
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : 'var(--color-text)';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, color }}>{value.toLocaleString('vi-VN')}</div>
    </div>
  );
}
