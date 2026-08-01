import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { QrScanner } from '../components/QrScanner';
import { toast } from '../lib/toast';
import { dateTime } from '../lib/format';
import {
  allItems,
  enqueue,
  flushQueue,
  removeItem,
  retryItem,
  resolveKeepMine,
  type QueueItem,
} from '../lib/offlineQueue';

interface BarracksRow {
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  workflowStatus: string;
}
interface BarracksDetail {
  id: string;
  code: string;
  name: string;
  address: string | null;
  function: string | null;
  declaredCapacity: number;
  landArea: number | string;
  rowVersion: number;
  workflowStatus: string;
}
interface Doc {
  id: string;
  name: string;
  createdAt: string;
  lat: string | null;
  lng: string | null;
  capturedAt: string | null;
}

// Lấy vị trí hiện tại (dùng cho ảnh hiện trường). Không đọc EXIF (trình duyệt có thể strip).
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Thiết bị không hỗ trợ định vị'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 });
  });
}

const ST_COLOR: Record<QueueItem['status'], string> = {
  pending: 'var(--info-fg)',
  conflict: 'var(--warn-fg)',
  failed: 'var(--danger-fg)',
};

// M25/M26 — Khảo sát hiện trường (tối ưu di động): sửa hồ sơ doanh trại có đồng bộ ngoại tuyến,
// chụp ảnh gắn tọa độ/thời gian, và hòa giải hàng đợi đồng bộ.
export function FieldSurveyPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', function: '', declaredCapacity: '', landArea: '' });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hàng đợi đồng bộ — nạp lại khi có thay đổi.
  useEffect(() => {
    const refresh = () => allItems().then(setQueue).catch(() => undefined);
    refresh();
    window.addEventListener('offline-queue-changed', refresh);
    return () => window.removeEventListener('offline-queue-changed', refresh);
  }, []);

  const list = useQuery({
    queryKey: ['field-barracks', search],
    queryFn: async () =>
      (await api.get('/barracks', { params: { page: 1, size: 50, search: search || undefined } })).data as { data: BarracksRow[] },
  });

  const detail = useQuery({
    queryKey: ['field-barracks-detail', selectedId],
    queryFn: async () => (await api.get(`/barracks/${selectedId}`)).data as BarracksDetail,
    enabled: !!selectedId,
  });

  const docs = useQuery({
    queryKey: ['field-docs', selectedId],
    queryFn: async () =>
      (await api.get('/documents', { params: { entityType: 'barracks', entityId: selectedId, size: 100 } })).data as { data: Doc[] },
    enabled: !!selectedId,
  });

  // Nạp form khi chọn/đổi bản ghi.
  useEffect(() => {
    if (detail.data) {
      setForm({
        name: detail.data.name ?? '',
        address: detail.data.address ?? '',
        function: detail.data.function ?? '',
        declaredCapacity: detail.data.declaredCapacity != null ? String(detail.data.declaredCapacity) : '',
        landArea: detail.data.landArea != null ? String(detail.data.landArea) : '',
      });
    }
  }, [detail.data]);

  async function onSave() {
    if (!detail.data) return;
    await enqueue({
      entityType: 'barracks',
      targetId: detail.data.id,
      baseVersion: detail.data.rowVersion,
      label: form.name || detail.data.code,
      payload: {
        name: form.name.trim(),
        address: form.address.trim(),
        function: form.function.trim(),
        declaredCapacity: Number(form.declaredCapacity) || 0,
        landArea: Number(form.landArea) || 0,
      },
    });
    const r = await flushQueue();
    if (r.skipped) toast.info('Đã lưu tạm trên máy. Sẽ tự đồng bộ khi có mạng.');
    else if (r.conflict) toast.warn('Xung đột phiên bản — mở mục “Hàng đợi đồng bộ” để hòa giải.');
    else if (r.failed) toast.error('Đồng bộ thất bại — xem mục “Hàng đợi đồng bộ”.');
    else toast.success('Đã cập nhật và đồng bộ hồ sơ.');
    qc.invalidateQueries({ queryKey: ['field-barracks-detail', selectedId] });
  }

  const photoMut = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedId) throw new Error('Chưa chọn doanh trại');
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        toast.warn('Không lấy được tọa độ — ảnh vẫn được lưu, thiếu vị trí.');
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'barracks');
      fd.append('entityId', selectedId);
      fd.append('classification', 'field-photo');
      fd.append('capturedAt', new Date().toISOString());
      if (lat != null && lng != null) {
        fd.append('lat', String(lat));
        fd.append('lng', String(lng));
      }
      return api.post('/files', fd);
    },
    onSuccess: () => {
      toast.success('Đã tải ảnh hiện trường.');
      qc.invalidateQueries({ queryKey: ['field-docs', selectedId] });
    },
    onError: (e) => toast.problem(e, 'Không tải được ảnh'),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const activeQueue = useMemo(() => queue.filter((q) => q.status !== 'pending' || true), [queue]);

  return (
    <>
      <PageHeader
        eyebrow="Hiện trường"
        title="Khảo sát & cập nhật hồ sơ"
        description="Dành cho tổ khảo sát / cán bộ xã: cập nhật hồ sơ doanh trại (có đồng bộ ngoại tuyến), chụp ảnh gắn tọa độ và thời gian."
        actions={
          <button className="btn" onClick={() => setScanning(true)}>
            <Icon name="search" size={16} /> Quét QR
          </button>
        }
      />

      {/* Hàng đợi đồng bộ (M26) */}
      {activeQueue.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderLeft: '3px solid var(--warn-fg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Hàng đợi đồng bộ ({activeQueue.length})</strong>
            <button className="btn btn-sm btn-primary" onClick={() => flushQueue()}>
              <Icon name="refresh" size={14} /> Đồng bộ tất cả
            </button>
          </div>
          {activeQueue.map((it) => (
            <div key={it.localId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-neutral-200)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ST_COLOR[it.status], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {it.status === 'pending' && 'Chờ đồng bộ'}
                  {it.status === 'conflict' && `Xung đột (bản máy chủ mới hơn v${it.serverVersion})`}
                  {it.status === 'failed' && `Lỗi: ${it.message ?? ''}`}
                </div>
              </div>
              {it.status === 'conflict' && (
                <button className="btn btn-sm" onClick={() => resolveKeepMine(it.localId).then(() => flushQueue())} title="Ghi đè bằng bản của tôi">
                  Giữ bản của tôi
                </button>
              )}
              {it.status === 'failed' && (
                <button className="btn btn-sm" onClick={() => retryItem(it.localId).then(() => flushQueue())}>Thử lại</button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => removeItem(it.localId)} title="Bỏ thay đổi này">
                <Icon name="logout" size={13} /> Bỏ
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16, alignItems: 'start' }} className="field-grid">
        {/* Danh sách doanh trại */}
        <div className="card" style={{ padding: 12 }}>
          <input className="input" placeholder="Tìm doanh trại…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
          {list.isLoading ? (
            <Skeleton rows={6} />
          ) : (list.data?.data ?? []).length === 0 ? (
            <div className="muted" style={{ padding: 12, fontSize: 13 }}>Không có doanh trại.</div>
          ) : (
            <div className="scrl" style={{ maxHeight: 460, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(list.data?.data ?? []).map((b) => (
                <button
                  key={b.id}
                  className="rowh"
                  onClick={() => setSelectedId(b.id)}
                  style={{ all: 'unset', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: selectedId === b.id ? 'var(--color-neutral-100)' : 'transparent' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                  <div className="muted num" style={{ fontSize: 11 }}>{b.code} · {b.areaName ?? '—'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chi tiết + biên tập + ảnh */}
        <div style={{ minWidth: 0 }}>
          {!selectedId ? (
            <EmptyState icon="building" title="Chọn một doanh trại" hint="Chọn từ danh sách bên trái để khảo sát và cập nhật." />
          ) : detail.isLoading ? (
            <div className="panel" style={{ padding: 16 }}><Skeleton rows={5} /></div>
          ) : detail.data ? (
            <>
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Thông tin doanh trại · {detail.data.code}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="field-form">
                  <Field label="Tên doanh trại"><input className="input" value={form.name} onChange={set('name')} /></Field>
                  <Field label="Công năng"><input className="input" value={form.function} onChange={set('function')} placeholder="VD: Đơn vị bộ binh" /></Field>
                  <Field label="Địa chỉ/khu vực"><input className="input" value={form.address} onChange={set('address')} /></Field>
                  <Field label="Diện tích đất (m²)"><input className="input num" type="number" min={0} value={form.landArea} onChange={set('landArea')} /></Field>
                  <Field label="Sức chứa (người)"><input className="input num" type="number" min={0} value={form.declaredCapacity} onChange={set('declaredCapacity')} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={onSave}>
                    <Icon name="check" size={16} /> Lưu (đồng bộ ngoại tuyến)
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  Thay đổi được lưu vào máy và tự đẩy lên khi có mạng. Bản đã duyệt (APPROVED) sẽ báo lỗi trạng thái khi đồng bộ.
                </div>
              </div>

              {/* Ảnh hiện trường (M25) */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 14 }}>Ảnh hiện trường</strong>
                  <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={photoMut.isPending}>
                    <Icon name="upload" size={14} /> {photoMut.isPending ? 'Đang tải…' : 'Chụp / chọn ảnh'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) photoMut.mutate(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                {docs.isLoading ? (
                  <Skeleton rows={2} />
                ) : (docs.data?.data ?? []).length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>Chưa có ảnh. Ảnh chụp sẽ được gắn tọa độ và thời gian.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {(docs.data?.data ?? []).map((d) => (
                      <div key={d.id} className="panel" style={{ padding: 8, fontSize: 11.5 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div className="muted num">{d.capturedAt ? dateTime(d.capturedAt) : dateTime(d.createdAt)}</div>
                        <div className="muted num">
                          {d.lat && d.lng ? `📍 ${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}` : 'Không có tọa độ'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {scanning && (
        <QrScanner
          title="Quét QR doanh trại/kho"
          onClose={() => setScanning(false)}
          onResult={(text) => {
            setScanning(false);
            const idx = text.indexOf('/scan/');
            if (idx >= 0) {
              const [, code] = text.slice(idx + 6).split('/');
              if (code) {
                setSearch(decodeURIComponent(code));
                toast.info('Đã lọc theo mã quét. Chọn doanh trại từ danh sách.');
                return;
              }
            }
            toast.error('Mã QR không hợp lệ.');
          }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>
      {children}
    </label>
  );
}
