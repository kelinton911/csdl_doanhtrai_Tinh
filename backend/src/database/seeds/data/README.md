# Dữ liệu địa giới hành chính (GIS) — nạp TOÀN QUỐC hoặc một tỉnh

Đặt file GeoJSON địa giới vào thư mục này rồi chạy trình nhập. Hỗ trợ **cả cấp Tỉnh và cấp Xã**,
nhiều file cùng lúc. Khuyến nghị 2 file: `provinces.geojson` (34 tỉnh) và `wards.geojson` (xã/phường/đặc khu).

## Định dạng GeoJSON yêu cầu
- `FeatureCollection`, hệ toạ độ **EPSG:4326 (WGS84, kinh/vĩ độ)**.
- Mỗi `Feature.properties`:
  - `code` (bắt buộc, duy nhất) — mã đơn vị.
  - `name` (bắt buộc) — tên đầy đủ.
  - `type` (bắt buộc):
    - Cấp tỉnh: `TINH` (Tỉnh) · `THANH_PHO` (Thành phố trực thuộc TW).
    - Cấp xã: `COMMUNE` (Xã) · `WARD` (Phường) · `SPECIAL_ZONE` (Đặc khu).
  - `level` (tuỳ chọn): `PROVINCE` | `COMMUNE` — thiếu thì suy từ `type`.
  - `province_code` / `parent_code` (tuỳ chọn, cho cấp xã) — mã tỉnh cha để liên kết cây hành chính + lọc theo tỉnh.
- `geometry`: `Polygon` hoặc `MultiPolygon` (tự bọc MultiPolygon; `centroid` để đặt nhãn tự tính bằng `ST_PointOnSurface`).

Xem `areas.example.geojson` để đối chiếu cấu trúc (feature mẫu, KHÔNG phải dữ liệu thật).

## Chạy nhập
```bash
# Nạp toàn quốc (tỉnh + xã) — nhiều file:
npm run seed:geojson -- src/database/seeds/data/provinces.geojson src/database/seeds/data/wards.geojson

# Hoặc qua biến môi trường (phân tách bằng dấu phẩy):
AREAS_GEOJSON="src/database/seeds/data/provinces.geojson,src/database/seeds/data/wards.geojson" npm run seed:geojson

# Không truyền tham số: tự nạp provinces.geojson + wards.geojson nếu tồn tại, nếu không thì areas.geojson.
npm run seed:geojson
```
Trình nhập **idempotent** (upsert theo `code`) và chỉ ghi vào `administrative_areas` (không đụng dữ liệu nghiệp vụ).
Sau khi nạp, rà soát ở **Quản trị → Đơn vị & địa bàn** và **Bản đồ**. Chọn tỉnh demo nghiệp vụ:
`DEMO_PROVINCE_CODE=<mã tỉnh> npm run seed`.

> ⚠️ KHÔNG bịa danh sách (hiến pháp dự án). Không commit dữ liệu thật nhạy cảm nếu không được phép —
> file thật nên đặt ngoài Git hoặc theo quy định bảo mật của đơn vị.
