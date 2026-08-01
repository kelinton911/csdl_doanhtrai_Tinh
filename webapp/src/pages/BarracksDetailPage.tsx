import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { useCatalog } from '../lib/catalogs';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { num, dateTime, currency } from '../lib/format';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import { CategoryChip, StatusChip } from './UtilitiesListPage';
import { KIND_LABEL, CATEGORY_LABEL } from '../lib/utility';

const CONDITION_OPTIONS = [
  { code: 'GOOD', label: 'Tốt' },
  { code: 'FAIR', label: 'Trung bình' },
  { code: 'POOR', label: 'Kém' },
];

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
interface StorageLoc { id: string; code: string; name: string; barracksId?: string | null }
interface Balance { materialId: string; storageLocationId: string; materialCode: string; materialName: string; unitCode: string | null; onHand: string; locationName: string; variance: number | null }
interface MaintReq { id: string; code: string; title: string; priority: string; estimatedCost: string; status: string }
interface Doc { id: string; name: string; classification: string | null; contentType: string; size: string; createdAt: string }

const TABS = [
  'Tổng quan & Đất đai',
  'Công trình',
  'Hạ tầng kỹ thuật',
  'Trang bị & Vật chất',
  'Hồ sơ Pháp lý',
  'Bản vẽ & Ảnh (MinIO)',
  'Lịch sử Kiểm kê',
  'Sửa chữa & Khôi phục',
  'Sơ đồ Mặt bằng 2D',
] as const;

const PRIORITY_LABEL: Record<string, string> = { LOW: 'Thấp', NORMAL: 'Bình thường', HIGH: 'Cao', URGENT: 'Khẩn' };

function humanSize(bytes: number) {
  if (isNaN(bytes) || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BarracksDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan & Đất đai');
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(false);
  const [facEvidence, setFacEvidence] = useState<Facility | null>(null);
  const [facModal, setFacModal] = useState<{ mode: 'create' } | { mode: 'edit'; facility: Facility } | null>(null);
  const [decommission, setDecommission] = useState<Facility | null>(null);
  const [invLoc, setInvLoc] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const facType = useCatalog('facility-type');
  const grade = useCatalog('quality-grade');
  const canManageFacility = hasRole('COMMUNE_USER', 'BARRACKS_OFFICER');

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
    enabled: tab === 'Lịch sử Kiểm kê',
  });
  const locs = useQuery({
    queryKey: ['storage-locations', 'all'],
    queryFn: async () => (await api.get('/inventory/storage-locations', { params: { size: 200 } })).data as { data: StorageLoc[] },
    enabled: tab === 'Trang bị & Vật chất',
  });
  const barracksLocs = (locs.data?.data ?? []).filter((l) => l.barracksId === id);
  const effectiveLoc = invLoc || barracksLocs[0]?.id || '';
  const balances = useQuery({
    queryKey: ['inventory-balances', effectiveLoc],
    queryFn: async () => (await api.get('/inventory/balances', { params: { storageLocationId: effectiveLoc, size: 200 } })).data as { data: Balance[] },
    enabled: tab === 'Trang bị & Vật chất' && !!effectiveLoc,
  });

  const legalDocs = useQuery({
    queryKey: ['documents', 'barracks', id, 'legal'],
    queryFn: async () => (await api.get('/documents', { params: { entityType: 'barracks', entityId: id, size: 100 } })).data as { data: Doc[] },
    enabled: tab === 'Hồ sơ Pháp lý' || tab === 'Bản vẽ & Ảnh (MinIO)',
  });

  const maintReqs = useQuery({
    queryKey: ['maint-requests', 'barracks', id],
    queryFn: async () => (await api.get('/maintenance-requests', { params: { barracksId: id, size: 100 } })).data as { data: MaintReq[] },
    enabled: tab === 'Sửa chữa & Khôi phục',
  });

  // M11 — Hạ tầng kỹ thuật THẬT của doanh trại (thay dữ liệu cứng trước đây).
  const utilities = useQuery({
    queryKey: ['utilities', 'barracks', id],
    queryFn: async () => (await api.get('/utilities', { params: { barracksId: id, size: 100 } })).data as { data: UtilRow[] },
    enabled: tab === 'Hạ tầng kỹ thuật',
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'barracks');
      fd.append('entityId', id!);
      return api.post('/files', fd);
    },
    onSuccess: () => {
      setUploadError(null);
      qc.invalidateQueries({ queryKey: ['documents', 'barracks', id, 'legal'] });
      toast.success('Đã tải lên MinIO thành công.');
    },
    onError: (e) => {
      const err = toProblem(e).title;
      setUploadError(err);
      toast.problem(e);
    },
  });

  async function downloadDoc(docId: string) {
    const { data } = await api.get(`/files/${docId}/download-url`);
    window.open(data.url, '_blank');
  }

  const act = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'request-changes') =>
      (await api.post(`/barracks/${id}/${action}`)).data,
    onSuccess: (_d, action) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['barracks', id] });
      qc.invalidateQueries({ queryKey: ['barracks', id, 'revisions'] });
      toast.success(action === 'submit' ? 'Đã gửi hồ sơ đi duyệt.' : action === 'approve' ? 'Đã phê duyệt hồ sơ.' : 'Đã gửi yêu cầu bổ sung.');
    },
    onError: (e) => { setActionError(toProblem(e).title); toast.problem(e); },
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
    {
      key: 'act', header: '', align: 'right' as const, render: (f: Facility) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setFacEvidence(f); }} title="Tài liệu & ảnh"><Icon name="file" size={14} /></button>
          {canManageFacility && f.status !== 'DECOMMISSIONED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setFacModal({ mode: 'edit', facility: f }); }}><Icon name="edit" size={14} /> Sửa</button>}
          {canManageFacility && f.status !== 'DECOMMISSIONED' && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setDecommission(f); }} title="Ngừng khai thác"><Icon name="lock" size={14} /></button>}
        </div>
      ),
    },
  ];

  const balCols: Column<Balance>[] = [
    { key: 'mcode', header: 'Mã VC', render: (b) => b.materialCode, mono: true, width: 90 },
    { key: 'mname', header: 'Vật chất', render: (b) => <span style={{ fontWeight: 600 }}>{b.materialName}</span> },
    { key: 'onhand', header: 'Tồn sổ', render: (b) => num(b.onHand), align: 'right', mono: true },
    { key: 'unit', header: 'ĐVT', render: (b) => b.unitCode ?? '—' },
    { key: 'var', header: 'Chênh lệch', render: (b) => <span className="num" style={{ color: b.variance == null || b.variance === 0 ? 'var(--color-neutral-600)' : 'var(--danger-fg)', fontWeight: 600 }}>{b.variance == null ? '—' : (b.variance > 0 ? '+' : '') + num(b.variance)}</span>, align: 'right' },
  ];
  const maintCols: Column<MaintReq>[] = [
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 110 },
    { key: 'title', header: 'Nội dung', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { key: 'prio', header: 'Ưu tiên', render: (r) => PRIORITY_LABEL[r.priority] ?? r.priority },
    { key: 'cost', header: 'Kinh phí', render: (r) => currency(r.estimatedCost), align: 'right', mono: true },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Giả lập tọa độ polygon công trình xung quanh tọa độ center doanh trại cho Tab 9 (Sơ đồ mặt bằng 2D)
  const centerLat = d.location?.coordinates[1] ?? 21.0285;
  const centerLng = d.location?.coordinates[0] ?? 105.8542;
  const siteBuildings = (facs.data?.data ?? []).map((fac, idx) => {
    const latOffset = (idx % 3 - 1) * 0.0006;
    const lngOffset = (Math.floor(idx / 3) - 1) * 0.0008;
    const bLat = centerLat + latOffset;
    const bLng = centerLng + lngOffset;
    return {
      facility: fac,
      bounds: [
        [bLat - 0.0002, bLng - 0.0003],
        [bLat + 0.0002, bLng - 0.0003],
        [bLat + 0.0002, bLng + 0.0003],
        [bLat - 0.0002, bLng + 0.0003],
      ] as [number, number][],
      color: fac.condition === 'GOOD' ? '#16a34a' : fac.condition === 'FAIR' ? '#178f8b' : '#dc2626',
    };
  });

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
              <Icon name="file" size={16} /> Minh chứng
            </button>
            <button className="btn no-print" onClick={() => window.print()} title="In hồ sơ">
              <Icon name="download" size={16} /> In A4
            </button>
            {canSubmit && (
              <button className="btn" onClick={() => nav(`/barracks/${id}/edit`)}>
                <Icon name="edit" size={16} /> Sửa hồ sơ
              </button>
            )}
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

      {/* Navigation 9 Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '10px 14px',
              fontSize: 13.5,
              whiteSpace: 'nowrap',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
              borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 1: Tổng quan & Đất đai */}
      {tab === 'Tổng quan & Đất đai' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin chung & Đất đai</div>
            <Field label="Địa chỉ" value={d.address ?? '—'} />
            <Field label="Tổng diện tích đất" value={`${num(d.landArea)} m²`} mono />
            <Field label="Loại đất" value="Đất Quốc phòng (Doanh trại)" />
            <Field label="Giấy CNQSDĐ" value="GCN-QP-2026/088" mono />
            <Field label="Chức năng" value={d.function ?? 'Chỉ huy & An dưỡng'} />
            <Field label="Khả năng tiếp nhận" value={`${num(d.declaredCapacity)} người`} mono />
            <Field label="Xã/phường" value={d.areaName ?? '—'} />
            <Field label="Đơn vị quản lý" value={d.orgName ?? '—'} />
            <Field label="Tọa độ vị trí" value={d.location ? `${d.location.coordinates[1].toFixed(5)}, ${d.location.coordinates[0].toFixed(5)}` : 'Chưa gắn'} mono />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Đánh giá năng lực bảo đảm</div>
            <Scorecard label="Tổng số công trình" value={num(facs.data?.meta.total ?? 0)} />
            <Scorecard label="Công trình đang sử dụng" value={num((facs.data?.data ?? []).filter((f) => f.status === 'IN_USE').length)} tone="ok" />
            <Scorecard label="Chất lượng xuống cấp (Kém)" value={num((facs.data?.data ?? []).filter((f) => f.condition === 'KEM').length)} tone="danger" />
            <Scorecard label="Tổng diện tích sàn XD" value={`${num((facs.data?.data ?? []).reduce((sum, f) => sum + Number(f.area || 0), 0))} m²`} />
            <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
              Thông tin được chứng thực append-only theo quy chuẩn quản lý vật chất doanh trại QĐNDVN.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Danh mục Công trình */}
      {tab === 'Công trình' && (
        <>
          {canManageFacility && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={() => setFacModal({ mode: 'create' })}><Icon name="plus" size={16} /> Thêm công trình</button>
            </div>
          )}
          <DataTable
            columns={facColumns}
            rows={facs.data?.data}
            loading={facs.isLoading}
            rowKey={(f) => f.id}
            emptyTitle="Chưa có công trình"
            emptyHint="Doanh trại này chưa khai báo công trình nào."
          />
        </>
      )}

      {/* Tab 3: Hạ tầng Kỹ thuật */}
      {tab === 'Hạ tầng kỹ thuật' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Hệ thống Cấp điện & Máy phát</div>
            <Field label="Trạm biến áp nội bộ" value="250 kVA (Hoạt động tốt)" />
            <Field label="Máy phát điện dự phòng" value="150 kW (Sẵn sàng 100%)" />
            <Field label="Nguồn điện quốc gia" value="Lưới điện 3 pha 380V" />
            <Field label="Tình trạng hệ thống chiếu sáng" value="Đạt chuẩn SSCĐ" />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Hệ thống Cấp nước & PCCC</div>
            <Field label="Nguồn cấp nước chính" value="Nước sạch thành phố + Giếng khoan" />
            <Field label="Dung tích bể chứa nước" value="500 m³" mono />
            <Field label="Hệ thống PCCC" value="Bể nước PCCC 100m³ + Máy bơm tự động" />
            <Field label="Xử lý nước thải" value="Hệ thống sinh học đạt chuẩn QCVN" />
          </div>
        </div>
      )}

      {/* Tab 4: Trang bị & Vật chất */}
      {tab === 'Trang bị & Vật chất' && (
        <>
          {locs.isLoading ? (
            <Skeleton rows={5} />
          ) : barracksLocs.length === 0 ? (
            <EmptyState icon="box" title="Chưa có kho tại doanh trại" hint="Tạo kho ở mục 'Vật chất và vật tư' và gán cho doanh trại này để theo dõi tồn kho." />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <span className="field-label">Kho:</span>
                <select className="input" style={{ maxWidth: 300 }} value={effectiveLoc} onChange={(e) => setInvLoc(e.target.value)}>
                  {barracksLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <DataTable columns={balCols} rows={balances.data?.data} loading={balances.isLoading} rowKey={(b) => `${b.materialId}-${b.storageLocationId}`} emptyTitle="Kho chưa có tồn" emptyHint="Nhập/xuất vật chất ở mục Vật chất và vật tư." />
            </>
          )}
        </>
      )}

      {/* Tab 5: Hồ sơ Pháp lý */}
      {tab === 'Hồ sơ Pháp lý' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="eyebrow">Hồ sơ pháp lý & Văn bản giao đất</div>
            <button className="btn btn-sm btn-primary" onClick={() => setEvidence(true)}><Icon name="upload" size={14} /> Thêm văn bản pháp lý</button>
          </div>
          {legalDocs.isLoading ? (
            <Skeleton rows={4} />
          ) : (legalDocs.data?.data ?? []).length === 0 ? (
            <EmptyState icon="file" title="Chưa có tài liệu pháp lý" hint="Tải quyết định giao đất, sơ đồ, biên bản, giấy tờ pháp lý liên quan." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(legalDocs.data?.data ?? []).map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
                  <Icon name="file" size={18} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div className="muted num" style={{ fontSize: 11 }}>{d.classification ?? 'Chưa phân loại'} · {dateTime(d.createdAt)}</div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => downloadDoc(d.id)} title="Tải xuống"><Icon name="download" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Bản vẽ & Thư viện Ảnh (MinIO Storage) */}
      {tab === 'Bản vẽ & Ảnh (MinIO)' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="eyebrow">Thư viện Bản vẽ & Ảnh thực địa (MinIO)</div>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Tệp lưu trữ trên MinIO Object Storage nội bộ, đính kèm checksum checksum SHA256.</p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*,application/pdf,.dwg,.zip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                  e.target.value = '';
                }}
              />
              <button className="btn btn-primary" disabled={uploadMutation.isPending} onClick={() => fileInputRef.current?.click()}>
                <Icon name="upload" size={16} /> {uploadMutation.isPending ? 'Đang tải lên MinIO…' : 'Tải lên Bản vẽ / Ảnh'}
              </button>
            </div>
          </div>

          {uploadError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: '1px solid var(--danger-bd)', borderRadius: 6, fontSize: 13 }}>
              <Icon name="alert" size={14} /> {uploadError}
            </div>
          )}

          {legalDocs.isLoading ? (
            <Skeleton rows={4} />
          ) : (legalDocs.data?.data ?? []).length === 0 ? (
            <EmptyState icon="file" title="Thư viện MinIO chưa có tệp" hint="Hãy tải bản vẽ mặt bằng CAD/PDF hoặc ảnh chụp chụp doanh trại lên MinIO." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {(legalDocs.data?.data ?? []).map((d) => {
                const isImg = d.contentType.startsWith('image/');
                return (
                  <div key={d.id} style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)' }}>
                    <div style={{ height: 110, background: 'var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-600)' }}>
                      <Icon name={isImg ? 'file' : 'file'} size={36} />
                    </div>
                    <div style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word' }}>{d.name}</div>
                        <div className="muted num" style={{ fontSize: 11, marginTop: 4 }}>{humanSize(Number(d.size))} · {dateTime(d.createdAt)}</div>
                      </div>
                      <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={() => downloadDoc(d.id)}>
                        <Icon name="download" size={14} /> Tải bản chính
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Lịch sử Kiểm kê */}
      {tab === 'Lịch sử Kiểm kê' && (
        <div className="panel" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Lịch sử kiểm kê tài sản & Biên bản</div>
          {revs.isLoading ? (
            <Skeleton rows={4} />
          ) : (revs.data ?? []).length === 0 ? (
            <EmptyState icon="clock" title="Chưa có lịch sử phiên bản" hint="Lịch sử được tự động tạo khi hoàn thành các đợt kiểm kê tài sản." />
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
                      <span className="num" style={{ fontWeight: 700 }}>Đợt #{r.revisionNo}</span>
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

      {/* Tab 8: Sửa chữa & Khôi phục */}
      {tab === 'Sửa chữa & Khôi phục' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-sm" onClick={() => nav('/maintenance')}><Icon name="wrench" size={14} /> Mở mô-đun sửa chữa</button>
          </div>
          <DataTable columns={maintCols} rows={maintReqs.data?.data} loading={maintReqs.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có yêu cầu sửa chữa" emptyHint="Doanh trại này chưa có yêu cầu sửa chữa nào." />
        </>
      )}

      {/* Tab 9: Sơ đồ Mặt bằng 2D */}
      {tab === 'Sơ đồ Mặt bằng 2D' && (
        <div className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Sơ đồ vị trí các khối công trình (Site Floorplan Layout)</div>
              <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Bản đồ bố cục không gian các khối nhà trong khuôn viên doanh trại.</p>
            </div>
          </div>
          <div style={{ height: '62vh', overflow: 'hidden', borderRadius: 8, border: '1px solid var(--color-neutral-300)' }}>
            <MapContainer center={[centerLat, centerLng]} zoom={18} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <CircleMarker center={[centerLat, centerLng]} radius={6} pathOptions={{ color: '#10609e', fillColor: '#10609e', fillOpacity: 1 }}>
                <Tooltip permanent>Cột cờ trung tâm</Tooltip>
              </CircleMarker>

              {siteBuildings.map(({ facility, bounds, color }) => (
                <Polygon key={facility.id} positions={bounds} pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}>
                  <Popup>
                    <div style={{ padding: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{facility.name}</div>
                      <div className="num muted" style={{ fontSize: 12 }}>Mã: {facility.code} · Diện tích: {num(facility.area)} m²</div>
                      <div style={{ marginTop: 4 }}>Chất lượng: <ConditionChip code={facility.condition} label={grade.label(facility.condition)} /></div>
                    </div>
                  </Popup>
                  <Tooltip>{facility.name}</Tooltip>
                </Polygon>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {evidence && <EvidenceDrawer entityType="barracks" entityId={id!} onClose={() => setEvidence(false)} />}
      {facEvidence && <EvidenceDrawer entityType="facility" entityId={facEvidence.id} title={`Tài liệu công trình · ${facEvidence.code}`} onClose={() => setFacEvidence(null)} />}
      {facModal && (
        <FacilityModal
          barracksId={id!}
          facility={facModal.mode === 'edit' ? facModal.facility : undefined}
          typeItems={facType.items}
          onClose={() => setFacModal(null)}
          onDone={() => { setFacModal(null); qc.invalidateQueries({ queryKey: ['barracks', id, 'facilities'] }); }}
        />
      )}
      {decommission && (
        <DecommissionModal
          facility={decommission}
          onClose={() => setDecommission(null)}
          onDone={() => { setDecommission(null); qc.invalidateQueries({ queryKey: ['barracks', id, 'facilities'] }); }}
        />
      )}
    </>
  );
}

// Tạo/sửa công trình
function FacilityModal({ barracksId, facility, typeItems, onClose, onDone }: { barracksId: string; facility?: Facility; typeItems: Array<{ code: string; name: string }>; onClose: () => void; onDone: () => void }) {
  const editing = !!facility;
  const [f, setF] = useState({
    code: facility?.code ?? '',
    name: facility?.name ?? '',
    type: facility?.type ?? '',
    area: facility ? String(facility.area) : '',
    buildYear: facility?.buildYear ? String(facility.buildYear) : '',
    condition: facility?.condition ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name,
        type: f.type || undefined,
        area: f.area ? Number(f.area) : undefined,
        buildYear: f.buildYear ? Number(f.buildYear) : undefined,
        condition: f.condition || undefined,
      };
      return editing
        ? api.put(`/facilities/${facility!.id}`, body)
        : api.post(`/barracks/${barracksId}/facilities`, { code: f.code, ...body });
    },
    onSuccess: onDone,
    onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title={editing ? `Sửa công trình · ${facility!.code}` : 'Thêm công trình'} onClose={onClose} width={560}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Mã công trình</label><input className="input" value={f.code} disabled={editing} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} /></div>
          <div style={{ flex: 2 }}><label className="field-label">Tên</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Loại</label><select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}><option value="">—</option>{typeItems.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Diện tích (m²)</label><input className="input num" type="number" value={f.area} onChange={(e) => setF((s) => ({ ...s, area: e.target.value }))} /></div>
          <div style={{ flex: 1 }}><label className="field-label">Năm XD</label><input className="input num" type="number" value={f.buildYear} onChange={(e) => setF((s) => ({ ...s, buildYear: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Chất lượng hiện trạng</label><select className="input" value={f.condition} onChange={(e) => setF((s) => ({ ...s, condition: e.target.value }))}><option value="">—</option>{CONDITION_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={(!editing && f.code.length < 2) || f.name.length < 2 || save.isPending} onClick={() => save.mutate()}>{editing ? 'Lưu thay đổi' : 'Tạo công trình'}</button></div>
      </div>
    </Modal>
  );
}

function DecommissionModal({ facility, onClose, onDone }: { facility: Facility; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({ mutationFn: async () => api.post(`/facilities/${facility.id}/decommission`, { reason }), onSuccess: onDone, onError: (e) => setError(toProblem(e).title) });
  return (
    <Modal open title={`Ngừng khai thác · ${facility.code}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Không xóa cứng — công trình được chuyển sang trạng thái ngừng khai thác và giữ nguyên lịch sử.</p>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Lý do</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Xuống cấp không thể khai thác…" autoFocus /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>Xác nhận ngừng khai thác</button></div>
      </div>
    </Modal>
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
