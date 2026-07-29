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

## Bổ sung 2026-07-29 — Hoàn thiện tiếp (WS1–WS4)

Sau khi đối chiếu 1-1 xác nhận độ phủ FE↔BE gần trọn vẹn (mọi module có UI thật, không còn màn `Placeholder`,
không TODO/mock; các endpoint "chưa gọi" chỉ là GET chi tiết đơn lẻ FE thay bằng dữ liệu list), đợt này đóng
khoảng trống chất lượng/kiểm chứng/PROD:

- **WS1 — Kiểm chứng E2E xanh:** chạy `npm run verify:e2e` (stack sống trong container: db ephemeral + minio +
  backend migrate+seed + Playwright). Quan sát **5/5 luồng PASS** ("5 passed", "E2E PASS") → cập nhật T7 `[~]`→`[x]`.
  Chạy lại sau WS2–WS4 để chống hồi quy.
- **WS2 — Vá lỗi FE:** bộ chọn "Phạm vi dữ liệu" ở topbar vốn là control trang trí (không `onChange`) → thay bằng
  **chip read-only** phản ánh phạm vi thật của tài khoản. Thêm `webapp/src/lib/scope.ts` (mirror hằng
  `PROVINCE_WIDE` của `backend/src/common/data-scope.ts`); BE bổ sung `dataScopes` vào profile login/refresh
  (additive, không đổi nghiệp vụ — lọc vẫn thực thi ở server). Xóa dead code `pages/Placeholder.tsx`.
- **WS3 — PROD-readiness FE:** `lib/mapConfig.ts` đọc `VITE_TILE_URL`/`VITE_TILE_ATTRIBUTION` (mặc định OSM cho
  DEV; PROD trỏ tile server nội bộ — ROADMAP §5.2), thay 2 `TileLayer` (Map + Dashboard); thêm `webapp/.env.example`
  + ghi chú README; hardening Vite build: `sourcemap:false`, `manualChunks` tách leaflet/charts.
- **WS4 — Độ sâu UX:** modal chi tiết sửa chữa dùng `GET /maintenance-requests/:id` khi mở (query cache là nguồn
  duy nhất; action ghi thẳng vào cache → luôn hiển thị trạng thái mới nhất); tiện ích `lib/csv.ts` (BOM UTF-8) +
  nút **Xuất CSV** trên Vật chất/Doanh trại/Tồn kho (xuất toàn bộ kết quả đang lọc; không thay module Báo cáo snapshot).

**Kiểm chứng bổ sung:** `webapp tsc --noEmit` PASS · `webapp npm run build` PASS (**221 modules**; chia chunk
leaflet 289KB / charts 182KB / index 310KB) · `backend tsc --noEmit` PASS · e2e 5/5 PASS (WS1).
