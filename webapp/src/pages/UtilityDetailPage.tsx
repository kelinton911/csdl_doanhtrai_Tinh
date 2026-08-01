import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import '../lib/charts';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { num, currency, dateTime } from '../lib/format';
import { CategoryChip, StatusChip } from './UtilitiesListPage';
import { KIND_LABEL, CATEGORY_COLOR, CATEGORY_LABEL } from '../lib/utility';

interface System {
  id: string; code: string; name: string; category: string; kind: string;
  capacity: string; capacityUnit: string | null; reserveVolume: string; reserveUnit: string | null;
  fuelType: string | null; fuelLevel: string; autonomyHours: string; meterNo: string | null;
  status: string; lastMaintenanceAt: string | null; nextMaintenanceAt: string | null;
  notes: string | null; barracksName: string | null; areaName: string | null; readingCount: number; updatedAt: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
}
interface Reading { id: string; readingDate: string; indexValue: number | null; consumption: number | null; cost: number | null; note: string | null }

const TABS = ['Thông tin', 'Chỉ số & tiêu thụ'] as const;

export function UtilityDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Thông tin');
  const [addOpen, setAddOpen] = useState(false);
  const [decomOpen, setDecomOpen] = useState(false);

  const s = useQuery({ queryKey: ['utility', id], queryFn: async () => (await api.get<System>(`/utilities/${id}`)).data });
  const readings = useQuery({
    queryKey: ['utility', id, 'readings'],
    queryFn: async () => (await api.get<Reading[]>(`/utilities/${id}/readings`)).data,
    enabled: tab === 'Chỉ số & tiêu thụ',
  });

  const canManage = can('COMMUNE_USER', 'BARRACKS_OFFICER');

  if (s.isLoading) return <Skeleton rows={6} />;
  if (s.isError || !s.data) return <ErrorState error={s.error} />;
  const d = s.data;
  const color = CATEGORY_COLOR[d.category] ?? 'var(--color-accent-600)';

  // Biểu đồ tiêu thụ theo thời gian (đảo về thứ tự tăng dần theo ngày).
  const chartRows = [...(readings.data ?? [])].reverse();
  const chartData = {
    labels: chartRows.map((r) => r.readingDate),
    datasets: [
      { label: 'Mức tiêu thụ', data: chartRows.map((r) => r.consumption ?? 0), borderColor: color, backgroundColor: color, tension: 0.3 },
    ],
  };

  const readingCols: Column<Reading>[] = [
    { key: 'date', header: 'Kỳ ghi', render: (r) => r.readingDate, mono: true },
    { key: 'index', header: 'Chỉ số', render: (r) => (r.indexValue != null ? num(r.indexValue) : '—'), align: 'right', mono: true },
    { key: 'cons', header: 'Tiêu thụ', render: (r) => (r.consumption != null ? num(r.consumption) : '—'), align: 'right', mono: true },
    { key: 'cost', header: 'Chi phí', render: (r) => (r.cost != null ? currency(r.cost) : '—'), align: 'right', mono: true },
    { key: 'note', header: 'Ghi chú', render: (r) => r.note ?? '—' },
  ];

  const maintOverdue = d.nextMaintenanceAt && new Date(d.nextMaintenanceAt) < new Date();

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/utilities')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách hạ tầng
      </button>
      <PageHeader
        eyebrow={`${CATEGORY_LABEL[d.category] ?? d.category} · ${d.code}`}
        title={d.name}
        description={`${KIND_LABEL[d.kind] ?? d.kind}${d.barracksName ? ` · ${d.barracksName}` : ''} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusChip status={d.status} />
            {canManage && d.status !== 'DECOMMISSIONED' && <button className="btn" onClick={() => nav(`/utilities/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && d.status !== 'DECOMMISSIONED' && <button className="btn" onClick={() => setDecomOpen(true)} title="Ngừng sử dụng"><Icon name="lock" size={16} /> Ngừng</button>}
          </div>
        }
      />

      {maintOverdue && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
          <Icon name="clock" size={18} /> Quá hạn bảo dưỡng (hạn: {isoLabel(d.nextMaintenanceAt)}).
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{t}</button>
        ))}
      </div>

      {tab === 'Thông tin' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="field-grid">
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Thông số kỹ thuật</div>
            <Field label="Công suất/dung tích" value={`${num(d.capacity)} ${d.capacityUnit ?? ''}`} mono />
            <Field label="Số công tơ/đồng hồ" value={d.meterNo ?? '—'} mono />
            <Field label="Khả năng tự bảo đảm" value={Number(d.autonomyHours) > 0 ? `${num(d.autonomyHours)} giờ` : '—'} mono />
            {d.category !== 'ELECTRICITY' && <Field label="Lượng dự trữ" value={Number(d.reserveVolume) > 0 ? `${num(d.reserveVolume)} ${d.reserveUnit ?? ''}` : '—'} mono />}
            {(d.kind === 'GENERATOR' || d.kind === 'FUEL_TANK') && <Field label="Nhiên liệu" value={`${d.fuelType ?? '—'} · ${num(d.fuelLevel)} lít`} />}
            <Field label="Tọa độ" value={d.location ? `${d.location.coordinates[1].toFixed(5)}, ${d.location.coordinates[0].toFixed(5)}` : '—'} mono />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Vận hành & bảo dưỡng</div>
            <Field label="Doanh trại" value={d.barracksName ?? '—'} />
            <Field label="Địa bàn" value={d.areaName ?? '—'} />
            <Field label="Bảo dưỡng gần nhất" value={isoLabel(d.lastMaintenanceAt)} mono />
            <Field label="Hạn bảo dưỡng kế tiếp" value={isoLabel(d.nextMaintenanceAt)} mono />
            <Field label="Số kỳ đã ghi chỉ số" value={String(d.readingCount)} mono />
            {d.notes && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>{d.notes}</p>}
          </div>
        </div>
      )}

      {tab === 'Chỉ số & tiêu thụ' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Chỉ số công tơ · mức tiêu thụ · chi phí</div>
            {canManage && <button className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Ghi chỉ số</button>}
          </div>
          {readings.isLoading ? (
            <Skeleton rows={5} />
          ) : (
            <>
              {chartRows.length >= 2 && (
                <div className="card" style={{ padding: 16, marginBottom: 14, height: 260 }}>
                  <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              )}
              <DataTable columns={readingCols} rows={readings.data} rowKey={(r) => r.id} emptyTitle="Chưa có kỳ ghi chỉ số" emptyHint="Ghi chỉ số công tơ/đồng hồ để theo dõi mức tiêu thụ và chi phí." />
            </>
          )}
        </>
      )}

      {addOpen && <AddReadingModal systemId={id!} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['utility', id, 'readings'] }); qc.invalidateQueries({ queryKey: ['utility', id] }); }} />}
      {decomOpen && <DecommissionModal systemId={id!} onClose={() => setDecomOpen(false)} onDone={() => { setDecomOpen(false); qc.invalidateQueries({ queryKey: ['utility', id] }); }} />}
    </>
  );
}

function isoLabel(v: string | null) { return v ? String(v).slice(0, 10) : '—'; }

function AddReadingModal({ systemId, onClose, onDone }: { systemId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ readingDate: new Date().toISOString().slice(0, 10), indexValue: '', cost: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/utilities/${systemId}/readings`, {
      readingDate: f.readingDate,
      indexValue: f.indexValue ? Number(f.indexValue) : undefined,
      cost: f.cost ? Number(f.cost) : undefined,
      note: f.note || undefined,
    }),
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Ghi chỉ số công tơ/đồng hồ" onClose={onClose} width={460}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Kỳ ghi</label><input className="input" type="date" value={f.readingDate} onChange={(e) => setF((s) => ({ ...s, readingDate: e.target.value }))} /></div>
        <div><label className="field-label">Chỉ số công tơ (kWh/m³)</label><input className="input num" type="number" value={f.indexValue} onChange={(e) => setF((s) => ({ ...s, indexValue: e.target.value }))} placeholder="Mức tiêu thụ tự tính từ kỳ trước" /></div>
        <div><label className="field-label">Chi phí (VND)</label><input className="input num" type="number" value={f.cost} onChange={(e) => setF((s) => ({ ...s, cost: e.target.value }))} /></div>
        <div><label className="field-label">Ghi chú</label><input className="input" value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Lưu chỉ số</button>
        </div>
      </div>
    </Modal>
  );
}

function DecommissionModal({ systemId, onClose, onDone }: { systemId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({ mutationFn: async () => api.post(`/utilities/${systemId}/decommission`, { reason }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Ngừng sử dụng hệ thống" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Không xóa cứng — hệ thống chuyển sang trạng thái ngừng và giữ nguyên lịch sử chỉ số.</p>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Lý do</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Thanh lý/hỏng không sửa được…" autoFocus /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>Xác nhận ngừng</button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
