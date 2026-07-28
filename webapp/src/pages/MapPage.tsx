import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
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
export function MapPage() {
  const [layer, setLayer] = useState('barracks');
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['gis', layer],
    queryFn: async () => (await api.get<FC>('/gis/features', { params: { layer } })).data,
  });

  const points = useMemo(
    () => (q.data?.features ?? []).filter((f) => f.geometry?.coordinates),
    [q.data],
  );
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
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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
            <div className="eyebrow">Kết quả ({points.length})</div>
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
