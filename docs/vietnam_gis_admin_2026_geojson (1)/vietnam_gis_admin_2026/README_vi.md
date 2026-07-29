# BỘ DỮ LIỆU GEOJSON ĐƠN VỊ HÀNH CHÍNH VIỆT NAM 2026

## 1. Phạm vi dữ liệu

Bộ dữ liệu được chuẩn hóa theo mô hình chính quyền địa phương 2 cấp, gồm:

- **34** đơn vị hành chính cấp tỉnh;
- **3.321** đơn vị hành chính cấp xã, gồm **697 phường, 2.611 xã và 13 đặc khu**;
- mã cấp tỉnh giữ dạng chuỗi 2 ký tự; mã cấp xã giữ dạng chuỗi 5 ký tự;
- hệ tọa độ của lớp ranh giới: **WGS 84 – EPSG:4326**;
- thứ tự tọa độ GeoJSON: **kinh độ, vĩ độ** (`longitude, latitude`).

Ngày hiệu lực danh mục được ghi trong bộ dữ liệu: **2026-04-30**. Phiên bản nguồn danh mục và tệp ranh giới: **2026-07-12**.

## 2. Thành phần bàn giao

### `vietnam_provinces_2026.geojson`

Lớp không gian cấp tỉnh, có **34 Polygon/MultiPolygon**, nhập trực tiếp vào QGIS, ArcGIS Pro, PostGIS, Leaflet hoặc Mapbox.

Khóa liên kết: `province_code`.

### `vietnam_communes_2026_attributes.geojson`

Danh mục đầy đủ **3.321 xã/phường/đặc khu** dưới dạng GeoJSON hợp lệ với `geometry: null`. Tệp này dùng như bảng thuộc tính để:

- tra cứu danh mục hành chính;
- liên kết với lớp ranh giới bằng `commune_code`;
- kiểm soát mã, tên, loại đơn vị và tỉnh trực thuộc;
- tải ranh giới từng đơn vị qua trường `boundary_source_url`.

Khóa liên kết: `commune_code`.

### `communes_by_province_attributes/`

34 tệp danh mục cấp xã tách theo từng tỉnh, thuận lợi khi triển khai phân vùng dữ liệu hoặc phân quyền theo địa bàn.

### `scripts/build_full_commune_boundaries.py`

Tập lệnh tải một lần kho ranh giới nguồn và tạo:

- `vietnam_communes_2026_polygons.geojson` — FeatureCollection gồm toàn bộ ranh giới cấp xã;
- thư mục `communes_by_province/` — 34 lớp ranh giới tách theo tỉnh;
- `build_report.json` — báo cáo số lượng và mã chưa ghép được.

Chạy tại thư mục bộ dữ liệu:

```bash
python scripts/build_full_commune_boundaries.py
```

Tập lệnh chỉ dùng thư viện chuẩn Python, không yêu cầu cài thêm gói.

## 3. Nhập vào QGIS

### Lớp tỉnh

1. Chọn **Layer → Add Layer → Add Vector Layer**.
2. Chọn `vietnam_provinces_2026.geojson`.
3. Kiểm tra CRS là `EPSG:4326`.

### Danh mục cấp xã

1. Thêm `vietnam_communes_2026_attributes.geojson` như lớp/bảng không có hình học.
2. Sau khi tạo lớp ranh giới đầy đủ bằng tập lệnh, dùng trường `commune_code` để kiểm tra hoặc nối bảng.
3. Không chuyển mã hành chính sang số nguyên vì sẽ làm mất số 0 ở đầu.

## 4. Nhập vào PostGIS

```bash
ogr2ogr -f PostgreSQL   "PG:host=localhost dbname=gis user=postgres password=YOUR_PASSWORD"   vietnam_provinces_2026.geojson   -nln admin_provinces -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom -a_srs EPSG:4326
```

Sau khi tạo lớp ranh giới xã đầy đủ:

```bash
ogr2ogr -f PostgreSQL   "PG:host=localhost dbname=gis user=postgres password=YOUR_PASSWORD"   full_boundaries/vietnam_communes_2026_polygons.geojson   -nln admin_communes -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom -a_srs EPSG:4326
```

Nên tạo chỉ mục không gian và chỉ mục mã:

```sql
CREATE INDEX admin_provinces_geom_gix ON admin_provinces USING GIST (geom);
CREATE UNIQUE INDEX admin_provinces_code_uix ON admin_provinces (province_code);
CREATE INDEX admin_communes_geom_gix ON admin_communes USING GIST (geom);
CREATE UNIQUE INDEX admin_communes_code_uix ON admin_communes (commune_code);
```

## 5. Quy tắc sử dụng trong hệ thống GIS

- Dùng **mã hành chính** làm khóa chính; tên địa danh chỉ dùng để hiển thị và tìm kiếm.
- Lưu `province_code` và `commune_code` bằng kiểu `VARCHAR/TEXT`.
- Tách dữ liệu nền hành chính khỏi dữ liệu nghiệp vụ quân sự; liên kết qua mã địa bàn.
- Duy trì bảng phiên bản địa giới (`valid_from`, `valid_to`, `status`) khi có thay đổi hành chính.
- Đối với nhiệm vụ yêu cầu giá trị pháp lý, đo đạc địa chính hoặc độ chính xác quân sự chuyên dụng, phải đối chiếu với dữ liệu được cơ quan có thẩm quyền cung cấp; bộ dữ liệu công khai này không thay thế hồ sơ địa giới hoặc bản đồ nghiệp vụ được chứng nhận.

## 6. Nguồn và giấy phép

- Danh mục/mã hành chính và kho GeoJSON ranh giới: `https://github.com/thanglequoc/vietnamese-provinces-database` — kho cộng đồng, giấy phép MIT.
- Hình học lớp tỉnh trong gói này được chuẩn hóa từ `https://huggingface.co/datasets/tmquan/sapnhap-bando-vn` — giấy phép CC BY-NC 4.0.
- Nguồn hình học được các kho dữ liệu dẫn chiếu tới Bản đồ tham chiếu đơn vị hành chính Việt Nam.

Khi phát hành lại, cần giữ thông tin nguồn và kiểm tra điều kiện giấy phép phù hợp với mục đích sử dụng.
