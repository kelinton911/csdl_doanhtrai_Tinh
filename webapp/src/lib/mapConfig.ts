// Cấu hình các lớp bản đồ nền (Tile Providers).
// Hỗ trợ chuyển đổi linh hoạt giữa OpenStreetMap, Google Maps (Giao thông & Vệ tinh), Esri Satellite nội bộ/công cộng.

export interface TileProvider {
  key: string;
  name: string;
  url: string;
  attribution: string;
}

export const TILE_PROVIDERS: Record<string, TileProvider> = {
  localMqs: {
    key: 'localMqs',
    name: 'Máy chủ Mạng Quân sự Nội bộ (Offline Tile Server)',
    url: (import.meta.env.VITE_TILE_URL && import.meta.env.VITE_TILE_URL.trim()) || 'http://localhost:8080/styles/vetsat/{z}/{x}/{y}.png',
    attribution: 'Bộ CHQS Tỉnh — Máy chủ GIS Nội bộ MQS',
  },
  vectorOnly: {
    key: 'vectorOnly',
    name: 'Bản đồ Số Vector Nội bộ (100% PostGIS Offline)',
    url: 'data:image/png;base64,iVB40KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    attribution: 'CSDL Địa bàn Hành chính PostGIS Nội bộ',
  },
  googleHybrid: {
    key: 'googleHybrid',
    name: 'Google Vệ tinh + Đường (Internet)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
  },
  googleSat: {
    key: 'googleSat',
    name: 'Google Vệ tinh (Internet)',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
  },
  googleRoad: {
    key: 'googleRoad',
    name: 'Google Maps (Internet)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
  },
  osm: {
    key: 'osm',
    name: 'OpenStreetMap (Internet)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  esriSat: {
    key: 'esriSat',
    name: 'Esri Vệ tinh (Internet)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
  },
};

export const TILE_URL: string =
  (import.meta.env.VITE_TILE_URL && import.meta.env.VITE_TILE_URL.trim()) ||
  TILE_PROVIDERS.googleHybrid.url;

export const TILE_ATTRIBUTION: string =
  (import.meta.env.VITE_TILE_ATTRIBUTION && import.meta.env.VITE_TILE_ATTRIBUTION.trim()) ||
  TILE_PROVIDERS.googleHybrid.attribution;
