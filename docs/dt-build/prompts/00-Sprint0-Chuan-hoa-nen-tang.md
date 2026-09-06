# PROMPT — Sprint 0: Chuẩn hóa thiết kế & hoàn thiện nền tảng

> **Vai trò khi thực thi:** Bạn là kỹ sư nền tảng. Mục tiêu Sprint 0 là *đóng băng quy ước*
> và *hoàn thiện các dịch vụ nền dùng chung* để mọi phân hệ DT-01…DT-12 build trên nền nhất quán.
> **Đọc trước:** `00-README.md`, `01-DOI-CHIEU-GAP.md`, `02-QUY-UOC-CHUNG.md`.
> **Nguồn thiết kế:** Master `MASTER-DT-2026` §IX–XVI, §XVI (gap Sprint 0).

## 1. Mục tiêu

- Chốt convention (API, error, enum, trạng thái, data dictionary, C3, DoD, semantic) — đã soạn ở `02-QUY-UOC-CHUNG.md`; nhiệm vụ là **hiện thực hóa** thành code/dùng được, không để trên giấy.
- Hoàn thiện nền: IAM/RBAC + **data-scope row-level**, Audit append-only, Idempotency, Storage/MinIO, correlation-id, problem+json, health, outbox (khởi tạo).
- Thiết lập **C3 catalog** + khung ma trận truy vết vận hành.

## 2. Đối chiếu hiện trạng

Đã có: `identity`, `rbac`, `audit`, `idempotency`, `digital-signature`, `storage`, `queue`, `health`,
global prefix `/api/v1`, Swagger, problem+json cơ bản.

## 3. GAP phải làm (backend)

| # | Việc | Chi tiết | DoD phụ |
| --- | --- | --- | --- |
| 1 | **Enum & error-code tập trung** | `common/enums/*.ts` (trạng thái §3), `common/errors/business-error.ts` (bảng §2 tài liệu quy ước) + `BusinessException(code, http, detail)` | Ném lỗi ra problem+json đúng `code` |
| 2 | **Data-scope guard toàn cục** | `DataScopeGuard` + decorator `@Scoped('organization'|'area'|'mission')`; service nhận `ScopeContext` từ token; chặn body ghi đè `organization_id` | Test: user xã A không đọc/ghi dữ liệu xã B |
| 3 | **Base entity + optimistic lock** | `AbstractEntity` (id UUID, created/updated + by, `@VersionColumn row_version`); interceptor `If-Match`→`409 STALE_WRITE` | Test lệch version → 409 |
| 4 | **Audit append-only chuẩn** | interceptor ghi `who/when/action/entity/old/new/reason/source/correlation` cho mọi POST/PUT/PATCH/DELETE + hành động duyệt/khóa/reversal | Không thao tác thay đổi nào thiếu audit |
| 5 | **As-of & effective-time helper** | util `resolveAsOf(as_of_time)`, chuẩn timezone `Asia/Ho_Chi_Minh`; response wrapper kèm `as_of_time/scope/source/locked` | DT-04/08/10 tái dùng |
| 6 | **Idempotency mở rộng** | áp cho mọi endpoint ghi sổ; trả kết quả lần đầu khi trùng key | Test POST 2 lần → 1 kết quả |
| 7 | **Outbox pattern (khởi tạo)** | bảng `outbox_event` + dispatcher qua `queue`/Redis; publish domain event (dùng cho DT-12 refresh, DT-06 chặn HC) | Ghi outbox trong cùng transaction |
| 8 | **OpenAPI contract test (CI)** | snapshot OpenAPI + test phát hiện breaking change | CI đỏ khi đổi hợp đồng ngầm |
| 9 | **C3 catalog** | bảng/seed `c3_catalog` (mã C3, tên, phân hệ, UC, BR, screen) + endpoint tra cứu phục vụ ma trận truy vết | Import mã C3 12 quyển |

## 4. Business Rule bắt buộc (SYS-BR)

Áp dụng cơ chế cưỡng chế cho toàn bộ SYS-BR-01…08 (xem `00-README.md §6`). Đặc biệt:
- SYS-BR-02: không endpoint nào cho phép sửa số dư trực tiếp.
- SYS-BR-07: mọi entity thời gian có effective_time/version.
- SYS-BR-08: quyền = chức năng ∧ phạm vi (DataScopeGuard).

## 5. Việc webapp

- Chuẩn hóa `lib/api` (interceptor gắn correlation-id, xử lý problem+json → toast/i18n mã lỗi).
- Component chuẩn: trạng thái `loading/error/empty/permission`, badge trạng thái (enum §3), hiển thị `as_of_time`/độ tươi.
- Guard route theo RBAC + scope.

## 6. Test / nghiệm thu

| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-S0-001 | User ngoài phạm vi gọi API đơn vị khác | 403 `NO_PERMISSION_SCOPE` |
| TC-S0-002 | PUT lệch `row_version` | 409 `STALE_WRITE` |
| TC-S0-003 | POST ghi sổ lặp idempotency-key | 1 kết quả, không sinh trùng |
| TC-S0-004 | Thao tác thay đổi bất kỳ | có bản ghi audit đầy đủ |
| TC-S0-005 | Đổi hợp đồng API ngầm | CI contract test đỏ |
| TC-S0-006 | Ném BusinessException | response problem+json đúng `code`/`status` |

## 7. Definition of Done

- [ ] Enum/error-code/trạng thái/semantic đã thành code dùng chung, không hard-code rời rạc.
- [ ] DataScopeGuard áp toàn cục; test scope PASS.
- [ ] AbstractEntity + optimistic lock + audit append-only phủ mọi module hiện có (migration bổ sung `row_version` nơi thiếu).
- [ ] As-of helper + response wrapper sẵn sàng cho DT-04/08/10.
- [ ] Outbox khởi tạo + dispatcher chạy.
- [ ] OpenAPI contract test trong CI.
- [ ] `c3_catalog` seed đủ mã C3 của 12 quyển.
- [ ] `backend npm test` xanh; cập nhật `01-DOI-CHIEU-GAP.md` (Nền tảng) + ROADMAP.
- [ ] Commit `chore(sprint0): chuẩn hóa nền tảng & quy ước`.

## 8. Ma trận truy vết (khởi tạo)

| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| SYS-BR-08 | — | data-scope | (guard) | route guard | TC-S0-001 |
| SYS-BR-02/03 | — | AbstractEntity/audit | interceptor | — | TC-S0-002/004 |
| §XVI Sprint0 | — | c3_catalog | `/c3-catalog` | — | — |

> **Chỉ mở DT-01 khi Sprint 0 DoD = PASS.**
