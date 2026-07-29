/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Lớp nền bản đồ nội bộ (PROD). Bỏ trống = dùng OpenStreetMap công cộng (DEV).
  readonly VITE_TILE_URL?: string;
  readonly VITE_TILE_ATTRIBUTION?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
