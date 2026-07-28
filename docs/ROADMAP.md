# Lộ trình triển khai & phân tích hồ sơ thiết kế

Tổng hợp từ ba tài liệu trong `docs/`:
- Hồ sơ thiết kế kỹ thuật tổng thể (TKKT-CSDLDT-01)
- Tài liệu mô tả Backend (use case, API, dữ liệu, bảo mật)
- Tài liệu mô tả Frontend (Claude Design — đã hiện thực hóa trong `frontend/`)

## 1. Quyết định kiến trúc (ADR)

| Mã | Quyết định | Hiện trạng trong repo |
| --- | --- | --- |
| ADR-01 | Modular Monolith | ✅ NestJS, module theo domain |
| ADR-02 | PostgreSQL + PostGIS | ✅ container `postgis/postgis:16-3.4`, extension bật trong migration |
| ADR-03 | Object Storage nội bộ | ✅ MinIO trong docker-compose (chưa nối module Document) |
| ADR-04 | REST API phiên bản hóa `/api/v1` | ✅ global prefix + Swagger |
| ADR-05 | Outbox + hàng đợi | ⬜ Redis đã sẵn; outbox pattern là lộ trình |
| ADR-06 | RBAC + phạm vi dữ liệu | ✅ RBAC (RolesGuard); data-scope theo đơn vị là lộ trình |
| ADR-07 | Audit append-only | ⬜ lộ trình (module Audit) |
| ADR-08 | Triển khai container | ✅ docker-compose cho DEV |

## 2. Bản đồ module → use case → API → test (Phụ lục A hồ sơ)

| Module | Phạm vi | Use case | API gốc | Hiện trạng |
| --- | --- | --- | --- | --- |
| M01 Identity & Access | Tài khoản, vai trò, phiên | UC-01, UC-02 | `/auth/*`, `/me`, `/users` | ✅ auth + /me + refresh/logout; CRUD users, gán roles/scopes (RBAC) |
| M02 Organization & Area | Đơn vị, xã/phường | UC-04 | `/organizations`, `/administrative-areas` | ✅ CRUD đơn vị + xã/phường (RBAC); geometry PostGIS |
| M03 Master Data | Danh mục chuẩn | UC-03, UC-07 | `/master-data/*`, `/materials` | ✅ catalogs (7 loại) + materials, phiên bản hóa, publish, chống trùng mã |
| M04 Barracks | Hồ sơ doanh trại | UC-05, UC-06 | `/barracks` | ✅ CRUD + workflow (submit/approve/request-changes), revision, unique-code, no-edit-approved, phân tách nhiệm vụ |
| M05 Facilities | Công trình, hạ tầng | UC-07 | `/barracks/:id/facilities`, `/facilities/:id` | ✅ CRUD thuộc doanh trại, mã duy nhất trong doanh trại, decommission thay xóa cứng, geometry Point |
| M06 Materials & Inventory | Tồn kho, biến động | UC-08 | `/inventory/*` | ✅ transactions/balances/adjustments, sổ kho bất biến, chặn tồn âm (INV-001), idempotency |
| M07 Inspection | Kiểm kê, kiểm duyệt | UC-09, UC-10, UC-11 | `/inspection-*`, `/review-*` | ✅ campaign/sheet/line/variance/review-task, autosave, chặn gửi rỗng, tách nhiệm vụ |
| M08 Documents & Media | Tài liệu, ảnh | UC-12 | `/files/*`, `/documents` | ✅ upload multipart→MinIO, checksum, presigned download, lọc loại tệp/kích thước |
| M09 Maintenance & Recovery | Hư hỏng, sửa chữa | UC-13, UC-14 | `/damage-events`, `/maintenance-*` | ✅ damage verify; request DRAFT→PROPOSED→APPROVED→IN_PROGRESS→ACCEPTED→CLOSED, tách nhiệm vụ, cờ scenario |
| M10 Scenario & Planning | Tình huống, phương án | UC-15, UC-16 | `/scenarios`, `/plans` | ✅ engine assurance-v1 (chỗ ở + cân đối vật chất + confidence), run có version, plan compare/approve bất biến |
| M11 GIS | Bản đồ, không gian | UC-17 | `/gis/*` | ✅ `/gis/features` (bbox), `/gis/search-within` (bán kính) trả GeoJSON từ PostGIS |
| M12 Reporting & Analytics | Báo cáo, dashboard, tìm kiếm | UC-19, UC-20 | `/dashboard/summary`, `/search`, `/reports/*` | ✅ dashboard tổng hợp, tìm kiếm toàn cục, xuất PDF (DejaVuSans)/Excel từ snapshot lưu MinIO |
| M13 Alert & Notification | Cảnh báo | UC-18 | `/alerts/*` | ✅ rule engine sinh cảnh báo, gom trùng, assign, close (bắt buộc kết quả), SLA |
| M14 Integration & Sync | Nhập liệu, đồng bộ | UC-21, UC-22 | `/imports`, `/sync/*` | ✅ import CSV (staging→validate→commit, transaction) + đồng bộ offline (idempotent, phát hiện xung đột phiên bản) |
| M15 System Administration | Nhật ký, sao lưu, audit | UC-23, UC-24 | `/audit-logs`, `/admin/*` | ✅ audit append-only (interceptor + `/audit-logs`); backup/restore qua runbook + script (`infra/backup.sh`, `infra/restore.sh`, `docs/RUNBOOK-backup-restore.md`) |

## 3. Pha triển khai (theo hồ sơ backend §13)

- **Pha 0 — Nền tảng** ✅: repo, auth, error model (problem+json), migration, observability
  (correlation id, health), CSDL PostGIS, Swagger; audit append-only + idempotency + MinIO storage.
- **Pha 1 — Dữ liệu lõi** ✅: Organization/Area (M02), Barracks (M04), Facilities (M05),
  Master Data (M03), Documents (M08 + MinIO), Dashboard.
- **Pha 2 — Kiểm kê & kiểm duyệt** ✅: Inspection (M07) + workflow/approval + chênh lệch.
- **Pha 3 — Vật chất & sửa chữa** ✅: Inventory (M06), Maintenance (M09).
- **Pha 4 — GIS & báo cáo** ✅: GIS (M11), Reporting (M12) + tìm kiếm + xuất PDF/Excel.
- **Pha 5 — Tình huống & phương án** ✅: engine tính toán (M10), so sánh/chốt phương án.
- **Pha 6 — Tích hợp & tối ưu** ✅: Alert (M13), Audit (M15), Integration/Sync (M14),
  backup/restore (runbook + script), data-scope theo dataScopes, watermark báo cáo theo người dùng;
  còn outbox, HA, performance/security hardening nâng cao (lộ trình).

> **Kiểm thử tự động**: backend Jest (unit domain — data-scope + quy tắc workflow M04),
> `cd backend && npm test`. Frontend Playwright 5 luồng nghiệp vụ §7 (Chrome hệ thống),
> `cd webapp && BACKEND_ORIGIN=http://localhost:<cổng> npm run e2e`.

> **Frontend chức năng**: SPA thật ở `webapp/` (Vite + React + TS) nối API end-to-end, tái dùng
> design tokens "Command Data System". 15 màn hình. Mockup `frontend/app/` giữ làm tham chiếu thiết kế.

## 4. Khuôn dựng một module mới (giữ nhất quán)

```
src/modules/<ten>/
  entities/<ten>.entity.ts     # id UUID, created/updated_by/at, row_version
  dto/                         # class-validator + @ApiProperty
  <ten>.service.ts             # nghiệp vụ + transaction; phát sự kiện qua outbox
  <ten>.controller.ts          # @Roles(...), @ApiTags; endpoint /api/v1/...
  <ten>.module.ts
+ migration mới trong src/database/migrations/
+ test unit (domain) + integration (repository/API)
```

Nguyên tắc bất biến khi mở rộng: không xóa cứng dữ liệu đã phát sinh lịch sử; mọi thay
đổi trên bản đã duyệt tạo **revision/version**; báo cáo chính thức đọc **snapshot**;
dữ liệu mô phỏng tách khỏi dữ liệu thực (`scenario=true`).

## 5. Việc cần làm khi lên môi trường nội bộ (PROD)

1. Đổi toàn bộ bí mật trong `.env` (JWT secret, mật khẩu CSDL) sang giá trị mạnh.
2. Bản đồ: `frontend/app/ban-do-so.html` — chuyển `TILE_CONFIG.active = 'noibo'` và
   trỏ tile server nội bộ.
3. Thực thi lọc dữ liệu theo quyền (data scope) ở tầng service, không chỉ ở giao diện.
4. Bật TLS, backup mã hóa, diễn tập phục hồi (RPO/RTO), giám sát tập trung.
