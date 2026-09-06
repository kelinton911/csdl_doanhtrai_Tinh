# Quy ước chung (Sprint 0) — chuẩn kỹ thuật cho toàn bộ phân hệ DT-xx

> Mọi file prompt phân hệ **kế thừa** các quy ước trong tài liệu này. Khi prompt phân hệ
> viết "theo quy ước chung", nghĩa là áp dụng đúng các mục dưới đây. Chốt tài liệu này ở
> Sprint 0 trước khi mở DT-01.

## 1. Quy ước API

- Tiền tố toàn cục **`/api/v1`** (đã có). Phân hệ mới thêm resource dưới prefix này.
- **Response chuẩn**: `{ data, meta }`. Danh sách: `meta = { page, pageSize, total, sort }`.
- **Lỗi = RFC7807 problem+json**: `{ type, title, status, detail, code, correlationId, errors? }`.
  `code` là mã lỗi nghiệp vụ (mục §2). `errors[]` cho lỗi field-level.
- **Phân trang/lọc/sắp xếp**: `?page=&pageSize=&sort=field:asc,field2:desc&filter[field]=`.
  `pageSize` mặc định 20, tối đa 200.
- **Đồng thời (optimistic concurrency)**: mọi entity biến động dùng `row_version` (int)
  hoặc `ETag`; `PUT/PATCH` gửi `If-Match`/`row_version`; lệch → `409 STALE_WRITE`.
- **Idempotency**: mọi endpoint ghi sổ / phát sinh giao dịch nhạy cảm nhận header
  `Idempotency-Key`; module `idempotency` hiện có bảo đảm không sinh trùng.
- **Correlation**: header `X-Correlation-Id` (có → dùng lại, không → sinh). Ghi vào audit + log.
- **Thời điểm**: mọi truy vấn "tại thời điểm" nhận `as_of_time` (ISO-8601, timezone thống nhất
  `Asia/Ho_Chi_Minh`). Trả kèm `as_of_time`, `scope`, `source` (snapshot/ledger), `locked`.
- **OpenAPI**: Swagger tự sinh; **contract test** trong CI (Sprint 0) phát hiện breaking change.
- Versioned API: thay đổi phá vỡ hợp đồng → `/api/v2` hoặc field mới, không sửa ngầm.

## 2. Danh mục mã lỗi nghiệp vụ (business error codes)

Dùng chung, `SCREAMING_SNAKE_CASE`, trả trong `problem.code`. Bổ sung theo phân hệ nhưng giữ tiền tố.

| Mã | HTTP | Ý nghĩa | Phân hệ |
| --- | --- | --- | --- |
| `NO_RULE` | 422 | Không có định mức/quy định áp dụng (KHÔNG tự coi = 0) | DT-07, DT-08 |
| `RULE_CONFLICT` | 409 | Nhiều norm ngang ưu tiên, chưa giải quyết | DT-07, DT-08 |
| `NO_HC_SNAPSHOT` | 422 | Không lấy được HC tại thời điểm | DT-08 |
| `INSUFFICIENT_STOCK` | 409 | Xuất/giảm làm tồn âm | DT-04, DT-05 |
| `PERIOD_LOCKED` | 409 | Ghi vào kỳ đã khóa | DT-05, DT-10 |
| `ASSET_LOCKED` | 409 | Tài sản đang khóa/reserved | DT-05, DT-06 |
| `INVALID_LOCATION` | 422 | Kho/vị trí không thuộc phạm vi | DT-04, DT-05 |
| `DUPLICATE_POST` | 409 | POST lặp cùng idempotency-key | DT-05 |
| `STALE_WRITE` | 409 | Optimistic lock lệch phiên bản | Toàn hệ thống |
| `SOURCE_CHANGED` | 409 | Nguồn thay đổi giữa xem và giữ | DT-09 |
| `INSUFFICIENT_FREE_SOURCE` | 409 | Giữ nguồn vượt khả dụng (overbooking) | DT-09 |
| `OVER_ALLOCATED` | 422 | Tổng phân bổ/nguồn vượt HC/nhu cầu | DT-06, DT-09 |
| `UNIT_MISMATCH` | 422 | ĐVT không tương thích, không có quy tắc quy đổi | Toàn hệ thống |
| `QUALITY_TOTAL_MISMATCH` | 422 | Σ cấp chất lượng ≠ tổng số | DT-04, DT-10, DT-11 |
| `NO_OFFICIAL_SNAPSHOT` | 422 | Chưa có snapshot chính thức của kỳ | DT-11 |
| `DATA_CONTRACT_MISMATCH` | 422 | Nguồn không khớp schema dataset | DT-11 |
| `MISSING_SUBMISSION` | 200* | Đơn vị con chưa gửi (không tính = 0) | DT-11, DT-12 |
| `LOCKED_IMMUTABLE` | 409 | Sửa bản ghi đã khóa (snapshot/issued) | DT-04/08/10/11 |
| `NO_PERMISSION_SCOPE` | 403 | Vượt phạm vi dữ liệu được giao | Toàn hệ thống |

## 3. Quy ước trạng thái (state machine) & enum dùng chung

- **Danh mục/phiên bản**: `DRAFT → VALIDATED → PUBLISHED → SUPERSEDED → ARCHIVED`.
- **Chứng từ giao dịch**: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → POSTED → REVERSED`
  (nhánh `RETURNED`, `REJECTED`, `CANCELLED`).
- **Phương án/scenario**: `DRAFT → VALIDATING → READY → RUNNING → CALCULATED → SUBMITTED →
  UNDER_REVIEW → APPROVED → LOCKED → SUPERSEDED → ARCHIVED`.
- **Xác minh dữ liệu**: `UNVERIFIED → PARTIAL → VERIFIED → EXPIRED / REJECTED`.
- **Cảnh báo**: `OPEN → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED` (+`ESCALATED`).
- **Chất lượng vật chất**: Cấp 1..5 (`C1..C5`).
- Enum khai báo tập trung (TS `enum` + kiểm tra migration), **không hard-code** chuỗi rời rạc.

## 4. Quy ước dữ liệu vật lý (data dictionary chuẩn)

Mỗi bảng nghiệp vụ có tối thiểu:

| Trường | Kiểu | Bắt buộc |
| --- | --- | --- |
| `id` | UUID (pk) | ✔ |
| `created_at` / `updated_at` | timestamptz | ✔ |
| `created_by` / `updated_by` | UUID | ✔ |
| `row_version` | int (optimistic lock) | ✔ (entity biến động) |
| `status` | enum | khi có vòng đời |
| `effective_from` / `effective_to` | date/timestamptz | khi có yếu tố thời gian (SYS-BR-07) |
| `source_document_id` / `basis_reference` | UUID/text | khi có căn cứ |

- Số lượng: `numeric(18,3)`; giá trị/tiền: `numeric(18,2)`; diện tích: `numeric(18,2) m²`.
- **Soft-delete/inactive**: không xóa cứng bản ghi đã phát sinh giao dịch/tham chiếu;
  dùng `status = INACTIVE/CLOSED/SUPERSEDED`.
- **Bất biến**: bản ghi `POSTED/LOCKED/ISSUED/official snapshot` không `UPDATE/DELETE` qua
  nghiệp vụ thường; sai → tạo `reversal/adjustment/revision`.
- **Hash/checksum**: file nghiệp vụ & snapshot phát hành lưu `sha256`.
- **Khóa tự nhiên**: mã nghiệp vụ (`*_code`) UNIQUE trong phạm vi (version/đơn vị/năm) theo quy tắc.
- **Index tối thiểu**: theo `(scope) + (material) + (time)` và theo trạng thái cho hàng đợi công việc.

## 5. Quy ước module & migration (NestJS/TypeORM)

- Mỗi phân hệ mới hoặc mở rộng đặt trong `backend/src/modules/<domain>/`:
  `entities/`, `dto/`, `<name>.service.ts`, `<name>.controller.ts`, `<name>.module.ts`, `<name>.spec.ts`.
- **Migration**: mỗi thay đổi schema = 1 migration có version (timestamp), reversible (`up`/`down`),
  bật extension khi cần (`postgis`, `uuid-ossp`). Không sửa migration đã merge; thêm migration mới.
- **Seed**: dùng script `backend/src/database/seeds/seed-*.ts` + npm script tương ứng.
  Dữ liệu golden dataset lấy từ `docs/thu-thap-csdl/`.
- **Data-scope**: mọi service query áp `dataScopes` (đơn vị/địa bàn/nhiệm vụ) từ token — không
  tin `organization_id` trong request body (SYS-BR-08).
- Webapp: trang trong `webapp/src/pages/`, gọi API qua `lib` + react-query, tái dùng design tokens
  "Command Data System"; không đặt business rule quyết định ở frontend.

## 6. Ma trận truy vết (bắt buộc mỗi phân hệ)

Cột chuẩn: **C3 → Use Case → Entity/CSDL → API → Screen → Test Case**.
- Mã **C3** theo quyển gốc: `DT-xx.yy.zz`.
- Mã **UC**: `UC-DTxx-nn`. Mã **BR**: `BR-DTxx-nnn`. Mã **Test**: `TC-DTxx-nnn`. Mã **Screen**: `SCR-DTxx-nn`.
- Mỗi file prompt kết thúc bằng bảng ma trận truy vết. Sau khi làm xong cập nhật trạng thái.

## 7. Definition of Done (DoD) — mẫu áp cho mọi phân hệ

Một phân hệ **PASS** khi:

- [ ] Entity + migration (reversible) + index theo quy ước §4; không phá dữ liệu cũ.
- [ ] Seed/golden dataset đủ để demo chuỗi nghiệp vụ.
- [ ] API đủ theo bảng thiết kế; Swagger cập nhật; problem+json + mã lỗi §2.
- [ ] Áp đủ Business Rule bắt buộc (bảng BR trong prompt); các quy tắc bất biến SYS-BR-01..08.
- [ ] Data-scope + RBAC đúng phạm vi; audit append-only cho thao tác thay đổi/duyệt/khóa.
- [ ] Webapp: màn hình theo thiết kế, state loading/error/empty/permission; không chứa business rule.
- [ ] Test: unit domain rule + ≥1 chuỗi E2E theo "chuỗi nghiệm thu" của quyển; tất cả PASS.
- [ ] Ma trận truy vết C3→…→Test cập nhật; ROADMAP + `01-DOI-CHIEU-GAP.md` cập nhật cột hiện trạng.
- [ ] Không hồi quy: `cd backend && npm test` xanh; e2e webapp luồng liên quan xanh.
- [ ] Commit `feat(DT-xx): …` (+ migration, seed, docs) — không lẫn nhiều phân hệ trong 1 commit lớn.

## 8. Semantic layer — thuật ngữ chuẩn (chống nhầm khái niệm)

Dùng thống nhất tên chỉ tiêu; **không** dùng tên gần giống chỉ khái niệm khác (đặc biệt DT-06/07/08/12):

| Mã ngữ nghĩa | Định nghĩa | Nguồn |
| --- | --- | --- |
| `SEM-HC` | Hiện có tại thời điểm/snapshot | DT-04/10 |
| `SEM-HC-AVAILABLE` | HC đủ điều kiện khả dụng (loại chờ xử lý/khóa) — **chỉ tiêu hỗ trợ**, không thay HC | DT-04 + rule |
| `SEM-RESERVE-SSCD` | Lượng phân bổ dự trữ SSCĐ (nhãn allocation) | DT-06 |
| `SEM-PC-SCD` | "Phải có sau chiến đấu" trong công thức NC — **khác** RESERVE-SSCD | DT-07/08 |
| `SEM-NC` | `TT_GĐCB + TT_GĐCĐ + PC_SSCĐ − HC` (giữ dấu, kể cả âm) | DT-08 |
| `SEM-SUPPLY-REQUIRED` | `max(NC,0)` — dẫn xuất, không thay NC | DT-08/09 |
| `SEM-PLANNED-SOURCE` | Tổng nguồn đã đưa vào phương án | DT-09 |
| `SEM-GAP` | `SupplyRequired − PlannedSource` | DT-09 |

## 9. Kiểm thử

- **Unit (Jest)** cho domain rule/công thức/state transition/validation: `cd backend && npm test`.
- **Integration** cho transaction, DB constraint, API contract, workflow, file storage.
- **E2E (Playwright)** luồng nghiệp vụ webapp: `cd webapp && BACKEND_ORIGIN=http://localhost:<port> npm run e2e`.
- **Migration/reconciliation test** với golden dataset (`docs/thu-thap-csdl/`, 01/KK…, 01–06/KKDT).
- Mỗi prompt phân hệ liệt kê test case cốt lõi `TC-DTxx-*`; đạt hết mới PASS DoD.
- Tham chiếu `docs/testing-automation.md`, `docs/CHECKLIST-FE-BE-SYNC.md`.

## 10. Vận hành (khởi động instance dev :8100)

```
npm run dev2:infra      # postgres 5436, redis 6381, minio 9006/9007, adminer 8083
npm run dev2:backend    # native hot-reload, backend :3100
npm run dev2:webapp     # webapp :8100
# lần đầu:  npm run dev2:seed
# đăng nhập demo: admin / admin@123
```
Backend/webapp chạy native hot-reload; CSDL/volume riêng, độc lập stack :8000.
Migration: `cd backend && npm run migration:generate -- <name>` → `npm run migration:run`.

## 11. Quản lý thay đổi (change control)

- Thay đổi ảnh hưởng C3/BR/schema/API contract/biểu mẫu/công thức → **Change Request**,
  ghi rõ phân hệ ảnh hưởng, migration dữ liệu, tương thích API, test cần cập nhật, tác động ma trận truy vết.
- Không sửa riêng code mà không cập nhật baseline thiết kế + `01-DOI-CHIEU-GAP.md`.
- Trạng thái baseline: `DRAFT → REVIEW → APPROVED → BASELINED → SUPERSEDED`.
