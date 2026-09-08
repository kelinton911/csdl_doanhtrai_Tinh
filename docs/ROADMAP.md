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
  còn HA, performance/security hardening nâng cao (lộ trình).
- **Sprint 0 (DT-build) — Chuẩn hóa nền tảng** ◑ (2026-09-06): mã lỗi nghiệp vụ tập trung
  (`BusinessException`), enum trạng thái chuẩn (§3), `DataScopeGuard` row-level toàn cục +
  `@Scoped`, `AbstractEntity` + optimistic lock (STALE_WRITE), audit chuẩn hóa,
  as-of helper + response wrapper (Asia/Ho_Chi_Minh), idempotency mở rộng POST/PUT/PATCH,
  **outbox pattern** (`outbox_event` + dispatcher), **C3 catalog** (`/c3-catalog` + seed),
  **OpenAPI contract test** (preview-mode + baseline). Chi tiết: `docs/dt-build/01-DOI-CHIEU-GAP.md`.
- **DT-01 Danh mục chuẩn R00** ◑ (2026-09-06): 10 bảng + 25 API `/catalog/*` + 5 màn hình webapp.
- **DT-02 Hồ sơ Doanh trại (lớp đất)** ◑ (2026-09-06): `address_snapshot`/`land_usage_allocation`/
  `land_change_event` + API `/dt02/*` + diện tích tại snapshot + data-quality (backend, 10 unit test).
- **DT-03 Hồ sơ kỹ thuật** ◑ (2026-09-06): 10 bảng (product_model/design_revision/technical_document/
  drawing_sheet/bom/…) + ~20 API + máy trạng thái revision + xác minh nguồn (backend, 14 unit test).
- **DT-04 Thực lực vật chất** ◑ (2026-09-06): sổ cái `materiel_movement` bất biến + HC(t) as-of
  (`GET /materiel/hc` cho DT-08) + lô/asset + snapshot lock + điều chỉnh (backend, 12 unit test).
- **DT-05 Nhập–xuất–điều chuyển** ◑ (2026-09-06): `inventory_document` + POST nguyên tử → movement
  DT-04, reversal, điều chuyển 2 đầu (IN_TRANSIT), khóa kỳ cấm backdate (backend, 10 unit test).
- **DT-06 Dự trữ & phân bổ** ◑ (2026-09-06): allocation_type/hold lớp phủ trên HC + ràng buộc
  Σ exclusive ≤ HC_ALLOCATABLE + PC_SSCĐ (`/reserve/sscd`) cho DT-08 + snapshot (backend, 9 unit test).
- **DT-07 Định mức có căn cứ & Chỉ lệnh** ◑ (2026-09-07): 17 bảng (normative_document/norm_set/
  material_norm + scope đa chiều/selector/authority_rank/conflict_case/command) + bộ chọn `/norms/resolve`
  **deterministic** (SELECTED/NO_RULE/CONFLICT + explanation trace, không ngầm 0) cho DT-08 + publish bất
  biến + nhập file .xlsx/.csv thật (exceljs, sha256) → DRAFT/LEGACY_UNVERIFIED + chỉ lệnh đầy đủ
  (yêu cầu/phân giao/tiến độ) + **webapp** NormsPage `/norms` 7 tab (SCR-01..08) + test 174 unit /
  7 integration (DB thật) / 2 E2E Playwright — **DoD PASS**.
- **DT-08 Tính nhu cầu vật chất** ◑ (2026-09-07): 7 bảng (calculation_scenario/calculation_run/
  material_calculation/rule_resolution_snapshot/hc_snapshot_ref/calculation_trace_node/scenario_comparison)
  + engine `dt08-need-v1` tính **NC = TT + PC_SSCĐ − HC** (TT_GĐCB/TT_GĐCĐ lưu riêng; NC âm giữ dấu;
  `supply_required = max(NC,0)` dẫn xuất — không ngầm 0) kết hợp DT-07 `resolve` + HC as-of
  `hc_snapshot` (DT-04, thiếu → NO_HC_SNAPSHOT) + PC_SSCĐ (DT-06); NO_RULE/CONFLICT đánh dấu dòng
  (không auto chọn) + input/output_hash tái lập + LOCK bất biến (revise=clone) + trace tới nguồn
  + so sánh ΔNC + `GET /runs/{id}/supply-required` cho DT-09 + **webapp** CalculationPage `/calculation`
  3 tab (SCR-01..07) + test 16 unit / 4 integration (DB thật) / 1 E2E Playwright — **DoD PASS**.
- **DT-09 Nguồn địa bàn & cân đối bảo đảm** ◑ (2026-09-08): 12 bảng (territorial_source/source_material/
  source_verification/verification_evidence/mobilization_assessment/balance_plan/balance_line/
  source_reservation/execution_request/execution_feedback/balance_snapshot(+line)) + **nhận
  `supply_required` từ DT-08** (copy, KHÔNG tính lại NC — BR-DT09-009) + vòng đời tin cậy
  UNVERIFIED→VERIFIED→EXPIRED (VERIFIED ≠ ELIGIBLE) + mobilizable ≤ verified + **candidate 8 bước**
  (lọc + xếp hạng + lý do loại) + **giữ chỗ chống overbooking** (Σ ACTIVE ≤ available, transaction +
  pessimistic lock/`row_version`) + Gap + **execution_request → DT-05** (`createDocument`) + feedback
  cập nhật delivered + **snapshot bất biến + fingerprint** khi khóa (BR-DT09-020) + **webapp**
  SourcesPage `/dt09/sources` + BalancePage `/dt09/balance` (SCR-01..09) + test 31 unit / 10 integration
  (DB thật — gồm overbooking song song & snapshot bất biến) / 1 E2E Playwright — **DoD PASS**.
- **DT-10 Kiểm kê & chốt số liệu** ◑ (2026-09-08): module MỚI `dt10-inventory-count` (tách khỏi M07
  inspection) — 13 bảng (inventory_count_campaign/book_snapshot(+line)/count_sheet/count_line/
  recount_round/count_variance/count_quality_grade/official_snapshot(+line)/official_lock/
  count_adjustment_request/report_dataset) + **kiểm kê 3 lớp độc lập** Book/Physical/Official
  (BR-DT10-005) + **cutoff → book_snapshot bất biến** (Σ quantity_signed POSTED của sổ cái DT-04
  ≤ cutoff + checksum sha256 + locked; rebuild→LOCKED_IMMUTABLE — BR-DT10-002/003) + **blind count**
  (count_line KHÔNG có book_qty) + autosave + **recount vòng mới** (giữ nguyên vòng trước —
  BR-DT10-008) + **chất lượng C1–5** (Σ=physical→QUALITY_TOTAL_MISMATCH — BR-DT10-009) + **variance
  đủ 5 loại** SHORTAGE/SURPLUS/UNBOOKED/MISSING/LOCATION + **official khóa bất biến** (sửa→
  LOCKED_IMMUTABLE) + **revision có version** (BR-DT10-019/020) + **điều chỉnh → DT-05**
  (`DocumentsService.createDocument` CONVERSION → POST movement ADJUSTMENT theo delta, KHÔNG sửa số
  dư trực tiếp — BR-DT10-022/SYS-BR-02) + **report_dataset gắn snapshot_version** + reconciliation
  hậu kiểm (cấp DT-11 — BR-DT10-025) + **webapp** InventoryCountPage `/dt10/inventory-count`
  (SCR-DT10-01..10) + test 15 unit / **9 integration** (DB thật — TC-DT10-002/005/008/009/013/019/022/025)
  / 1 E2E Playwright (chuỗi đầy đủ) — **DoD PASS**.
- **DT-11 Báo cáo & biểu mẫu** ✅ (2026-09-08): module MỚI `dt11-report` — 11 bảng (report_definition/
  report_template_version/dataset_definition(+field/filter/formula)/dataset_instance/dataset_validation/
  report_instance/report_rollup/report_lineage) + migration reversible `1753000045000` + 24 API. **Report
  Engine CẤU HÌNH** (seed 17 biểu report_definition + template PUBLISHED — KHÔNG hard-code số lượng; thêm biểu
  = cấu hình, không sửa code — BR-DT11-004/019) + **dataset từ snapshot chuẩn** qua 5 adapter (`report-sources.ts`:
  DT-10 official_snapshot, DT-04 materiel_snapshot, DT-09 balance_snapshot, DT-08 calculation_run, LAND_FORMS) với
  **dataset_hash** (tái dùng `sha256Hex`; bỏ generatedAt ⇒ cùng nguồn trùng hash — BR-DT11-006) + **source_fingerprint**
  (checksum/hash thượng nguồn) + **validate** reconciliation/quality/completeness (FAIL chặn duyệt — BR-DT11-007;
  NO_DATA≠ZERO≠MISSING_SUBMISSION — BR-DT11-009) + **workflow** DRAFT→VALIDATED→APPROVED→ISSUED→SUPERSEDED, file
  PDF/Excel (DejaVuSans + watermark, tái dùng M12) lưu MinIO **checksum sha256 bất biến**, phát hành lại = version
  mới giữ file cũ (BR-DT11-016/017) + **rollup** chống aggregate trùng (UNIQUE parent+child), đơn vị chưa gửi
  MISSING ≠ 0 (BR-DT11-008/020/021) + **report_lineage** mọi ô drill-down về dataset→snapshot→giao dịch (BR-DT11-002)
  + **webapp** ReportPage `/dt11/reports` (SCR-DT11-01..09) + test **17 unit** / **7 integration** (DB thật —
  TC-DT11-002/006/007/009/016/019/021) / **1 E2E** Playwright (chuỗi đầy đủ) — **DoD PASS**.

- **DT-12 Dashboard chỉ huy & hỗ trợ quyết định** ✅ (2026-09-09): module MỚI `dt12-dashboard` — 23 bảng
  (kpi_definition/kpi_formula_version/kpi_threshold/metric_instance + dim_time/material/org/location/mission/quality
  + fact_inventory/requirement/balance/count + data_mart_refresh + alert_rule/instance/assignment
  + decision_session/option/criterion/score/record) + migration reversible `1753000046000` + 30 API (`/api/v1/dt12/*`).
  **Lớp semantic/KPI** đọc SNAPSHOT CHUẨN của DT-04/06/08/09/10 (chỉ đọc — bất biến) qua `semantic-sources.ts`:
  7 semantic tách bạch **SEM-HC / HC-AVAILABLE (HC − hold EXCLUSIVE) / RESERVE-SSCĐ / PC-SCD / NC / SUPPLY-REQUIRED /
  GAP** (Quyển XII PHẦN III). `metric_instance` có **as_of_time + lineage_json + metric_hash tất định** (tái dùng
  `sha256Hex`) + **freshness** (so `source_version` với phiên bản nguồn hiện tại ⇒ **STALE** khi nguồn mới hơn — TC-006).
  **AC-15**: KHÔNG tạo "số Dashboard" độc lập — mọi KPI có lineage về snapshot (TC-015), drill-down KPI→dòng nguồn
  khớp tổng (TC-001). **Data Mart star schema** (6 dim + 4 fact) refresh từ snapshot TRONG transaction + phát
  **outbox** `DATA_MART_REFRESHED` (dẫn xuất — không sửa tay) + `/data-mart/freshness`. **Alert cấu hình** ngưỡng +
  severity + SLA, lifecycle **OPEN→ACK→RESOLVED** (RESOLVED bất biến) + gom trùng dedupe (TC-012). **What-if cách ly**
  `decision_*`: chấm điểm chuẩn hóa + trọng số KHÔNG ghi ngược metric/nguồn vận hành (TC-008). Bản đồ vật chất
  `@Scoped` theo data-scope (TC-010). Tái dùng nền: `AbstractEntity`, `BusinessException`, `OutboxService`,
  `buildScopeContext`, `resolveAsOf`. **KHÔNG sửa** `dashboard`/`analytics`/`alerts` cũ (M12/M13) — lớp mới song song.
  + **webapp** CommandDashboardPage `/dt12/command` (SCR-DT12-01..08) + test **21 unit** / **7 integration** (DB thật —
  TC-DT12-001/003/006/008/012/015 + Data Mart) / **1 E2E** Playwright (chuỗi đầy đủ, backend thật 3099) — **DoD PASS**.

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
