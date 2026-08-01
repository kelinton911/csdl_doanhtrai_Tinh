# ADR 2026-08-01 — Bổ sung schema: phân cấp chất lượng, đơn giá/giá trị, mục đích dự trữ, thuộc tính nhà, biến động kỳ kiểm kê

- Trạng thái: **Đã chấp nhận (triển khai increment 1)**
- Ngày: 2026-08-01
- Bối cảnh nguồn: phân tích dữ liệu thu thập Hải Phòng 2026 — xem
  [thu-thap-csdl/PHAN-TICH-DU-LIEU-THU-THAP.md](thu-thap-csdl/PHAN-TICH-DU-LIEU-THU-THAP.md) (mục 4: 6 khoảng trống).

## Vấn đề
Bộ biểu kiểm kê thật (01–06/KKDT, 01–03/KK, 02/KK-NHA) yêu cầu các chiều dữ liệu mà schema hiện
tại chưa mô hình hóa: (1) phân cấp chất lượng Cấp 1–5, (2) đơn giá/giá trị tồn (1000đ),
(3) mục đích dự trữ (6 loại KKDT), (4) thuộc tính nhà chi tiết, (5) biến động tăng/giảm theo kỳ.

## Quyết định
Bổ sung **thuần cộng thêm, tương thích ngược**: không sửa `stock_balances` lõi, không đổi unique
index đang dùng, không đổi logic upsert trong `inventory.service.ts`. Cụ thể (migration
`1753000020000-InventoryQualityHouseAttrs`):

1. **Đơn giá/giá trị (gap 2)** — thêm cột nullable vào `materials`:
   `unit_price numeric(18,3)`, `price_currency` (mặc định `VND_1000` — đơn vị 1000đ đúng biểu),
   `price_effective_from date`, `price_note`.

2. **Phân cấp chất lượng + mục đích dự trữ + vị trí (gap 1+3)** — bảng mới `stock_quality_details`,
   khóa duy nhất `(material_id, storage_location_id, reserve_purpose, location_class)`:
   - `reserve_purpose`: `THUONG_XUYEN | SSCD | DOT_XUAT | GOI_DAU | THU_HOI_XU_LY | CHAM_LUAN_CHUYEN`
     (6 loại của biểu 01–06/KKDT).
   - `location_class`: `DANG_SU_DUNG | KHO_BO_NGANH | KHO_DON_VI` (3 cột vị trí của biểu 03/KK).
   - `qty_grade_1..qty_grade_5` numeric — phân cấp chất lượng Cấp 1→5.
   - Tách khỏi `stock_balances` để **không ảnh hưởng tồn kho đang chạy**; đây là dữ liệu kiểm kê
     chi tiết, ghi qua module inspection/import.

3. **Biến động theo kỳ kiểm kê (gap 5)** — bảng mới `inventory_period_snapshots`, tham chiếu MỀM
   `campaign_id` (→ `inspection_campaigns` = kỳ kiểm kê): `opening_qty / increase_qty / decrease_qty /
   closing_qty` + `opening_value / closing_value` + `reserve_purpose`. Đủ để dựng cột
   "kỳ trước / tăng / giảm / kỳ này" của mọi biểu KK.

4. **Thuộc tính nhà (gap 4)** — thêm cột nullable vào `facilities`:
   `house_class` (Cấp I–IV), `floors`, `floor_area`, `use_area`, `usage_nature` (SHLV/kho/xưởng...),
   `lightning_protection` bool, `structure` jsonb (móng/nền/tường/cột/sàn/kèo/mái),
   `utilities` jsonb (nguồn điện/nước/tường rào/đường GT), `repair_need` (Lớn/Vừa/Nhỏ).

## Không làm trong increment 1 (schema)
- Không thêm chiều `reserve_purpose` vào `stock_balances` (giữ nguyên granularity + upsert lõi).
- Không seed dữ liệu Hải Phòng vào bảng thật (đã có file tham chiếu trong `docs/thu-thap-csdl/`).

## Increment 2 — Wiring + Reporting (đã triển khai 2026-08-01)
Đưa dữ liệu vào bảng mới và xuất Biểu KK:
1. **Inspection → `inventory_period_snapshots`**: khi phiếu kiểm kê được DUYỆT
   (`inspection.service.decide` → APPROVED), tự dựng lại roll-up cả kỳ từ mọi phiếu đã duyệt
   (opening = Σ tồn kiểm kê, closing = Σ số đếm; tăng/giảm suy ra; giá trị tính khi có đơn giá).
   Idempotent (delete + recompute theo campaign).
2. **Import → `stock_quality_details`**: thêm đích nhập CSV `stock-quality`
   (cột `materialCode, storageCode, reservePurpose, locationClass, grade1..5, unitPrice, note`),
   validate tham chiếu mã vật chất/kho ở staging, commit upsert theo khóa
   `(material, kho, mục đích, vị trí)`.
3. **Reporting (gap 6)**: 3 template đọc từ bảng mới — `bieu-02kk-so-luong-gia-tri`
   (số lượng × đơn giá = giá trị), `bieu-03kk-chat-luong` (phân cấp Cấp 1–5),
   `bieu-01kkdt-bien-dong` (kỳ trước/tăng/giảm/kỳ này).

Kiểm thử: `npm run build` sạch; migration chạy trên `csdl-db`; 3 query reporting hợp lệ; test
end-to-end 2 luồng wiring bằng dữ liệu thật (BEGIN…ROLLBACK) cho kết quả đúng kỳ vọng
(opening=100/decrease=5/closing=95, value=2982.43; upsert row_version=2).

Còn lại: chưa có endpoint liệt kê template cho FE; chưa có seed catalog cho
`reserve_purpose`/`quality-grade`; chưa chạy bộ e2e đầy đủ (`npm run verify`).

## Hệ quả
- Tương thích ngược tuyệt đối: tất cả cột mới nullable/ có default; bảng mới độc lập.
- Cho phép nạp dần dữ liệu kiểm kê chi tiết và dựng báo cáo KK đúng mẫu.
- Cần bước sau: catalog seed cho `reserve_purpose`/`quality-grade`, service ghi `stock_quality_details`,
  template reporting.

## Tham chiếu tham chiếu mềm
Theo đúng quy ước dự án (`materials.asset_code`, `facilities.asset_code`, `catalogs`): các mã
`reserve_purpose`, `location_class`, `campaign_id` là tham chiếu MỀM, không đặt FK cứng.
