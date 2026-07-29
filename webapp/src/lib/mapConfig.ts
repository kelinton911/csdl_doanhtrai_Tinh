// Cấu hình lớp nền bản đồ (tile). Mặc định OpenStreetMap công cộng cho DEV.
// Trên hạ tầng nội bộ (PROD), đặt VITE_TILE_URL / VITE_TILE_ATTRIBUTION trong .env để trỏ
// tile server nội bộ — KHÔNG cần sửa mã (ROADMAP §5.2). Ví dụ:
//   VITE_TILE_URL=http://tiles.noibo.lan/{z}/{x}/{y}.png
export const TILE_URL: string =
  import.meta.env.VITE_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_TILE_ATTRIBUTION ?? '&copy; OpenStreetMap';
