# Checklist đồng bộ Frontend ↔ Backend

> Nguồn theo dõi tiến độ cho đợt rà soát đồng bộ FE↔BE (2026-07-29).
> Đối chiếu 1-1 giữa lời gọi API thực của `webapp/` và ~70 REST endpoint của `backend/` (M01–M15).
> Quy ước: `[x]` = đã nối + đã quan sát chạy đúng · `[~]` = đã code, chưa kiểm thử · `[ ]` = chưa làm.

## Bối cảnh
Backend đã hoàn thiện 15 module (M01–M15). Frontend `webapp/` đã nối phần lõi (auth, barracks, inventory nhập/xuất, inspection, maintenance, alerts, scenario run, reports, documents, GIS features, dashboard, search, master-data tạo/publish, users list/create, audit list). Đợt này bổ sung các endpoint BE **đã có** nhưng FE **chưa có màn hình/chưa nối**.

## Nhóm A — Quản trị User: vai trò & phạm vi dữ liệu (M01)
- [x] A1 — Xem/sửa tài khoản: `GET /users/:id`, `PUT /users/:id`
- [x] A2 — Gán vai trò: `POST /users/:id/roles`
- [x] A3 — Gán phạm vi dữ liệu (data-scope, type=`AREA`): `POST /users/:id/scopes`

## Nhóm B — Tích hợp & Đồng bộ (M14)
- [x] B1 — Import CSV: `POST /imports` → `GET /imports/:id/validation` → `POST /imports/:id/commit`
- [~] B2 — Đồng bộ offline: `POST /sync/batches`, `GET /sync/batches/:id`

## Nhóm C — Vật chất, Công trình, Kho & Sổ kho (M03/M05/M06)
- [x] C1 — Màn Vật chất: `GET /materials`, `GET /materials/:id`, `POST /materials`, `PUT /materials/:id`, `POST /materials/:id/publish`
- [x] C2 — Sửa mục danh mục: `PUT /master-data/:type/:id`
- [x] C3 — Công trình CRUD: `POST /barracks/:id/facilities`, `PUT /facilities/:id`, `POST /facilities/:id/decommission`
- [x] C4 — Tạo kho: `POST /inventory/storage-locations`
- [x] C5 — Sổ kho bất biến: `GET /inventory/transactions`

## Nhóm D — Rà soát enum trạng thái (đã cơ bản khớp)
- [x] D1 — Rà soát so sánh `status===` hardcode trong `webapp/src/pages/`, đảm bảo đúng bộ enum theo module (barracks: `DRAFT/PENDING_REVIEW/CHANGES_REQUESTED/APPROVED`; inspection sheet: `DRAFT/SUBMITTED/NEEDS_REVISION/APPROVED`; facility: `IN_USE/DECOMMISSIONED`)
- [x] D2 — Bổ sung nhãn còn thiếu trong `StatusBadge.tsx`/`charts.ts` nếu có

## Nhóm E — Khoảng lệch còn lại
- [x] E1 — Quản trị đơn vị & xã/phường: `POST /organizations`, `PUT /organizations/:id`, `POST /administrative-areas`
- [x] E2 — Tạo & mở đợt kiểm kê: `POST /inspection-campaigns`, `POST /inspection-campaigns/:id/open`
- [x] E3 — Sửa sự kiện hư hỏng: `PUT /damage-events/:id`
- [x] E4 — Tình huống: `GET /scenarios`, `GET /scenarios/:id/runs`, `GET /scenario-runs/:id`, `POST /plans/compare`
- [x] E5 — GIS truy vấn bán kính: `POST /gis/search-within`
- [x] E6 — Chi tiết nhật ký: `GET /audit-logs/:id`

## Đợt hoàn thiện production FE (2026-07-29, pha 1–6)
Nâng FE lên chuẩn production theo hồ sơ thiết kế trên 4 nhóm. Trạng thái: `[x]` đã code + tsc/build PASS.
- [x] P1 — Khung UX: hệ thống toast (`lib/toast.tsx`, `components/Toast.tsx`), responsive 768/1024 + drawer mobile, `@media print` + nút In, trung tâm cảnh báo (dropdown + `AlertCloseModal` tái dùng).
- [x] P2 — Sửa hồ sơ nháp doanh trại `PUT /barracks/:id` (route `/barracks/:id/edit`); đính kèm `EvidenceDrawer` cho kiểm kê/sửa chữa/hư hỏng/công trình; dashboard drill-down + widget bản đồ + "Duyệt báo cáo cho chỉ huy"; đồng bộ offline `POST /sync/batches` + giải quyết xung đột.
- [x] P3 — Reports polling/preview PDF/tiến độ; Alerts đóng bằng modal + SLA quá hạn; Admin phân trang audit + tìm user + scope `ORGANIZATION` + toasts.
- [x] P4 — Hồ sơ doanh trại đủ tab (Vật chất/Pháp lý/Sửa chữa) + nút In; Scenario validate tham số + what-if độ nhạy.
- [x] P5 — A11y WCAG: skip-link, Modal role=dialog + Esc + aria-labelledby, aria-label nút icon, focus ring; Login gỡ credentials demo ở PROD (`import.meta.env.DEV`) + chỉ báo khóa 423/429; toast 409 xung đột.
- [x] P6 — Cập nhật checklist + ADR (ghi các khoảng thiếu BE), `tsc --noEmit` PASS, `vite build` PASS (217 modules).

### Khoảng thiếu backend — ĐÃ BỔ SUNG (2026-07-29, migration `FeatureUnlock1753000012000`, nối FE xong)
- [x] BE-1 — `POST /inspection-campaigns/:id/close` (đóng đợt từ OPEN/IN_PROGRESS/SUBMITTED/RECONCILED); FE nút "Đóng đợt" ở InspectionPage. Smoke: open→close → `CLOSED`.
- [x] BE-2 — `GET /dashboard/summary?mode=NORMAL|SSCD|SCENARIO`: SSCĐ thêm issue "chưa sẵn sàng chiến đấu", SCENARIO gộp thiệt hại mô phỏng (scenario=true); FE gửi mode thật + banner giải thích. Smoke: mode=SCENARIO trả issue mô phỏng.
- [x] BE-3 — OTP TOTP (RFC 6238, tự hiện thực bằng Node crypto — `identity/totp.ts`, không thêm dependency): `otp` trong LoginDto, `POST /auth/mfa/enroll|disable`; khóa tạm 15 phút sau 5 lần sai (423). FE: ô OTP hiện khi AUTH-005/006, modal bật/tắt OTP ở AppShell (icon shield). Smoke: enroll → login không OTP 401 AUTH-005 → login với mã TOTP tính độc lập bằng Python → 200.
- [x] BE-4 — `format=word` cho `/reports/jobs` (RTF `application/rtf`, Unicode tiếng Việt, Word mở trực tiếp — không thêm dependency); FE thêm nút WORD. Smoke: tạo job word COMPLETED, tệp `{\rtf1\ansi...` 8.3KB.
- [x] BE-5 — Bảng `material_versions` (snapshot bất biến khi CREATE/UPDATE/PUBLISH) + `GET /materials/:id/versions`; FE modal lịch sử phiên bản + diff trường (gạch đỏ → xanh). Smoke: create→publish cho 2 bản ghi (1,CREATE),(2,PUBLISH).
- [x] BE-6 — `POST /users/:id/reset-password` (đặt lại + xóa failedAttempts + mở khóa); FE mục "Bảo mật" trong modal quản lý tài khoản. Smoke: ok=true.
- [x] BE-7 — `GET /facilities` toàn hệ thống (kèm `barracksName`, lọc `barracksId`/`search`); FE bộ chọn scope `FACILITY` trong Admin (cùng AREA/ORGANIZATION). Smoke: 191 công trình, đủ trường.
- [x] BE-8 — Cột `assignee_name` + `assigneeName` trong Create/Start DTO (phân công khi lập hoặc khi bắt đầu thực hiện); FE ô nhập KTV ở modal tạo + modal chi tiết (trạng thái APPROVED). Smoke: tạo với vai trò BARRACKS_OFFICER → assigneeName lưu đúng (admin bị 403 là đúng RBAC).

> Ghi chú hạ tầng (không thuộc 8 mục): URL presigned MinIO trả host nội bộ `minio:9000` — tải tệp từ ngoài docker network cần map lại host (ảnh hưởng mọi định dạng, đã có từ trước).

## Kiểm thử end-to-end
- [x] T1 — Chạy BE (đọc cổng thật) + FE (5173), đăng nhập `admin/admin@123`
- [x] T2 — Gán role/scope cho `xa01` → đăng nhập lại kiểm data-scope (chỉ thấy xã A01)
- [x] T3 — Import 1 CSV materials có dòng lỗi → validation → commit → thấy trong Vật chất
- [x] T4 — Thêm/sửa/decommission công trình; tạo kho + xem sổ kho sau nhập/xuất
- [x] T5 — Tạo & mở đợt kiểm kê; so sánh phương án; search-within; chi tiết audit
- [x] T6 — Không hồi quy nghiệp vụ bất biến: no-edit-approved (409), tách nhiệm vụ (403), tồn âm (INV-001)
- [x] T7 — Backend Jest 8/8 PASS (data-scope + no-edit-approved/self-approve). **Playwright UI e2e 5/5 PASS** — quan sát qua stack sống trong container (`npm run verify:e2e`: db ephemeral + minio + backend migrate+seed + Playwright). Log: "5 passed (7.0s)" · "E2E PASS (5 luồng nghiệp vụ)". Đã thay thế e2e mức API-contract tạm thời.

## Đợt hoàn thiện tiếp Frontend (2026-07-29, WS1–WS4)
Sau khi xác nhận độ phủ FE↔BE gần trọn vẹn, đợt này đóng khoảng trống chất lượng/kiểm chứng/PROD. Trạng thái: `[x]` = đã code + tsc/build PASS + (WS1) quan sát e2e xanh.
- [x] WS1 — Kiểm chứng E2E xanh: chạy `npm run verify:e2e`, quan sát **5/5 luồng PASS** qua stack sống (đóng T7). Chạy lại sau các sửa đổi WS2–WS4 để chống hồi quy.
- [x] WS2 — Vá lỗi FE: thay bộ chọn "Phạm vi dữ liệu" ở topbar (control trang trí, không handler) bằng **chip read-only** hiển thị phạm vi thật của tài khoản (`lib/scope.ts` mirror `common/data-scope.ts`; BE bổ sung `dataScopes` vào profile login/refresh). Xóa dead code `pages/Placeholder.tsx`.
- [x] WS3 — PROD-readiness FE: tách lớp nền bản đồ ra `lib/mapConfig.ts` đọc `VITE_TILE_URL`/`VITE_TILE_ATTRIBUTION` (mặc định OSM; PROD trỏ tile nội bộ — ROADMAP §5.2); thêm `webapp/.env.example` + ghi chú README; hardening Vite build (`sourcemap:false`, `manualChunks` tách leaflet/charts → bundle chính 310KB, leaflet 289KB, charts 182KB).
- [x] WS4 — Độ sâu UX: modal chi tiết sửa chữa lấy bản mới nhất `GET /maintenance-requests/:id` khi mở (query cache là nguồn duy nhất, action ghi thẳng vào cache); tiện ích `lib/csv.ts` + nút **Xuất CSV** (BOM UTF-8) trên Vật chất/Doanh trại/Tồn kho, xuất toàn bộ kết quả đang lọc.

> Kiểm chứng: `cd webapp && npx tsc --noEmit` PASS · `npm run build` PASS (221 modules) · `cd backend && npx tsc --noEmit` PASS.
