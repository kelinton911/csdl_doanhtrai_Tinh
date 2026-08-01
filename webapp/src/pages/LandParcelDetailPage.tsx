import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, dateTime } from '../lib/format';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import {
  USAGE_LABEL, LEGAL_LABEL, DISPUTE_LABEL, EXPANSION_LABEL, SAFETY_LABEL, LANDUSE_LABEL, disputeColor,
} from '../lib/landParcel';

interface Parcel {
  id: string; code: string; name: string; address: string | null; landArea: string;
  landUseType: string | null; usageStatus: string; legalStatus: string; legalOrigin: string | null;
  certificateNo: string | null; disputeStatus: string; disputeNote: string | null;
  accessRoad: string | null; hasElectricity: boolean; hasWater: boolean;
  expansionCapability: string | null; safetyStatus: string | null; notes: string | null;
  workflowStatus: string; areaName: string | null; orgName: string | null; barracksName: string | null;
  barracksId: string | null; markerCount: number; updatedAt: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
  boundary: { type: 'MultiPolygon'; coordinates: number[][][][] } | null;
}
interface Marker { id: string; code: string; note: string | null; createdAt: string; location: { type: 'Point'; coordinates: [number, number] } | null }
interface Revision { revisionNo: number; workflowStatus: string; createdAt: string }

const TABS = ['Tổng quan & pháp lý', 'Mốc giới', 'Bản đồ ranh giới', 'Hồ sơ pháp lý', 'Lịch sử phiên bản'] as const;

export function LandParcelDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan & pháp lý');
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(false);
  const [newMarker, setNewMarker] = useState({ code: '', note: '' });

  const p = useQuery({ queryKey: ['land-parcel', id], queryFn: async () => (await api.get<Parcel>(`/land-parcels/${id}`)).data });
  const markers = useQuery({
    queryKey: ['land-parcel', id, 'markers'],
    queryFn: async () => (await api.get<Marker[]>(`/land-parcels/${id}/markers`)).data,
    enabled: tab === 'Mốc giới' || tab === 'Bản đồ ranh giới',
  });
  const revs = useQuery({
    queryKey: ['land-parcel', id, 'revisions'],
    queryFn: async () => (await api.get<Revision[]>(`/land-parcels/${id}/revisions`)).data,
    enabled: tab === 'Lịch sử phiên bản',
  });

  const act = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'request-changes') => (await api.post(`/land-parcels/${id}/${action}`)).data,
    onSuccess: (_d, action) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['land-parcel', id] });
      toast.success(action === 'submit' ? 'Đã gửi hồ sơ đi duyệt.' : action === 'approve' ? 'Đã phê duyệt hồ sơ.' : 'Đã gửi yêu cầu bổ sung.');
    },
    onError: (e) => { setActionError(toProblem(e).title); toast.problem(e); },
  });

  const addMarker = useMutation({
    mutationFn: async () => api.post(`/land-parcels/${id}/markers`, { code: newMarker.code.trim(), note: newMarker.note || undefined }),
    onSuccess: () => { setNewMarker({ code: '', note: '' }); qc.invalidateQueries({ queryKey: ['land-parcel', id, 'markers'] }); qc.invalidateQueries({ queryKey: ['land-parcel', id] }); toast.success('Đã thêm mốc giới.'); },
    onError: (e) => toast.problem(e, 'Không thêm được mốc giới'),
  });
  const delMarker = useMutation({
    mutationFn: async (mid: string) => api.delete(`/land-parcels/${id}/markers/${mid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['land-parcel', id, 'markers'] }); qc.invalidateQueries({ queryKey: ['land-parcel', id] }); toast.success('Đã xóa mốc giới.'); },
    onError: (e) => toast.problem(e, 'Không xóa được mốc giới'),
  });

  if (p.isLoading) return <Skeleton rows={6} />;
  if (p.isError || !p.data) return <ErrorState error={p.error} />;
  const d = p.data;
  const status = d.workflowStatus;
  const canSubmit = ['DRAFT', 'CHANGES_REQUESTED'].includes(status) && hasRole('COMMUNE_USER', 'BARRACKS_OFFICER');
  const canReview = status === 'PENDING_REVIEW' && hasRole('REVIEWER', 'BARRACKS_OFFICER');
  const canEditMarkers = hasRole('COMMUNE_USER', 'BARRACKS_OFFICER');
  const dc = disputeColor(d.disputeStatus);

  const center: [number, number] = d.location ? [d.location.coordinates[1], d.location.coordinates[0]] : [19.8069, 105.7772];
  // MultiPolygon → mảng polygon [ [ [lat,lng]... ] ] cho react-leaflet.
  const polygons = (d.boundary?.coordinates ?? []).map((poly) => poly[0].map(([lng, lat]) => [lat, lng] as [number, number]));

  const markerCols: Column<Marker>[] = [
    { key: 'code', header: 'Số hiệu mốc', render: (m) => <span style={{ fontWeight: 600 }}>{m.code}</span>, mono: true },
    { key: 'coord', header: 'Tọa độ', render: (m) => (m.location ? `${m.location.coordinates[1].toFixed(5)}, ${m.location.coordinates[0].toFixed(5)}` : '—'), mono: true },
    { key: 'note', header: 'Ghi chú', render: (m) => m.note ?? '—' },
    { key: 'created', header: 'Ngày tạo', render: (m) => dateTime(m.createdAt), mono: true },
    { key: 'act', header: '', align: 'right', render: (m) => canEditMarkers ? (
      <button className="btn btn-sm btn-ghost" onClick={() => delMarker.mutate(m.id)} title="Xóa mốc"><Icon name="logout" size={14} /></button>
    ) : null },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/land-parcels')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách khu đất
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${d.areaName ?? ''}`}
        title={d.name}
        description={`Đơn vị quản lý: ${d.orgName ?? '—'} · Cập nhật: ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={status} />
            {canSubmit && <button className="btn" onClick={() => nav(`/land-parcels/${id}/edit`)}><Icon name="edit" size={16} /> Sửa hồ sơ</button>}
            {canSubmit && <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('submit')}><Icon name="upload" size={16} /> Gửi duyệt</button>}
            {canReview && (
              <>
                <button className="btn" disabled={act.isPending} onClick={() => act.mutate('request-changes')}><Icon name="alert" size={16} /> Yêu cầu bổ sung</button>
                <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('approve')}><Icon name="check" size={16} /> Phê duyệt</button>
              </>
            )}
          </div>
        }
      />

      {d.disputeStatus !== 'NONE' && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, border: `1px solid ${dc.bd}`, background: dc.bg, color: dc.fg, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
          <Icon name="alert" size={18} /> {DISPUTE_LABEL[d.disputeStatus]}{d.disputeNote ? ` — ${d.disputeNote}` : ''}
        </div>
      )}
      {actionError && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger-bd)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={16} /> {actionError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, whiteSpace: 'nowrap', fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Tổng quan & pháp lý' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }} className="field-grid">
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin đất đai</div>
            <Field label="Địa chỉ" value={d.address ?? '—'} />
            <Field label="Tổng diện tích" value={`${num(d.landArea)} m²`} mono />
            <Field label="Loại đất" value={LANDUSE_LABEL[d.landUseType ?? ''] ?? '—'} />
            <Field label="Hiện trạng sử dụng" value={USAGE_LABEL[d.usageStatus] ?? d.usageStatus} />
            <Field label="Đường tiếp cận" value={d.accessRoad ?? '—'} />
            <Field label="Hạ tầng" value={`${d.hasElectricity ? 'Có điện' : 'Không điện'} · ${d.hasWater ? 'Có nước' : 'Không nước'}`} />
            <Field label="Khả năng mở rộng" value={EXPANSION_LABEL[d.expansionCapability ?? ''] ?? '—'} />
            <Field label="Tình trạng an toàn" value={SAFETY_LABEL[d.safetyStatus ?? ''] ?? '—'} />
            <Field label="Doanh trại gắn kết" value={d.barracksName ?? '—'} />
            <Field label="Tọa độ" value={d.location ? `${d.location.coordinates[1].toFixed(5)}, ${d.location.coordinates[0].toFixed(5)}` : 'Chưa gắn'} mono />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Hồ sơ pháp lý & tình trạng</div>
            <Field label="Hồ sơ pháp lý" value={LEGAL_LABEL[d.legalStatus] ?? d.legalStatus} />
            <Field label="Số GCN/Quyết định" value={d.certificateNo ?? '—'} mono />
            <Field label="Nguồn gốc" value={d.legalOrigin ?? '—'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
              <span className="muted" style={{ fontSize: 13 }}>Tranh chấp/lấn chiếm</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: dc.fg }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dc.fg }} />{DISPUTE_LABEL[d.disputeStatus]}
              </span>
            </div>
            <Field label="Số mốc giới" value={String(d.markerCount)} mono />
            {d.notes && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>{d.notes}</p>}
          </div>
        </div>
      )}

      {tab === 'Mốc giới' && (
        <>
          {canEditMarkers && (
            <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Số hiệu mốc *</span>
                <input className="input num" style={{ width: 140 }} value={newMarker.code} onChange={(e) => setNewMarker((s) => ({ ...s, code: e.target.value }))} placeholder="VD: M-01" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Ghi chú</span>
                <input className="input" value={newMarker.note} onChange={(e) => setNewMarker((s) => ({ ...s, note: e.target.value }))} placeholder="Vị trí/đặc điểm mốc" />
              </label>
              <button className="btn btn-primary" disabled={newMarker.code.trim().length < 1 || addMarker.isPending} onClick={() => addMarker.mutate()}>
                <Icon name="plus" size={16} /> Thêm mốc
              </button>
            </div>
          )}
          <DataTable columns={markerCols} rows={markers.data} loading={markers.isLoading} rowKey={(m) => m.id} emptyTitle="Chưa có mốc giới" emptyHint="Thêm các mốc giới của khu đất để quản lý ranh giới." />
        </>
      )}

      {tab === 'Bản đồ ranh giới' && (
        <div className="panel" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Ranh giới, mốc giới & vị trí khu đất</div>
          <div style={{ height: '60vh', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-neutral-300)' }}>
            <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              {polygons.map((poly, i) => (
                <Polygon key={i} positions={poly} pathOptions={{ color: dc.fg, fillColor: dc.fg, fillOpacity: 0.12, weight: 2 }} />
              ))}
              {d.location && (
                <CircleMarker center={center} radius={7} pathOptions={{ color: '#10609e', fillColor: '#10609e', fillOpacity: 1 }}>
                  <Tooltip permanent>{d.name}</Tooltip>
                </CircleMarker>
              )}
              {(markers.data ?? []).filter((m) => m.location).map((m) => (
                <CircleMarker key={m.id} center={[m.location!.coordinates[1], m.location!.coordinates[0]]} radius={5} pathOptions={{ color: '#b45309', fillColor: '#f59e0b', fillOpacity: 1 }}>
                  <Tooltip>Mốc {m.code}</Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {!d.location && polygons.length === 0 && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Khu đất chưa gắn tọa độ/ranh giới. Cập nhật ở mục khảo sát hiện trường hoặc nhập ranh giới GeoJSON.</p>
          )}
        </div>
      )}

      {tab === 'Hồ sơ pháp lý' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Quyết định giao đất, GCN, sơ đồ, biên bản</div>
            <button className="btn btn-sm btn-primary" onClick={() => setEvidence(true)}><Icon name="upload" size={14} /> Thêm/xem tài liệu</button>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>Tài liệu pháp lý lưu trên MinIO, gắn với khu đất. Bấm nút trên để tải lên và quản lý.</p>
        </div>
      )}

      {tab === 'Lịch sử phiên bản' && (
        <div className="panel" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Lịch sử phiên bản hồ sơ (bất biến)</div>
          {revs.isLoading ? (
            <Skeleton rows={4} />
          ) : (revs.data ?? []).length === 0 ? (
            <EmptyState icon="clock" title="Chưa có phiên bản" hint="Phiên bản được tạo khi gửi duyệt/phê duyệt hồ sơ." />
          ) : (
            <div>
              {(revs.data ?? []).map((r, i) => (
                <div key={r.revisionNo} style={{ display: 'flex', gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-accent-600)', marginTop: 4 }} />
                    {i < (revs.data ?? []).length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--color-neutral-300)' }} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="num" style={{ fontWeight: 700 }}>Phiên bản #{r.revisionNo}</span>
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

      {evidence && <EvidenceDrawer entityType="land_parcel" entityId={id!} title={`Hồ sơ pháp lý khu đất · ${d.code}`} onClose={() => setEvidence(false)} />}
    </>
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
