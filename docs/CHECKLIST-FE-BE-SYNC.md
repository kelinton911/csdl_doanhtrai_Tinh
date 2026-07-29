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

## Kiểm thử end-to-end
- [x] T1 — Chạy BE (đọc cổng thật) + FE (5173), đăng nhập `admin/admin@123`
- [x] T2 — Gán role/scope cho `xa01` → đăng nhập lại kiểm data-scope (chỉ thấy xã A01)
- [x] T3 — Import 1 CSV materials có dòng lỗi → validation → commit → thấy trong Vật chất
- [x] T4 — Thêm/sửa/decommission công trình; tạo kho + xem sổ kho sau nhập/xuất
- [x] T5 — Tạo & mở đợt kiểm kê; so sánh phương án; search-within; chi tiết audit
- [x] T6 — Không hồi quy nghiệp vụ bất biến: no-edit-approved (409), tách nhiệm vụ (403), tồn âm (INV-001)
- [~] T7 — Backend Jest 8/8 PASS (data-scope + no-edit-approved/self-approve). Playwright UI e2e CHƯA chạy; thay bằng e2e mức API-contract (curl khớp body FE) đã đạt.
