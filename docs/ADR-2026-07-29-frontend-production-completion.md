# ADR-2026-07-29 — Hoàn thiện Frontend lên chuẩn production

- **Trạng thái:** Đã áp dụng (FE) · **BE-1…BE-8 ĐÃ BỔ SUNG cùng ngày** (migration `FeatureUnlock1753000012000`, FE đã nối — xem bảng cập nhật bên dưới và `CHECKLIST-FE-BE-SYNC.md`)
- **Bối cảnh:** SPA `webapp/` đã nối phần lõi tới 95 endpoint BE. Đối chiếu FE ↔ BE ↔ hồ sơ thiết kế Frontend cho thấy khoảng thiếu về độ phủ UX so với chuẩn "production theo thiết kế". Đợt này bổ sung 4 nhóm: nối nốt chức năng, chiều sâu từng màn, khung UX xuyên suốt, chuẩn hóa & an toàn.

## Quyết định

Triển khai theo 6 pha (chi tiết trong `docs/CHECKLIST-FE-BE-SYNC.md`, mục "Đợt hoàn thiện production FE"):

1. **Khung UX xuyên suốt:** hệ thống toast (external store, gọi được trong mutation), responsive (breakpoint 768/1024 + sidebar drawer mobile), `@media print` cho báo cáo/hồ sơ, trung tâm cảnh báo dạng dropdown với hành động Nhận/Đóng.
2. **Nối nốt chức năng:** sửa hồ sơ nháp doanh trại (`PUT /barracks/:id`), đính kèm tài liệu (`EvidenceDrawer`) ở kiểm kê/sửa chữa/hư hỏng/công trình, dashboard drill-down + widget bản đồ Leaflet + "Duyệt báo cáo cho chỉ huy", đồng bộ offline gửi lô (`POST /sync/batches`) + giải quyết xung đột phiên bản.
3. **Chiều sâu màn (A):** Reports polling job + xem trước PDF + tiến độ; Alerts đóng bằng modal + cảnh báo quá hạn SLA; Admin phân trang audit + tìm user + data-scope `ORGANIZATION`.
4. **Chiều sâu màn (B):** hồ sơ doanh trại đủ tab (Vật chất/Pháp lý/Sửa chữa); Scenario validate tham số + phân tích what-if (độ nhạy).
5. **Chuẩn hóa & an toàn:** WCAG 2.2 (skip-link, Modal `role=dialog`+Esc+aria, aria-label nút icon), Login gỡ credentials demo ở PROD (`import.meta.env.DEV`) + chỉ báo khóa tài khoản (423/429), toast riêng cho 409 xung đột.

**Nguyên tắc bất biến giữ nguyên:** không tự bịa API; tái dùng component sẵn có (`Modal`, `EvidenceDrawer`, `DataTable`, `Pagination`, `States`, `StatusBadge`); không đổi nghiệp vụ bất biến (no-edit-approved, tách nhiệm vụ, tồn âm, append-only).

## Hệ quả — khoảng thiếu BE (ĐÃ BỔ SUNG 2026-07-29, không làm giả ở FE)

Cả 8 mục đã hiện thực ở BE (migration `FeatureUnlock1753000012000`: cột `users.mfa_secret`, `users.locked_until`, `maintenance_requests.assignee_name`, bảng `material_versions`) và nối FE, kiểm chứng bằng smoke test qua API sống:

| Mã | Giải pháp đã áp dụng | Kiểm chứng |
| --- | --- | --- |
| BE-1 | `POST /inspection-campaigns/:id/close`; FE nút "Đóng đợt" | open→close trả `CLOSED` |
| BE-2 | `GET /dashboard/summary?mode=NORMAL·SSCD·SCENARIO` (SSCĐ: issue sẵn sàng chiến đấu; SCENARIO: gộp thiệt hại mô phỏng); FE gửi mode thật | mode=SCENARIO trả issue mô phỏng |
| BE-3 | TOTP RFC 6238 tự hiện thực (`identity/totp.ts`, Node crypto, không thêm dep); `otp` trong login; `POST /auth/mfa/enroll·disable`; khóa 15' sau 5 lần sai (423); FE ô OTP + modal shield | enroll → 401 AUTH-005 → 200 với mã TOTP tính độc lập |
| BE-4 | `format=word` xuất RTF Unicode (Word mở trực tiếp, không thêm dep); FE nút WORD | job COMPLETED, tệp `{\rtf1...` |
| BE-5 | Bảng `material_versions` snapshot CREATE/UPDATE/PUBLISH + `GET /materials/:id/versions`; FE modal diff trường | 2 bản ghi (CREATE, PUBLISH) |
| BE-6 | `POST /users/:id/reset-password` (reset + mở khóa); FE mục Bảo mật | ok=true |
| BE-7 | `GET /facilities` toàn hệ thống kèm `barracksName`; FE bộ chọn scope FACILITY | 191 công trình |
| BE-8 | `assigneeName` trong Create/Start DTO + cột DB; FE ô KTV ở tạo/chi tiết | lưu đúng với vai trò BARRACKS_OFFICER |

## Kiểm chứng

- `cd webapp && npx tsc --noEmit` → PASS.
- `cd webapp && npm run build` (tsc + vite build) → PASS (217 modules).
- Kiểm thử chạy thật (đăng nhập, các luồng mới) — xem mục "Kiểm thử end-to-end" trong checklist.
