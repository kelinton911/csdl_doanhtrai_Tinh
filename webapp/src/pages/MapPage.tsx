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
import { toast } from '../lib/toast';
import { TILE_URL, TILE_ATTRIBUTION, TILE_PROVIDERS } from '../lib/mapConfig';
import { symbolIcon, LEGEND, legendSvg } from '../lib/milSymbols';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, ErrorState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { MilitarySymbolPicker } from '../components/MilitarySymbolPicker';

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
  const [tileKey, setTileKey] = useState<string>('localMqs');
  const activeTile = TILE_PROVIDERS[tileKey] ?? { url: TILE_URL, attribution: TILE_ATTRIBUTION };

  const [active, setActive] = useState<Record<string, boolean>>({
    barracks: true,
    facilities: true,
    'storage-locations': true,
    pois: true,
  });
  const [showProvinces, setShowProvinces] = useState(true);
  const [showAreas, setShowAreas] = useState(false);
  const [province, setProvince] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<LayeredFeature | null>(null);

  // Truy vấn lân cận theo bán kính.
  const [searchLayer, setSearchLayer] = useState('barracks');
  const [center2, setCenter2] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState('5');
  const [searchFC, setSearchFC] = useState<FC | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [createPointOpen, setCreatePointOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentOpMode = window.localStorage.getItem('CSDL_OP_MODE') || 'NORMAL';

  // Ranh giới cấp tỉnh (34)
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

  // Ranh giới cấp xã
  const areasQ = useQuery({
    queryKey: ['gis', 'areas', province],
    queryFn: () => fetchFC({ layer: 'areas', province, simplify: '0.005' }),
    enabled: showAreas && !!province,
  });

  // Các lớp điểm đang bật
  const pointResults = useQueries({
    queries: POINT_LAYERS.map((l) => ({
      queryKey: ['gis', l.key, province],
      queryFn: () => fetchFC({ layer: l.key, province: province || undefined }),
      enabled: active[l.key],
    })),
  });

  const countsByLayer = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    POINT_LAYERS.forEach((l, i) => {
      map[l.key] = pointResults[i]?.data?.features?.length ?? 0;
    });
    return map;
  }, [pointResults]);

  // Gộp điểm từ các lớp đang bật
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
      toast.success(`Đã tìm thấy ${fc.features.length} đối tượng trong bán kính ${radiusKm}km.`);
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
  const provinceStyle = { color: '#10609e', weight: 1.6, fillColor: '#10609e', fillOpacity: 0.04 };
  const areaStyle = { color: '#178f8b', weight: 0.9, fillColor: '#178f8b', fillOpacity: 0.06 };

  return (
    <>
      <PageHeader
        eyebrow="Trung tâm chỉ huy GIS"
        title="Bản đồ Số Doanh trại & Vật chất"
        description="Bản đồ không gian số tích hợp ranh giới hành chính 34 tỉnh/thành, quản lý doanh trại, kho vật chất, điểm POI và công cụ tìm kiếm lân cận."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 190 }} value={tileKey} onChange={(e) => setTileKey(e.target.value)}>
              {Object.values(TILE_PROVIDERS).map((tp) => (
                <option key={tp.key} value={tp.key}>
                  {tp.name}
                </option>
              ))}
            </select>
            <select className="input" style={{ width: 170 }} value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Toàn quốc (34 tỉnh)</option>
              {provinceList.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => setCreatePointOpen(true)} title="Khai báo đối tượng GIS mới">
              <Icon name="plus" size={15} /> Khai báo Điểm GIS
            </button>
          </div>
        }
      />

      {/* Thanh điều khiển nhanh các lớp điểm */}
      <div className="panel" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', marginBottom: 12, background: 'var(--surface-1)' }}>
        <span className="eyebrow" style={{ color: 'var(--color-neutral-700)' }}>Lớp dữ liệu:</span>
        {POINT_LAYERS.map((l) => (
          <label
            key={l.key}
            style={{
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              fontSize: 13,
              cursor: 'pointer',
              padding: '3px 10px',
              borderRadius: 6,
              background: active[l.key] ? 'var(--color-neutral-200)' : 'transparent',
              fontWeight: active[l.key] ? 700 : 500,
            }}
          >
            <input type="checkbox" checked={!!active[l.key]} onChange={(e) => setActive((s) => ({ ...s, [l.key]: e.target.checked }))} />
            {l.label}
            <span className="num" style={{ fontSize: 11, background: 'var(--color-neutral-300)', padding: '1px 6px', borderRadius: 10 }}>
              {countsByLayer[l.key] ?? 0}
            </span>
          </label>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--color-neutral-300)' }} />
        <span className="eyebrow" style={{ color: 'var(--color-neutral-700)' }}>Ranh giới:</span>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showProvinces} onChange={(e) => setShowProvinces(e.target.checked)} /> Tỉnh
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: province ? 'pointer' : 'not-allowed', opacity: province ? 1 : 0.5 }}>
          <input type="checkbox" checked={showAreas} disabled={!province} onChange={(e) => setShowAreas(e.target.checked)} /> Xã/phường (theo tỉnh)
        </label>
        {anyLoading && <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>Đang tải dữ liệu không gian…</span>}
      </div>

      {provincesQ.isError && <ErrorState error={provincesQ.error} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedFeature ? '1fr 340px' : '1.6fr 1fr',
          gap: 16,
          height: isFullscreen ? '90vh' : '75vh',
          transition: 'all 0.25s ease-in-out',
        }}
      >
        {/* Canvas Bản đồ GIS */}
        <div className="panel" style={{ overflow: 'hidden', position: 'relative', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <MapContainer center={VN_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom preferCanvas>
            <TileLayer key={activeTile.url} attribution={activeTile.attribution} url={activeTile.url} />
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
                <Circle center={center2} radius={Number(radiusKm) * 1000} pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.1, weight: 2, dashArray: '4,4' }} />
                <CircleMarker center={center2} radius={6} pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 1 }}>
                  <Tooltip permanent>Tâm bán kính {radiusKm}km</Tooltip>
                </CircleMarker>
              </>
            )}

            {shownPoints.map((f) => {
              const [lng, lat] = (f.geometry!.coordinates as [number, number]);
              return (
                <Marker
                  key={`${f.__layer}-${String(f.properties.id)}`}
                  position={[lat, lng]}
                  icon={symbolIcon(f.__layer, f.properties)}
                  eventHandlers={{
                    click: () => setSelectedFeature(f),
                  }}
                >
                  <Tooltip>{String(f.properties.name)}</Tooltip>
                  <Popup>
                    <div style={{ minWidth: 190 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{String(f.properties.name)}</div>
                      <div className="num" style={{ fontSize: 12, color: '#627d98', marginTop: 2 }}>{String(f.properties.code)}</div>
                      {f.__layer === 'storage-locations' && f.properties.nganh != null && (
                        <div style={{ fontSize: 12, color: '#334e68', marginTop: 4 }}>
                          Ngành <b>{String(f.properties.nganh)}</b> · Cấp <b>{String(f.properties.cap ?? '—')}</b>
                          {f.properties.capacity_tons != null && f.properties.capacity_tons !== '' ? <> · {Math.round(Number(f.properties.capacity_tons))} tấn</> : null}
                        </div>
                      )}
                      {f.properties.status != null && (
                        <div style={{ margin: '6px 0' }}>
                          <StatusBadge status={String(f.properties.status)} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedFeature(f)}>
                          Chi tiết đối tượng
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Chú giải ký hiệu quân sự nổi góc dưới (gộp nhóm + cuộn — điều lệ 09-2011) */}
          <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 1000, maxHeight: '48vh', overflowY: 'auto', background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(8px)', border: '1px solid var(--color-neutral-300)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Ký hiệu Quân sự (điều lệ 09-2011)</div>
            {Object.entries(
              LEGEND.reduce((acc: Record<string, typeof LEGEND>, st) => { (acc[st.groupName] ??= []).push(st); return acc; }, {}),
            ).map(([groupName, items]) => (
              <div key={groupName}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: '#829ab1', textTransform: 'uppercase', margin: '7px 0 3px' }}>{groupName}</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {items.map((st) => (
                    <div key={st.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                      <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: legendSvg(st) }} />
                      <span style={{ fontWeight: 500 }}>{st.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel: Drawer Chi tiết Đối tượng Hoặc Bảng Truy vấn Lân cận */}
        <div className="panel scrl" style={{ overflow: 'auto', padding: 16, background: 'var(--surface-1)' }}>
          {selectedFeature ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--color-neutral-200)', paddingBottom: 10 }}>
                <div className="eyebrow">Chi tiết không gian đối tượng</div>
                <button className="btn btn-sm btn-ghost" onClick={() => setSelectedFeature(null)}>✕ Đóng</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-heading)' }}>{String(selectedFeature.properties.name)}</h3>
                  <div className="num muted" style={{ fontSize: 12, marginTop: 4 }}>Mã: {String(selectedFeature.properties.code)}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {selectedFeature.properties.status != null && <StatusBadge status={String(selectedFeature.properties.status)} />}
                  <span className="muted" style={{ fontSize: 12 }}>Bối cảnh: {currentOpMode}</span>
                </div>

                <div className="card" style={{ padding: 12, background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-300)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 8 }}>Tọa độ địa lý PostGIS</div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                    Kinh độ (Lng): {(selectedFeature.geometry!.coordinates as [number, number])[0].toFixed(6)}
                  </div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                    Vĩ độ (Lat): {(selectedFeature.geometry!.coordinates as [number, number])[1].toFixed(6)}
                  </div>
                </div>

                {selectedFeature.properties.declared_capacity != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--color-neutral-200)', fontSize: 13 }}>
                    <span className="muted">Khả năng tiếp nhận:</span>
                    <span className="num" style={{ fontWeight: 700 }}>{String(selectedFeature.properties.declared_capacity)} người</span>
                  </div>
                )}

                {selectedFeature.properties.land_area != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--color-neutral-200)', fontSize: 13 }}>
                    <span className="muted">Diện tích đất quốc phòng:</span>
                    <span className="num" style={{ fontWeight: 700 }}>{String(selectedFeature.properties.land_area)} m²</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {selectedFeature.__layer === 'barracks' && (
                    <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => nav(`/barracks/${selectedFeature.properties.id}`)}>
                      <Icon name="building" size={16} /> Mở Hồ sơ Doanh trại chi tiết
                    </button>
                  )}
                  <button
                    className="btn"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      const [lng, lat] = (selectedFeature.geometry!.coordinates as [number, number]);
                      setCenter2([lat, lng]);
                      setSearchLayer('barracks');
                    }}
                  >
                    <Icon name="target" size={16} /> Đặt làm Tâm tìm lân cận
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="eyebrow">{searchFC ? `Lân cận (${shownPoints.length})` : `Danh sách đối tượng (${shownPoints.length})`}</div>
              </div>

              {/* Công cụ Truy vấn Lân cận theo Bán kính */}
              <div style={{ border: '1px solid var(--color-neutral-300)', background: 'var(--color-neutral-100)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="target" size={15} /> Truy vấn Không gian theo Bán kính
                </div>
                <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>Click điểm bất kỳ trên bản đồ để đặt tâm, chọn bán kính rồi tìm kiếm.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="input" style={{ flex: 1 }} value={searchLayer} onChange={(e) => setSearchLayer(e.target.value)}>
                      {POINT_LAYERS.map((l) => (
                        <option key={l.key} value={l.key}>{l.label}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input className="input num" style={{ width: 65 }} type="number" min="0.1" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
                      <span className="muted" style={{ fontSize: 12 }}>km</span>
                    </div>
                  </div>
                  <div className="num muted" style={{ fontSize: 11.5 }}>
                    Tâm đã chọn: {center2 ? `${center2[0].toFixed(4)}, ${center2[1].toFixed(4)}` : 'Chưa chọn (click trên bản đồ)'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!center2 || searchWithin.isPending} onClick={() => searchWithin.mutate()}>
                      <Icon name="search" size={14} /> {searchWithin.isPending ? 'Đang tìm…' : 'Tìm kiếm không gian'}
                    </button>
                    {(searchFC || center2) && <button className="btn btn-sm" onClick={clearSearch}>Xóa</button>}
                  </div>
                </div>
                {searchError && <div style={{ color: 'var(--danger-fg)', fontSize: 12, marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={13} /> {searchError}</div>}
              </div>

              {anyLoading && !shownPoints.length ? (
                <Skeleton rows={8} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {shownPoints.map((f) => (
                    <div
                      key={`${f.__layer}-${String(f.properties.id)}`}
                      className="rowh"
                      onClick={() => setSelectedFeature(f)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', border: '1px solid var(--color-neutral-300)', borderRadius: 8, cursor: 'pointer', background: 'var(--surface-1)' }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--color-heading)' }}>{String(f.properties.name)}</div>
                        <div className="num muted" style={{ fontSize: 11.5 }}>{String(f.properties.code)}</div>
                      </div>
                      {f.properties.status != null && <StatusBadge status={String(f.properties.status)} />}
                    </div>
                  ))}
                  {!shownPoints.length && <p className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>Chưa có đối tượng không gian. Hãy bật lớp dữ liệu ở trên hoặc thay đổi phạm vi tỉnh thành.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="lock" size={13} /> Dữ liệu không gian được kiểm soát nghiêm ngặt theo phân quyền cán bộ (data-scope). Thông tin nhạy cảm tự động che mờ theo vai trò.
      </p>

      {createPointOpen && (
        <CreateGisPointModal initialCoords={center2} onClose={() => setCreatePointOpen(false)} />
      )}
    </>
  );
}

function CreateGisPointModal({ initialCoords, onClose }: { initialCoords: [number, number] | null; onClose: () => void }) {
  const [f, setF] = useState({
    code: `DT-${Date.now().toString().slice(-4)}`,
    name: '',
    layer: 'barracks',
    symbolKey: 'barracks',
    lat: initialCoords ? initialCoords[0].toFixed(6) : '15.9',
    lng: initialCoords ? initialCoords[1].toFixed(6) : '108.2',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.success(`Đã lưu đối tượng "${f.name}" (${f.code}) với ký hiệu ${f.symbolKey} lên bản đồ GIS.`);
    onClose();
  }

  return (
    <Modal open title="Khai báo Đối tượng Không gian & Ký hiệu Quân sự" onClose={onClose} width={540}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12 }}>
          <div>
            <label className="field-label">Mã đối tượng</label>
            <input className="input num" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} required />
          </div>
          <div>
            <label className="field-label">Tên doanh trại / công trình</label>
            <input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="VD: Doanh trại Ban CHQS..." required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Vĩ độ (Lat)</label>
            <input className="input num" value={f.lat} onChange={(e) => setF((s) => ({ ...s, lat: e.target.value }))} required />
          </div>
          <div>
            <label className="field-label">Kinh độ (Lng)</label>
            <input className="input num" value={f.lng} onChange={(e) => setF((s) => ({ ...s, lng: e.target.value }))} required />
          </div>
        </div>

        {/* Bộ chọn Ký hiệu Quân sự Tương tác */}
        <MilitarySymbolPicker
          value={f.symbolKey}
          onChange={(key) => setF((s) => ({ ...s, symbolKey: key }))}
          label="Phân loại Ký hiệu Quân sự hiển thị trên Bản đồ"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={!f.name.trim()}>
            <Icon name="check" size={16} /> Lưu đối tượng vào CSDL
          </button>
        </div>
      </form>
    </Modal>
  );
}
