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

---

# Danh mục tài sản ngành Doanh trại (`asset-catalog-2026.json`)

## Xuất xứ
- **Nguồn**: `docs/Phu luc kem theo Vb.pdf` — Phụ lục "TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI".
- **Văn bản**: Công văn số **2837/DT-QLDT** ngày **16/7/2026** của **Cục Doanh trại/TCHC-KT**.
- **Căn cứ**: TT 170/2019/TT-BQP; VB 10892/CTC-QLCS ngày 14/7/2026 của Cục Tài chính/BQP.
- **Quy mô**: **1272 mã**, định dạng `R##.##.##.##.##.###` (6 đoạn), **6 cấp**, **17 chương** (I–XVIII, **thiếu VI**).

File JSON chỉ chứa **đúng 4 cột có thật trong văn bản** (`stt`, `code`, `name`, `unitRaw`).
Mọi trường dẫn xuất (`level`, `parent_code`, `path`, `chapter`, `domain`, `is_leaf`, `unit_code`)
được tính trong `seed-asset-catalog.ts` — để file cam kết luôn là **bản sao trung thực của văn bản gốc**.

## Nạp dữ liệu
```bash
# 1) Nạp 1272 mã vào asset_catalog_items (idempotent, upsert theo code)
npm run seed:asset-catalog

# 2) Dựng danh mục chính thức: 788 vật chất + 96 nhóm + 385 loại công trình
#    (XOÁ dữ liệu demo VC-* và các nhóm tự đặt cũ)
npm run seed:official-catalog
```

## Chốt toàn vẹn (seeder DỪNG nếu lệch, không ghi gì vào CSDL)
| Chỉ số | Giá trị |
|---|---|
| Tổng số nút | 1272 |
| Nút mồ côi | 0 |
| Phân bố cấp | `{0:1, 1:5, 2:14, 3:28, 4:71, 5:116, 6:1037}` |
| Nút lá / nút nhóm | 1081 / 191 |
| Nút vừa có ĐVT vừa có con | **17** (nguy cơ cộng trùng) |
| Số chương | 17 · chương **VI vắng mặt** |
| Miền | FACILITY 385 · MATERIAL 884 · ROOT 1 · UNCLASSIFIED 2 |
| Đơn vị tính sau khi nạp | 16 (10 sẵn có + 6 mới: `M2_SD, HT, TB, CHIEC, TRAM, SOI`) |

## Khi Cục Doanh trại ban hành phụ lục mới
```bash
# Đặt PDF mới vào docs/ rồi trích xuất lại
python scripts/extract_asset_catalog.py --pdf "docs/<file moi>.pdf"

git diff backend/src/database/seeds/data/asset-catalog-2026.json   # SOÁT KỸ diff
```
Cập nhật hằng số `EXPECT` trong `seed-asset-catalog.ts` **một cách có chủ ý** rồi nạp lại.
Mã không còn trong bản mới được đánh `status='SUPERSEDED'`, **không xoá cứng**.

Seeder **không bao giờ đọc PDF** — chỉ đọc file JSON đã chốt SHA-256 (`.sha256` kèm bên cạnh).
Trích xuất lại là hành động **có rà soát**, không phải bước tự động.

## Lưu ý nghiệp vụ
- **KHÔNG tự sửa dữ liệu nguồn.** Các bất cập của phụ lục gốc (thiếu chương VI; `R13.01.*` trùng
  42 tên với `R06.04.01.*`; 17 nút vừa có ĐVT vừa có con; ĐVT lệch hoa/thường; lỗi chính tả trong tên)
  được **gắn cờ và hiển thị** để phục vụ rà soát — không sửa nguồn, vì phải xuất ngược đúng nguyên văn.
- **Không cộng trùng**: khi tổng hợp, cộng lượng *của chính nút* dọc cây;
  **không** lấy tổng nút cha = `SUM(nút con)` (17 nút `unit_on_group` sẽ bị tính hai lần).
- Bộ mã demo cũ (`VC-GAO`, `VC-XANG`, `VC-QUAN-AO`…) là hàng **Quân nhu / Xăng dầu**, không thuộc
  ngành Doanh trại nên vốn **không có mã** trong phụ lục này — đã xoá, **không** ánh xạ ép.
- `unit_raw` giữ **nguyên văn** ĐVT và là cột được ghi ra file nộp BQP; `unit_code` chỉ dùng để
  lọc/nhóm nội bộ, nên chuẩn hoá sai **không thể** rò ra file nộp.
