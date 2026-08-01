import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, dateTime } from '../lib/format';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import { ReadyChip } from './DeploymentSitesPage';
import { SITE_TYPE_LABEL, ROLE_LABEL, CONCEALMENT_LABEL, DEFENSE_STATE_LABEL } from '../lib/readiness';

interface Site {
  id: string; code: string; name: string; siteType: string; address: string | null; capacity: number;
  concealment: string | null; accessRoad: string | null; hasPower: boolean; hasWater: boolean;
  tentCapability: number; deployTimeHours: string; readiness: string; role: string; defenseState: string;
  notes: string | null; status: string; areaName: string | null; updatedAt: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
}

export function DeploymentSiteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [deact, setDeact] = useState(false);

  const s = useQuery({ queryKey: ['deployment-site', id], queryFn: async () => (await api.get<Site>(`/readiness/sites/${id}`)).data });
  const canManage = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  if (s.isLoading) return <Skeleton rows={6} />;
  if (s.isError || !s.data) return <ErrorState error={s.error} />;
  const d = s.data;
  const center: [number, number] | null = d.location ? [d.location.coordinates[1], d.location.coordinates[0]] : null;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/readiness/sites')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách địa điểm
      </button>
      <PageHeader
        eyebrow={`${d.code} · ${SITE_TYPE_LABEL[d.siteType] ?? d.siteType}`}
        title={d.name}
        description={`${d.areaName ?? ''} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ReadyChip readiness={d.readiness} />
            {d.status === 'INACTIVE' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)', padding: '4px 8px', borderRadius: 6 }}>Ngừng theo dõi</span>}
            {canManage && d.status === 'ACTIVE' && <button className="btn" onClick={() => nav(`/readiness/sites/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && d.status === 'ACTIVE' && <button className="btn" onClick={() => setDeact(true)}><Icon name="lock" size={16} /> Ngừng</button>}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="field-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Thông số địa điểm</div>
          <Field label="Loại" value={SITE_TYPE_LABEL[d.siteType] ?? d.siteType} />
          <Field label="Vai trò phương án" value={ROLE_LABEL[d.role] ?? d.role} />
          <Field label="Sức chứa" value={`${num(d.capacity)} người`} mono />
          <Field label="Số nhà bạt/dã chiến" value={num(d.tentCapability)} mono />
          <Field label="Thời gian triển khai" value={`${num(d.deployTimeHours)} giờ`} mono />
          <Field label="Khả năng che giấu" value={CONCEALMENT_LABEL[d.concealment ?? ''] ?? '—'} />
          <Field label="Hạ tầng" value={`${d.hasPower ? 'Có điện' : 'Không điện'} · ${d.hasWater ? 'Có nước' : 'Không nước'}`} />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Cơ động & trạng thái</div>
          <Field label="Địa bàn" value={d.areaName ?? '—'} />
          <Field label="Địa chỉ" value={d.address ?? '—'} />
          <Field label="Đường cơ động" value={d.accessRoad ?? '—'} />
          <Field label="Trạng thái sử dụng dự kiến" value={DEFENSE_STATE_LABEL[d.defenseState] ?? d.defenseState} />
          <Field label="Tọa độ" value={d.location ? `${d.location.coordinates[1].toFixed(5)}, ${d.location.coordinates[0].toFixed(5)}` : '—'} mono />
          {d.notes && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{d.notes}</p>}
        </div>
      </div>

      {center && (
        <div className="panel" style={{ padding: 14, marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Vị trí trên bản đồ</div>
          <div style={{ height: '46vh', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-neutral-300)' }}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <CircleMarker center={center} radius={8} pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.9 }}>
                <Tooltip permanent>{d.name}</Tooltip>
              </CircleMarker>
            </MapContainer>
          </div>
        </div>
      )}

      {deact && <DeactModal id={id!} onClose={() => setDeact(false)} onDone={() => { setDeact(false); qc.invalidateQueries({ queryKey: ['deployment-site', id] }); }} />}
    </>
  );
}

function DeactModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({ mutationFn: async () => api.post(`/readiness/sites/${id}/deactivate`, { reason }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Ngừng theo dõi địa điểm" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Không xóa cứng — giữ nguyên hồ sơ, chuyển sang ngừng theo dõi.</p>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Lý do</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>Xác nhận</button></div>
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span></div>);
}
