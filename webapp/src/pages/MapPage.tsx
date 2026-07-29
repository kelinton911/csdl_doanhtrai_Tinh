import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, ErrorState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

interface Feature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] } | null;
  properties: Record<string, unknown>;
}
interface FC {
  type: 'FeatureCollection';
  features: Feature[];
}

const LAYERS = [
  { key: 'barracks', label: 'Doanh trại', color: '#10609e' },
  { key: 'facilities', label: 'Công trình', color: '#178f8b' },
];

// Bản đồ doanh trại split-view (Frontend §6.3). Dữ liệu không gian từ PostGIS (/gis/features).
// Bắt sự kiện click trên bản đồ để chọn tâm truy vấn bán kính.
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function MapPage() {
  const [layer, setLayer] = useState('barracks');
  const [center2, setCenter2] = useState<[number, number] | null>(null); // tâm truy vấn bán kính
  const [radiusKm, setRadiusKm] = useState('5');
  const [searchFC, setSearchFC] = useState<FC | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['gis', layer],
    queryFn: async () => (await api.get<FC>('/gis/features', { params: { layer } })).data,
  });

  const searchWithin = useMutation({
    mutationFn: async () => {
      const [lat, lng] = center2!;
      return (await api.post('/gis/search-within', { layer, lat, lng, radiusMeters: Number(radiusKm) * 1000 })).data as FC;
    },
    onSuccess: (fc) => { setSearchFC(fc); setSearchError(null); },
    onError: (e) => { setSearchError(toProblem(e).title); setSearchFC(null); },
  });
  const clearSearch = () => { setSearchFC(null); setCenter2(null); setSearchError(null); };

  const allPoints = useMemo(
    () => ((searchFC ?? q.data)?.features ?? []).filter((f) => f.geometry?.coordinates),
    [q.data, searchFC],
  );
  const points = allPoints;
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [15.9, 108.2];
    const [lng, lat] = points[0].geometry!.coordinates;
    return [lat, lng];
  }, [points]);
  const layerColor = LAYERS.find((l) => l.key === layer)?.color ?? '#10609e';

  return (
    <>
      <PageHeader
        eyebrow="Bản đồ doanh trại"
        title="Bản đồ số"
        description="Toạ độ là dữ liệu giả lập. Trên hạ tầng nội bộ, lớp nền chuyển sang tile server nội bộ."
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            {LAYERS.map((l) => (
              <button
                key={l.key}
                className="btn btn-sm"
                onClick={() => setLayer(l.key)}
                style={{ background: layer === l.key ? l.color : 'var(--surface-1)', color: layer === l.key ? '#fff' : 'var(--color-text)', borderColor: l.color }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: layer === l.key ? '#fff' : l.color, display: 'inline-block' }} />
                {l.label}
              </button>
            ))}
          </div>
        }
      />

      {q.isError && <ErrorState error={q.error} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, height: '72vh' }}>
        <div className="panel" style={{ overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
            <ClickCapture onPick={(lat, lng) => { setCenter2([lat, lng]); setSearchFC(null); }} />
            {center2 && (
              <>
                <Circle center={center2} radius={Number(radiusKm) * 1000} pathOptions={{ color: '#a8571f', fillColor: '#a8571f', fillOpacity: 0.08 }} />
                <CircleMarker center={center2} radius={5} pathOptions={{ color: '#a8571f', fillColor: '#a8571f', fillOpacity: 1 }}><Tooltip permanent>Tâm truy vấn</Tooltip></CircleMarker>
              </>
            )}
            {points.map((f) => {
              const [lng, lat] = f.geometry!.coordinates;
              return (
                <CircleMarker
                  key={String(f.properties.id)}
                  center={[lat, lng]}
                  radius={7}
                  pathOptions={{ color: layerColor, fillColor: layerColor, fillOpacity: 0.75, weight: 1.5 }}
                >
                  <Tooltip>{String(f.properties.name)}</Tooltip>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>{String(f.properties.name)}</div>
                      <div className="num" style={{ fontSize: 12, color: '#627d98' }}>{String(f.properties.code)}</div>
                      <div style={{ margin: '6px 0' }}>
                        <StatusBadge status={String(f.properties.status)} />
                      </div>
                      {layer === 'barracks' && (
                        <button className="btn btn-sm btn-primary" onClick={() => nav(`/barracks/${f.properties.id}`)}>
                          Mở hồ sơ
                        </button>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div className="panel scrl" style={{ overflow: 'auto', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="eyebrow">{searchFC ? `Lân cận (${points.length})` : `Kết quả (${points.length})`}</div>
          </div>

          {/* E5 — Truy vấn lân cận theo bán kính (POST /gis/search-within) */}
          <div style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="target" size={14} /> Tìm lân cận theo bán kính</div>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>Bấm lên bản đồ để chọn tâm, chọn bán kính rồi tìm.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="num muted" style={{ fontSize: 12 }}>{center2 ? `${center2[0].toFixed(4)}, ${center2[1].toFixed(4)}` : 'Chưa chọn tâm'}</span>
              <input className="input num" style={{ width: 90 }} type="number" min="0.1" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} /> <span className="muted" style={{ fontSize: 12 }}>km</span>
              <button className="btn btn-sm btn-primary" disabled={!center2 || searchWithin.isPending} onClick={() => searchWithin.mutate()}><Icon name="search" size={14} /> Tìm</button>
              {(searchFC || center2) && <button className="btn btn-sm" onClick={clearSearch}>Xóa</button>}
            </div>
            {searchError && <div style={{ color: 'var(--danger-fg)', fontSize: 12, marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={13} /> {searchError}</div>}
          </div>
          {q.isLoading ? (
            <Skeleton rows={8} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {points.map((f) => (
                <div
                  key={String(f.properties.id)}
                  className="rowh"
                  onClick={() => layer === 'barracks' && nav(`/barracks/${f.properties.id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', border: '1px solid var(--color-neutral-200)', borderRadius: 8, cursor: layer === 'barracks' ? 'pointer' : 'default' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{String(f.properties.name)}</div>
                    <div className="num muted" style={{ fontSize: 11.5 }}>{String(f.properties.code)}</div>
                  </div>
                  <StatusBadge status={String(f.properties.status)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="lock" size={13} /> Không hiển thị toạ độ ngoài quyền; dữ liệu nhạy cảm có chế độ che/mờ theo vai trò (áp dụng khi lên nội bộ).
      </p>
    </>
  );
}
