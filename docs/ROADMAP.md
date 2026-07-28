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
| M01 Identity & Access | Tài khoản, vai trò, phiên | UC-01, UC-02 | `/auth/*`, `/me`, `/users` | ✅ auth + /me; quản lý user là lộ trình |
| M02 Organization & Area | Đơn vị, xã/phường | UC-04 | `/organizations`, `/administrative-areas` | ✅ list/create area (RBAC); geometry PostGIS |
| M03 Master Data | Danh mục chuẩn | UC-03, UC-07 | `/master-data/*`, `/materials` | ⬜ |
| M04 Barracks | Hồ sơ doanh trại | UC-05, UC-06 | `/barracks` | ✅ CRUD + workflow (submit/approve/request-changes), revision, unique-code, no-edit-approved, phân tách nhiệm vụ |
| M05 Facilities | Công trình, hạ tầng | UC-07 | `/facilities` | ⬜ |
| M06 Materials & Inventory | Tồn kho, biến động | UC-08 | `/inventory/*` | ⬜ |
| M07 Inspection | Kiểm kê, kiểm duyệt | UC-09, UC-10, UC-11 | `/inspection-*`, `/review-*` | ⬜ |
| M08 Documents & Media | Tài liệu, ảnh | UC-12 | `/files/*`, `/documents` | ⬜ (dùng MinIO) |
| M09 Maintenance & Recovery | Hư hỏng, sửa chữa | UC-13, UC-14, UC-15 | `/damage-events`, `/maintenance-*` | ⬜ |
| M10 Scenario & Planning | Tình huống, phương án | UC-15, UC-16 | `/scenarios`, `/plans` | ⬜ |
| M11 GIS | Bản đồ, không gian | UC-17 | `/gis/*` | ⬜ (PostGIS sẵn) |
| M12 Reporting & Analytics | Báo cáo, dashboard | UC-20 | `/reports/*`, `/exports` | ⬜ |
| M13 Alert & Notification | Cảnh báo | UC-18 | `/alerts/*` | ⬜ |
| M14 Integration & Sync | Nhập liệu, đồng bộ | UC-21, UC-22 | `/imports`, `/sync/*` | ⬜ |
| M15 System Administration | Cấu hình, sao lưu, audit | UC-23, UC-24 | `/audit-logs`, `/admin/*` | ⬜ |

## 3. Pha triển khai (theo hồ sơ backend §13)

- **Pha 0 — Nền tảng** ✅ *(đã dựng)*: repo, CI/CD-ready, auth, error model (problem+json),
  migration, observability (correlation id, health), CSDL PostGIS, Swagger.
- **Pha 1 — Dữ liệu lõi**: Organization/Area (M02), Master Data (M03), Barracks (M04),
  Facilities (M05), Documents (M08 + MinIO).
- **Pha 2 — Kiểm kê & kiểm duyệt**: Inspection (M07), Workflow/Approval, chênh lệch, thông báo.
- **Pha 3 — Vật chất & sửa chữa**: Inventory (M06), Maintenance (M09).
- **Pha 4 — GIS & báo cáo**: GIS (M11), Reporting (M12), snapshot/export.
- **Pha 5 — Tình huống & phương án**: engine tính toán, Scenario (M10), so sánh/chốt phương án.
- **Pha 6 — Tích hợp & tối ưu**: Integration/Sync (M14), Alert (M13), Audit (M15),
  outbox, HA, performance, security hardening.

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
