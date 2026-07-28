import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, date, dateTime } from '../lib/format';

interface Barracks {
  id: string;
  code: string;
  name: string;
  address: string | null;
  landArea: string;
  function: string | null;
  declaredCapacity: number;
  workflowStatus: string;
  areaName: string | null;
  orgName: string | null;
  updatedAt: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
}
interface Facility {
  id: string;
  code: string;
  name: string;
  type: string | null;
  area: string;
  buildYear: number | null;
  condition: string | null;
  status: string;
}
interface Revision {
  revisionNo: number;
  workflowStatus: string;
  createdAt: string;
  createdBy: string | null;
}

const TABS = ['Tổng quan', 'Công trình', 'Bản đồ', 'Lịch sử'] as const;

export function BarracksDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan');
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(false);
  const facType = useCatalog('facility-type');
  const grade = useCatalog('quality-grade');

  const b = useQuery({
    queryKey: ['barracks', id],
    queryFn: async () => (await api.get<Barracks>(`/barracks/${id}`)).data,
  });
  const facs = useQuery({
    queryKey: ['barracks', id, 'facilities'],
    queryFn: async () =>
      (await api.get(`/barracks/${id}/facilities`, { params: { size: 100 } })).data as {
        data: Facility[];
        meta: { total: number };
      },
  });
  const revs = useQuery({
    queryKey: ['barracks', id, 'revisions'],
    queryFn: async () => (await api.get<Revision[]>(`/barracks/${id}/revisions`)).data,
    enabled: tab === 'Lịch sử',
  });

  const act = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'request-changes') =>
      (await api.post(`/barracks/${id}/${action}`)).data,
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['barracks', id] });
      qc.invalidateQueries({ queryKey: ['barracks', id, 'revisions'] });
    },
    onError: (e) => setActionError(toProblem(e).title),
  });

  if (b.isLoading) return <Skeleton rows={6} />;
  if (b.isError || !b.data) return <ErrorState error={b.error} />;
  const d = b.data;
  const status = d.workflowStatus;
  const canSubmit = ['DRAFT', 'CHANGES_REQUESTED'].includes(status) && hasRole('COMMUNE_USER', 'BARRACKS_OFFICER');
  const canReview = status === 'PENDING_REVIEW' && hasRole('REVIEWER', 'BARRACKS_OFFICER');

  const facColumns: Column<Facility>[] = [
    { key: 'code', header: 'Mã', render: (f) => f.code, mono: true, width: 80 },
    { key: 'name', header: 'Tên', render: (f) => <span style={{ fontWeight: 600 }}>{f.name}</span> },
    { key: 'type', header: 'Loại', render: (f) => facType.label(f.type) },
    { key: 'area', header: 'Diện tích (m²)', render: (f) => num(f.area), align: 'right', mono: true },
    { key: 'year', header: 'Năm XD', render: (f) => f.buildYear ?? '—', align: 'right', mono: true },
    { key: 'cond', header: 'Chất lượng', render: (f) => <ConditionChip code={f.condition} label={grade.label(f.condition)} /> },
    { key: 'status', header: 'Khai thác', render: (f) => <StatusBadge status={f.status} /> },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/barracks')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách doanh trại
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${d.areaName ?? ''}`}
        title={d.name}
        description={`Đơn vị quản lý: ${d.orgName ?? '—'} · Cập nhật: ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={status} />
            <button className="btn" onClick={() => setEvidence(true)}>
              <Icon name="file" size={16} /> Tài liệu
            </button>
            {canSubmit && (
              <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('submit')}>
                <Icon name="upload" size={16} /> Gửi duyệt
              </button>
            )}
            {canReview && (
              <>
                <button className="btn" disabled={act.isPending} onClick={() => act.mutate('request-changes')}>
                  <Icon name="alert" size={16} /> Yêu cầu bổ sung
                </button>
                <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('approve')}>
                  <Icon name="check" size={16} /> Phê duyệt
                </button>
              </>
            )}
          </div>
        }
      />

      {actionError && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {actionError}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ all: 'unset', cursor: 'pointer', padding: '10px 16px', fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Tổng quan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin hồ sơ</div>
            <Field label="Địa chỉ" value={d.address ?? '—'} />
            <Field label="Diện tích đất" value={`${num(d.landArea)} m²`} mono />
            <Field label="Chức năng" value={d.function ?? '—'} />
            <Field label="Khả năng tiếp nhận" value={`${num(d.declaredCapacity)} người`} mono />
            <Field label="Xã/phường" value={d.areaName ?? '—'} />
            <Field label="Đơn vị quản lý" value={d.orgName ?? '—'} />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Đánh giá khả năng bảo đảm</div>
            <Scorecard label="Số công trình" value={num(facs.data?.meta.total ?? 0)} />
            <Scorecard label="Đang khai thác" value={num((facs.data?.data ?? []).filter((f) => f.status === 'IN_USE').length)} tone="ok" />
            <Scorecard label="Chất lượng kém" value={num((facs.data?.data ?? []).filter((f) => f.condition === 'KEM').length)} tone="danger" />
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Điểm số tính từ tình trạng công trình và mức độ đầy đủ dữ liệu. Không xóa cứng khi đã phát sinh lịch sử — dùng trạng thái ngừng khai thác.
            </p>
          </div>
        </div>
      )}

      {tab === 'Công trình' && (
        <DataTable
          columns={facColumns}
          rows={facs.data?.data}
          loading={facs.isLoading}
          rowKey={(f) => f.id}
          emptyTitle="Chưa có công trình"
          emptyHint="Doanh trại này chưa khai báo công trình nào."
        />
      )}

      {tab === 'Bản đồ' && (
        <div className="panel" style={{ height: '60vh', overflow: 'hidden' }}>
          {d.location ? (
            <MapContainer center={[d.location.coordinates[1], d.location.coordinates[0]]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <CircleMarker center={[d.location.coordinates[1], d.location.coordinates[0]]} radius={9} pathOptions={{ color: '#10609e', fillColor: '#10609e', fillOpacity: 0.8 }}>
                <Tooltip permanent>{d.name}</Tooltip>
              </CircleMarker>
            </MapContainer>
          ) : (
            <EmptyState icon="map" title="Chưa có toạ độ" hint="Hồ sơ chưa gắn vị trí không gian." />
          )}
        </div>
      )}

      {tab === 'Lịch sử' && (
        <div className="panel" style={{ padding: 18 }}>
          {revs.isLoading ? (
            <Skeleton rows={4} />
          ) : (revs.data ?? []).length === 0 ? (
            <EmptyState icon="clock" title="Chưa có lịch sử phiên bản" hint="Lịch sử được tạo khi hồ sơ chuyển trạng thái." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(revs.data ?? []).map((r, i) => (
                <div key={r.revisionNo} style={{ display: 'flex', gap: 14, paddingBottom: 18, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-accent-600)', marginTop: 4 }} />
                    {i < (revs.data ?? []).length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--color-neutral-300)' }} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="num" style={{ fontWeight: 700 }}>#{r.revisionNo}</span>
                      <StatusBadge status={r.workflowStatus} />
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{dateTime(r.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {evidence && <EvidenceDrawer entityType="barracks" entityId={id!} onClose={() => setEvidence(false)} />}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Scorecard({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  const color = tone === 'ok' ? 'var(--ok-fg)' : tone === 'danger' ? 'var(--danger-fg)' : 'var(--color-text)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <span className="num" style={{ fontWeight: 700, fontSize: 18, color }}>{value}</span>
    </div>
  );
}

function ConditionChip({ code, label }: { code: string | null; label: string }) {
  const c = code === 'TOT' ? '#16a34a' : code === 'KHA' ? '#178f8b' : code === 'TRUNG_BINH' ? '#f59e0b' : code === 'KEM' ? '#dc2626' : '#9fb3c8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} /> {label}
    </span>
  );
}
