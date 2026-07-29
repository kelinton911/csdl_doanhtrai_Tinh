# Dữ liệu địa giới hành chính (GIS) — nạp cho MỘT tỉnh

Đặt file GeoJSON địa giới cấp xã của tỉnh vào thư mục này (mặc định `areas.geojson`), rồi chạy trình nhập.

## Định dạng GeoJSON yêu cầu
- `FeatureCollection`, hệ toạ độ **EPSG:4326 (WGS84, kinh/vĩ độ)**.
- Mỗi `Feature` = 1 địa bàn cấp xã, với `properties`:
  - `code` (bắt buộc, duy nhất) — mã địa bàn, vd `XA-...`, `PHUONG-...`, `DACKHU-...`.
  - `name` (bắt buộc) — tên đầy đủ, vd `Xã ...`, `Phường ...`, `Đặc khu ...`.
  - `type` (bắt buộc) — một trong: `COMMUNE` (Xã) · `WARD` (Phường) · `SPECIAL_ZONE` (Đặc khu).
- `geometry`: `Polygon` hoặc `MultiPolygon` (tự động bọc thành MultiPolygon khi nạp).

Xem `areas.example.geojson` để đối chiếu cấu trúc (2 feature mẫu, KHÔNG phải dữ liệu thật).

## Khai báo Tỉnh + chạy nhập
```bash
# Cách 1 — khai báo tỉnh bằng biến môi trường:
PROVINCE_CODE=TINH-XX PROVINCE_NAME='Tỉnh ...' \
  npm run seed:geojson -- src/database/seeds/data/areas.geojson

# Cách 2 — điền REAL_PROVINCE trong ../real-areas.data.ts rồi:
npm run seed:geojson            # đọc mặc định src/database/seeds/data/areas.geojson
```
Trình nhập **idempotent** (upsert theo `code`), tạo đơn vị cấp Tỉnh (PROVINCE) và (tuỳ chọn) "Ban CHQS <địa bàn>". Sau khi nạp, rà soát ở **Quản trị → Đơn vị & địa bàn** và **Bản đồ**.

> ⚠️ Không commit dữ liệu thật nhạy cảm nếu không được phép. File thật nên đặt ngoài Git hoặc theo quy định bảo mật của đơn vị.
