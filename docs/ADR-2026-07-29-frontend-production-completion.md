# ADR-2026-07-29 — Hoàn thiện Frontend lên chuẩn production

- **Trạng thái:** Đã áp dụng (FE) · Chờ bổ sung BE (mục "Hệ quả / khoảng thiếu BE")
- **Bối cảnh:** SPA `webapp/` đã nối phần lõi tới 95 endpoint BE. Đối chiếu FE ↔ BE ↔ hồ sơ thiết kế Frontend cho thấy khoảng thiếu về độ phủ UX so với chuẩn "production theo thiết kế". Đợt này bổ sung 4 nhóm: nối nốt chức năng, chiều sâu từng màn, khung UX xuyên suốt, chuẩn hóa & an toàn.

## Quyết định

Triển khai theo 6 pha (chi tiết trong `docs/CHECKLIST-FE-BE-SYNC.md`, mục "Đợt hoàn thiện production FE"):

1. **Khung UX xuyên suốt:** hệ thống toast (external store, gọi được trong mutation), responsive (breakpoint 768/1024 + sidebar drawer mobile), `@media print` cho báo cáo/hồ sơ, trung tâm cảnh báo dạng dropdown với hành động Nhận/Đóng.
2. **Nối nốt chức năng:** sửa hồ sơ nháp doanh trại (`PUT /barracks/:id`), đính kèm tài liệu (`EvidenceDrawer`) ở kiểm kê/sửa chữa/hư hỏng/công trình, dashboard drill-down + widget bản đồ Leaflet + "Duyệt báo cáo cho chỉ huy", đồng bộ offline gửi lô (`POST /sync/batches`) + giải quyết xung đột phiên bản.
3. **Chiều sâu màn (A):** Reports polling job + xem trước PDF + tiến độ; Alerts đóng bằng modal + cảnh báo quá hạn SLA; Admin phân trang audit + tìm user + data-scope `ORGANIZATION`.
4. **Chiều sâu màn (B):** hồ sơ doanh trại đủ tab (Vật chất/Pháp lý/Sửa chữa); Scenario validate tham số + phân tích what-if (độ nhạy).
5. **Chuẩn hóa & an toàn:** WCAG 2.2 (skip-link, Modal `role=dialog`+Esc+aria, aria-label nút icon), Login gỡ credentials demo ở PROD (`import.meta.env.DEV`) + chỉ báo khóa tài khoản (423/429), toast riêng cho 409 xung đột.

**Nguyên tắc bất biến giữ nguyên:** không tự bịa API; tái dùng component sẵn có (`Modal`, `EvidenceDrawer`, `DataTable`, `Pagination`, `States`, `StatusBadge`); không đổi nghiệp vụ bất biến (no-edit-approved, tách nhiệm vụ, tồn âm, append-only).

## Hệ quả — khoảng thiếu BE cần bổ sung (không làm giả ở FE)

Các chức năng thiết kế yêu cầu nhưng **BE chưa có endpoint/trường**; FE đã hoãn (defer) hoặc để chế độ hiển thị, chờ BE:

| Mã | Khoảng thiếu | Vị trí BE | Đề xuất |
| --- | --- | --- | --- |
| BE-1 | Đóng đợt kiểm kê | `inspection.controller.ts` chỉ có `open` | Thêm `POST /inspection-campaigns/:id/close` |
| BE-2 | Tham số `mode` dashboard | `dashboard.controller.ts` `summary` không nhận query | Nhận `mode=NORMAL|SSCD|SCENARIO`, trả số liệu theo bối cảnh |
| BE-3 | OTP đăng nhập | `auth` không có OTP/MFA | Thêm bước OTP 6 số (thiết kế §1.1) |
| BE-4 | Word + bộ lọc báo cáo | `reporting.service.ts` chỉ `pdf\|excel` | Thêm `docx` + tham số khoảng thời gian/phạm vi |
| BE-5 | Lịch sử phiên bản & diff | materials không có `versions`; revisions doanh trại không kèm payload | Trả snapshot trường để FE diff |
| BE-6 | Reset mật khẩu | `UpdateUserDto` không có `password` | Thêm `POST /users/:id/reset-password` |
| BE-7 | Data-scope `FACILITY` | scope nhận freeform type (đã dùng AREA/ORGANIZATION) | Cần API liệt kê công trình toàn hệ thống để chọn |
| BE-8 | Phân công kỹ thuật viên sửa chữa | `CreateMaintenanceRequestDto` thiếu trường | Thêm `assigneeId` + endpoint gán |

## Kiểm chứng

- `cd webapp && npx tsc --noEmit` → PASS.
- `cd webapp && npm run build` (tsc + vite build) → PASS (217 modules).
- Kiểm thử chạy thật (đăng nhập, các luồng mới) — xem mục "Kiểm thử end-to-end" trong checklist.
