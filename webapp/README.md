# Webapp — SPA chức năng CSDL Vật chất Doanh trại cấp tỉnh

SPA **Vite + React + TypeScript** nối API backend end-to-end, tái sử dụng design tokens
"Command Data System" (navy/teal, sáng/tối) từ mockup Claude Design (`../frontend/app/`).

## Chạy (DEV)

```bash
# 1) Backend đang chạy (cd ../backend && npm run start:dev) — tự nhảy cổng từ 3000
# 2) Frontend
npm install
npm run dev            # http://localhost:5173 (proxy /api → backend)
```

Vite proxy `/api` → backend. Đổi cổng backend qua env khi chạy:
`BACKEND_ORIGIN=http://localhost:3004 npm run dev`.

Tài khoản demo (chỉ DEV): `admin` · `chihuy` · `hckt` · `xa01` · `kiemduyet` — mật khẩu `admin@123`.

### Cấu hình (env)

Sao chép `.env.example` → `.env` khi cần ghi đè. Biến `VITE_*` được nhúng vào bundle client
(không đặt bí mật). Lớp nền bản đồ mặc định là OpenStreetMap; trên hạ tầng nội bộ đặt
`VITE_TILE_URL` / `VITE_TILE_ATTRIBUTION` trỏ tile server nội bộ (ROADMAP §5.2) — không cần sửa mã.

## Kiến trúc

- `src/lib/` — `api.ts` (axios + problem+json + correlation id + Bearer), `auth.tsx` (JWT trong
  bộ nhớ + refresh token localStorage), `theme.ts`, `format.ts` (vi-VN), `nav.ts`, `catalogs.ts`,
  `charts.ts`, `queryClient.ts`.
- `src/components/` — AppShell (sidebar + topbar tìm kiếm/cảnh báo/phạm vi/theme), DataTable,
  StatusBadge (màu + icon + chữ), KpiCard, Modal, EvidenceDrawer, Pagination, Icon, States.
- `src/pages/` — 15 màn: Login, Dashboard, Map, Barracks (list/detail/form), Inventory,
  Inspection (+ wizard), Maintenance, Scenario, Alerts, Reports, Admin (danh mục/RBAC/audit).
- `src/styles/tokens.css` — design tokens trích nguyên từ mockup.

## Build

```bash
npm run build         # tsc --noEmit + vite build → dist/
```

## Bảo mật (thể hiện trên frontend)

- Access token giữ trong bộ nhớ (không localStorage); tự về đăng nhập khi 401.
- Trạng thái luôn màu + icon + chữ; số định dạng vi-VN; tách rõ dữ liệu mô phỏng (chế độ SSCĐ/
  tình huống giả định) khỏi dữ liệu thực. Không hiển thị dữ liệu ngoài quyền (data-scope ở server).
