import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  CircleMarker,
  Circle,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api, toProblem } from '../lib/api';
import { TILE_URL, TILE_ATTRIBUTION } from '../lib/mapConfig';
import { symbolIcon, LEGEND, legendSvg } from '../lib/milSymbols';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, ErrorState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

interface Feature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface FC {
  type: 'FeatureCollection';
  features: Feature[];
}
type LayeredFeature = Feature & { __layer: string };

// Lớp điểm (bật/tắt nhiều lớp cùng lúc) — hiển thị bằng ký hiệu quân sự tùy biến.
const POINT_LAYERS = [
  { key: 'barracks', label: 'Doanh trại' },
  { key: 'facilities', label: 'Công trình' },
  { key: 'storage-locations', label: 'Kho' },
  { key: 'pois', label: 'Trạm/Địa danh' },
];

const VN_CENTER: [number, number] = [16.0, 107.8];

async function fetchFC(params: Record<string, string | undefined>): Promise<FC> {
  return (await api.get<FC>('/gis/features', { params })).data;
}

// Đưa bản đồ về khung của tỉnh đang lọc (dựa trên ranh giới tỉnh).
function FitToProvince({ feature }: { feature: Feature | null }) {
  const map = useMap();
  useEffect(() => {
    if (feature?.geometry) {
      try {
        const b = L.geoJSON(feature as any).getBounds();
        if (b.isValid()) map.flyToBounds(b, { padding: [24, 24], duration: 0.6 });
      } catch {
        /* bỏ qua hình học lỗi */
      }
    }
  }, [feature, map]);
  return null;
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function MapPage() {
  const nav = useNavigate();
  const [active, setActive] = useState<Record<string, boolean>>({
    barracks: true,
    facilities: false,
    'storage-locations': false,
    pois: false,
  });
  const [showProvinces, setShowProvinces] = useState(true);
  const [showAreas, setShowAreas] = useState(false);
  const [province, setProvince] = useState('');
  // Truy vấn lân cận theo bán kính.
  const [searchLayer, setSearchLayer] = useState('barracks');
  const [center2, setCenter2] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState('5');
  const [searchFC, setSearchFC] = useState<FC | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Ranh giới cấp tỉnh (34) — dùng cho cả bộ lọc lẫn vẽ ranh giới.
  const provincesQ = useQuery({
    queryKey: ['gis', 'provinces'],
    queryFn: () => fetchFC({ layer: 'provinces', simplify: '0.02' }),
  });
  const provinceList = useMemo(
    () =>
      (provincesQ.data?.features ?? [])
        .map((f) => ({ code: String(f.properties.province_code ?? f.properties.code ?? ''), name: String(f.properties.name ?? '') }))
        .filter((p) => p.code)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [provincesQ.data],
  );
  const selectedProvinceFeature = useMemo(
    () => (province ? (provincesQ.data?.features ?? []).find((f) => String(f.properties.province_code ?? f.properties.code) === province) ?? null : null),
    [province, provincesQ.data],
  );

  // Ranh giới cấp xã của tỉnh đang chọn (chỉ nạp khi bật + đã chọn tỉnh — tránh nạp toàn quốc).
  const areasQ = useQuery({
    queryKey: ['gis', 'areas', province],
    queryFn: () => fetchFC({ layer: 'areas', province, simplify: '0.005' }),
    enabled: showAreas && !!province,
  });

  // Các lớp điểm đang bật.
  const pointResults = useQueries({
    queries: POINT_LAYERS.map((l) => ({
      queryKey: ['gis', l.key, province],
      queryFn: () => fetchFC({ layer: l.key, province: province || undefined }),
      enabled: active[l.key],
    })),
  });

  // Gộp điểm từ các lớp đang bật (gắn __layer để chọn ký hiệu + điều hướng).
  const combinedPoints = useMemo<LayeredFeature[]>(() => {
    const out: LayeredFeature[] = [];
    POINT_LAYERS.forEach((l, i) => {
      if (!active[l.key]) return;
      for (const f of pointResults[i]?.data?.features ?? []) {
        if (f.geometry?.type === 'Point') out.push({ ...f, __layer: l.key });
      }
    });
    return out;
  }, [pointResults, active]);

  // Khi có kết quả truy vấn lân cận thì ưu tiên hiển thị nó.
  const shownPoints: LayeredFeature[] = useMemo(
    () =>
      searchFC
        ? searchFC.features.filter((f) => f.geometry?.type === 'Point').map((f) => ({ ...f, __layer: searchLayer }))
        : combinedPoints,
    [searchFC, searchLayer, combinedPoints],
  );

  const searchWithin = useMutation({
    mutationFn: async () => {
      const [lat, lng] = center2!;
      return (
        await api.post('/gis/search-within', { layer: searchLayer, lat, lng, radiusMeters: Number(radiusKm) * 1000 })
      ).data as FC;
    },
    onSuccess: (fc) => {
      setSearchFC(fc);
      setSearchError(null);
    },
    onError: (e) => {
      setSearchError(toProblem(e).title);
      setSearchFC(null);
    },
  });
  const clearSearch = () => {
    setSearchFC(null);
    setCenter2(null);
    setSearchError(null);
  };

  const anyLoading = provincesQ.isLoading || pointResults.some((r) => r.isLoading) || areasQ.isFetching;
  const provinceStyle = { color: '#10609e', weight: 1.4, fillColor: '#10609e', fillOpacity: 0.04 };
  const areaStyle = { color: '#178f8b', weight: 0.8, fillColor: '#178f8b', fillOpacity: 0.05 };

  return (
    <>
      <PageHeader
        eyebrow="Bản đồ doanh trại"
        title="Bản đồ số"
        description="Ranh giới hành chính thật (34 tỉnh, cấp xã theo tỉnh). Lớp nền chuyển tile server nội bộ khi lên PROD."
        actions={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 190 }} value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Toàn quốc</option>
              {provinceList.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Bảng điều khiển lớp */}
      <div className="panel" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', marginBottom: 10 }}>
        <span className="eyebrow">Lớp điểm:</span>
        {POINT_LAYERS.map((l) => (
          <label key={l.key} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!active[l.key]} onChange={(e) => setActive((s) => ({ ...s, [l.key]: e.target.checked }))} />
            {l.label}
          </label>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--color-neutral-200)' }} />
        <span className="eyebrow">Ranh giới:</span>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showProvinces} onChange={(e) => setShowProvinces(e.target.checked)} /> Tỉnh
        </label>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 13, cursor: province ? 'pointer' : 'not-allowed', opacity: province ? 1 : 0.5 }}>
          <input type="checkbox" checked={showAreas} disabled={!province} onChange={(e) => setShowAreas(e.target.checked)} /> Xã/phường (theo tỉnh)
        </label>
        {anyLoading && <span className="muted" style={{ fontSize: 12 }}>Đang tải…</span>}
      </div>

      {provincesQ.isError && <ErrorState error={provincesQ.error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, height: '72vh' }}>
        <div className="panel" style={{ overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={VN_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom preferCanvas>
            <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
            <ClickCapture onPick={(lat, lng) => { setCenter2([lat, lng]); setSearchFC(null); }} />
            <FitToProvince feature={selectedProvinceFeature} />

            {showProvinces && provincesQ.data && (
              <GeoJSON
                key={`prov-${provincesQ.dataUpdatedAt}`}
                data={provincesQ.data as any}
                style={() => provinceStyle}
                onEachFeature={(f, layer) => {
                  const p = (f as Feature).properties;
                  layer.bindTooltip(String(p.name ?? ''));
                  layer.on('click', () => setProvince(String(p.province_code ?? p.code ?? '')));
                }}
              />
            )}
            {showAreas && province && areasQ.data && (
              <GeoJSON
                key={`area-${province}-${areasQ.dataUpdatedAt}`}
                data={areasQ.data as any}
                style={() => areaStyle}
                onEachFeature={(f, layer) => layer.bindTooltip(String((f as Feature).properties.name ?? ''))}
              />
            )}

            {center2 && (
              <>
                <Circle center={center2} radius={Number(radiusKm) * 1000} pathOptions={{ color: '#a8571f', fillColor: '#a8571f', fillOpacity: 0.08 }} />
                <CircleMarker center={center2} radius={5} pathOptions={{ color: '#a8571f', fillColor: '#a8571f', fillOpacity: 1 }}>
                  <Tooltip permanent>Tâm truy vấn</Tooltip>
                </CircleMarker>
              </>
            )}

            {shownPoints.map((f) => {
              const [lng, lat] = (f.geometry!.coordinates as [number, number]);
              return (
                <Marker key={`${f.__layer}-${String(f.properties.id)}`} position={[lat, lng]} icon={symbolIcon(f.__layer, f.properties)}>
                  <Tooltip>{String(f.properties.name)}</Tooltip>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>{String(f.properties.name)}</div>
                      <div className="num" style={{ fontSize: 12, color: '#627d98' }}>{String(f.properties.code)}</div>
                      {f.properties.status != null && (
                        <div style={{ margin: '6px 0' }}>
                          <StatusBadge status={String(f.properties.status)} />
                        </div>
                      )}
                      {f.__layer === 'barracks' && (
                        <button className="btn btn-sm btn-primary" onClick={() => nav(`/barracks/${f.properties.id}`)}>
                          Mở hồ sơ
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Chú giải ký hiệu */}
          <div style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 1000, background: 'rgba(255,255,255,0.94)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Ký hiệu</div>
            <div style={{ display: 'grid', gap: 3 }}>
              {LEGEND.map((st) => (
                <div key={st.key} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: legendSvg(st) }} />
                  {st.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel scrl" style={{ overflow: 'auto', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="eyebrow">{searchFC ? `Lân cận (${shownPoints.length})` : `Đối tượng (${shownPoints.length})`}</div>
          </div>

          {/* Truy vấn lân cận theo bán kính */}
          <div style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="target" size={14} /> Tìm lân cận theo bán kính
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>Bấm lên bản đồ để chọn tâm, chọn lớp + bán kính rồi tìm.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" style={{ width: 130 }} value={searchLayer} onChange={(e) => setSearchLayer(e.target.value)}>
                {POINT_LAYERS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
              <span className="num muted" style={{ fontSize: 12 }}>{center2 ? `${center2[0].toFixed(4)}, ${center2[1].toFixed(4)}` : 'Chưa chọn tâm'}</span>
              <input className="input num" style={{ width: 80 }} type="number" min="0.1" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} /> <span className="muted" style={{ fontSize: 12 }}>km</span>
              <button className="btn btn-sm btn-primary" disabled={!center2 || searchWithin.isPending} onClick={() => searchWithin.mutate()}>
                <Icon name="search" size={14} /> Tìm
              </button>
              {(searchFC || center2) && <button className="btn btn-sm" onClick={clearSearch}>Xóa</button>}
            </div>
            {searchError && <div style={{ color: 'var(--danger-fg)', fontSize: 12, marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={13} /> {searchError}</div>}
          </div>

          {anyLoading && !shownPoints.length ? (
            <Skeleton rows={8} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shownPoints.map((f) => (
                <div
                  key={`${f.__layer}-${String(f.properties.id)}`}
                  className="rowh"
                  onClick={() => f.__layer === 'barracks' && nav(`/barracks/${f.properties.id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', border: '1px solid var(--color-neutral-200)', borderRadius: 8, cursor: f.__layer === 'barracks' ? 'pointer' : 'default' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{String(f.properties.name)}</div>
                    <div className="num muted" style={{ fontSize: 11.5 }}>{String(f.properties.code)}</div>
                  </div>
                  {f.properties.status != null && <StatusBadge status={String(f.properties.status)} />}
                </div>
              ))}
              {!shownPoints.length && <p className="muted" style={{ fontSize: 12 }}>Chưa có đối tượng. Bật lớp điểm ở trên hoặc chọn tỉnh khác.</p>}
            </div>
          )}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="lock" size={13} /> Chỉ hiển thị đối tượng trong phạm vi quyền (data-scope áp ở tầng máy chủ); dữ liệu nhạy cảm che/mờ theo vai trò khi lên nội bộ.
      </p>
    </>
  );
}
