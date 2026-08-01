import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { Modal } from '../components/Modal';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, dateTime } from '../lib/format';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import { CatChip, RelChip, AgreementCell } from './LocalResourcesListPage';
import { RESOURCE_TYPE_LABEL, MOBILIZATION_LABEL, OWNER_LABEL, CATEGORY_LABEL } from '../lib/localResource';

interface Resource {
  id: string; code: string; name: string; category: string; resourceType: string;
  ownerName: string | null; ownerType: string | null; contactName: string | null; contactPhone: string | null;
  areaName: string | null; address: string | null; capacityDesc: string | null; capacityQty: string; capacityUnit: string | null;
  mobilizationTime: string; reliability: string; agreementNo: string | null; agreementValidUntil: string | null; agreementStatus: string;
  surveyedAt: string | null; surveyNote: string | null; status: string; notes: string | null; updatedAt: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
}

export function LocalResourceDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [evidence, setEvidence] = useState(false);
  const [deactOpen, setDeactOpen] = useState(false);

  const r = useQuery({ queryKey: ['local-resource', id], queryFn: async () => (await api.get<Resource>(`/local-resources/${id}`)).data });
  const canManage = can('COMMUNE_USER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND');

  if (r.isLoading) return <Skeleton rows={6} />;
  if (r.isError || !r.data) return <ErrorState error={r.error} />;
  const d = r.data;
  const center: [number, number] | null = d.location ? [d.location.coordinates[1], d.location.coordinates[0]] : null;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/local-resources')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách nguồn lực
      </button>
      <PageHeader
        eyebrow={`${CATEGORY_LABEL[d.category] ?? d.category} · ${d.code}`}
        title={d.name}
        description={`${RESOURCE_TYPE_LABEL[d.resourceType] ?? d.resourceType} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {d.status === 'INACTIVE' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)', padding: '4px 8px', borderRadius: 6 }}>Ngừng theo dõi</span>}
            <button className="btn" onClick={() => setEvidence(true)}><Icon name="file" size={16} /> Hồ sơ khảo sát/hiệp đồng</button>
            {canManage && d.status === 'ACTIVE' && <button className="btn" onClick={() => nav(`/local-resources/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && d.status === 'ACTIVE' && <button className="btn" onClick={() => setDeactOpen(true)}><Icon name="lock" size={16} /> Ngừng</button>}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="field-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Chủ thể & năng lực</div>
          <FieldRow label="Nhóm">{<CatChip category={d.category} />}</FieldRow>
          <Field label="Loại" value={RESOURCE_TYPE_LABEL[d.resourceType] ?? d.resourceType} />
          <Field label="Chủ thể quản lý" value={d.ownerName ?? '—'} />
          <Field label="Loại chủ thể" value={OWNER_LABEL[d.ownerType ?? ''] ?? '—'} />
          <Field label="Liên hệ" value={[d.contactName, d.contactPhone].filter(Boolean).join(' · ') || '—'} />
          <Field label="Khả năng cung ứng" value={`${num(d.capacityQty)} ${d.capacityUnit ?? ''}${d.capacityDesc ? ` — ${d.capacityDesc}` : ''}`} />
          <Field label="Thời gian huy động" value={MOBILIZATION_LABEL[d.mobilizationTime] ?? d.mobilizationTime} />
          <FieldRow label="Độ tin cậy">{<RelChip v={d.reliability} />}</FieldRow>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Địa bàn, hiệp đồng & khảo sát</div>
          <Field label="Địa bàn" value={d.areaName ?? '—'} />
          <Field label="Địa chỉ" value={d.address ?? '—'} />
          <Field label="Tọa độ" value={d.location ? `${d.location.coordinates[1].toFixed(5)}, ${d.location.coordinates[0].toFixed(5)}` : '—'} mono />
          <FieldRow label="Hiệp đồng">{<AgreementCell status={d.agreementStatus} validUntil={d.agreementValidUntil} />}</FieldRow>
          <Field label="Số biên bản" value={d.agreementNo ?? '—'} mono />
          <Field label="Ngày khảo sát" value={d.surveyedAt ? String(d.surveyedAt).slice(0, 10) : '—'} mono />
          {d.surveyNote && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{d.surveyNote}</p>}
        </div>
      </div>

      {center && (
        <div className="panel" style={{ padding: 14, marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Vị trí trên bản đồ</div>
          <div style={{ height: '46vh', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-neutral-300)' }}>
            <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <CircleMarker center={center} radius={8} pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.9 }}>
                <Tooltip permanent>{d.name}</Tooltip>
              </CircleMarker>
            </MapContainer>
          </div>
        </div>
      )}

      {evidence && <EvidenceDrawer entityType="local_resource" entityId={id!} title={`Hồ sơ khảo sát/hiệp đồng · ${d.code}`} onClose={() => setEvidence(false)} />}
      {deactOpen && <DeactivateModal id={id!} onClose={() => setDeactOpen(false)} onDone={() => { setDeactOpen(false); qc.invalidateQueries({ queryKey: ['local-resource', id] }); }} />}
    </>
  );
}

function DeactivateModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({ mutationFn: async () => api.post(`/local-resources/${id}/deactivate`, { reason }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title="Ngừng theo dõi nguồn lực" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Không xóa cứng — nguồn lực chuyển sang trạng thái ngừng theo dõi, giữ nguyên hồ sơ.</p>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Lý do</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Không còn khả năng huy động…" autoFocus /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>Xác nhận</button></div>
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
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12, alignItems: 'center' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
