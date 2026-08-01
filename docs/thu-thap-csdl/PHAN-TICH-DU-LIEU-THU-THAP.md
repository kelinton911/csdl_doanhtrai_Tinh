# Phân tích dữ liệu thu thập — "thu thập CSDL" (Hải Phòng 2026)

> Trạng thái: **Dự thảo** · Ngày lập: 2026-08-01 · Nguồn: thư mục `thu thập CSDL/` ở gốc dự án P08.
> Mục đích: xác định dữ liệu thật thu thập được, ánh xạ vào các phân hệ hệ thống, và trích xuất
> phần dùng lại được (danh mục chuẩn, biểu mẫu) làm tham chiếu nghiệp vụ.

## 1. Tổng quan nguồn dữ liệu

Thư mục `thu thập CSDL/` (≈150 MB) + bản `thu thập CSDL.zip`. Gồm 3 nhóm:

| Nhóm | Nội dung | Vai trò với dự án |
|---|---|---|
| **Bản vẽ** + **Bản vẽ đính kèm** (13 PDF) | Bản vẽ kỹ thuật doanh cụ mẫu: tủ gỗ 2 buồng, tủ tài liệu sắt, tủ sắt mẫu mới, bàn làm việc/trợ lý, bàn họp giao ban, ghế trợ lý, giường gỗ CB 1,2m, giường sắt 2 tầng, xô–chậu | Tài liệu kỹ thuật đính kèm cho **Doanh cụ theo thiết kế mẫu** (asset-catalog / documents) |
| **HẢI PHÒNG - KK TÀI SẢN NGÀNH DOANH TRẠI 2026** (Excel/Word/.DatKK) | Bộ **biểu kiểm kê thật** 0h 01/01/2026 của Bộ CHQS TP Hải Phòng (Quân khu 3): đất QP, nhà, vật tư hàng hóa, dự trữ SSCĐ, danh mục doanh cụ | **Schema nghiệp vụ chuẩn** + dữ liệu mẫu để seed/kiểm thử |
| `Doanh_trai_2026.DatKK` | File nhị phân mã hóa của phần mềm kiểm kê chuyên dụng (không đọc trực tiếp) | Bằng chứng có phần mềm KK gốc; cần công cụ của Cục để giải mã |

## 2. Bộ biểu kiểm kê — schema nghiệp vụ chuẩn (theo Thông tư/BQP)

### 2.1 Nhóm ĐẤT QUỐC PHÒNG — `1,2,3,4,5. BCQK TỔNG HỢP ĐẤT QUỐC PHÒNG`
- **01/KK-ĐQP** Báo cáo tổng hợp kiểm kê đất QP (điểm/diện tích, tăng–giảm kỳ, hiện trạng, GCNQSDĐ)
- **02/KK-ĐQP** Kiểm kê đất QP (địa chỉ xã/tỉnh, số liệu kỳ trước/kỳ này, GCN, hồ sơ pháp lý)
- **03/KK-ĐQP** Hiện trạng sử dụng đất QP (doanh trại/kinh tế/khu gia đình; có/chưa chủ trương BQP)
- **04/KK-ĐQP** Đất QP cho thuê, mượn, LDLK (đối chiếu TT 35/2009 & 58/2021/TT-BQP)
- **01/KK-KGĐ** Khu gia đình đang quản lý, chưa bàn giao địa phương
➡️ Ánh xạ **`land_parcels`** (+ `land_parcel_markers`, `land_parcel_revisions`).

### 2.2 Nhóm NHÀ — `6/7/8. Biểu ..KK-NHA`
- **01/KK-NHA** Báo cáo tổng hợp nhà (số cơ sở, DT xây dựng/sàn/sử dụng; cấp nhà I–IV; tính chất SD: kho/xưởng/xe pháo/giảng đường/bệnh xá/nhà khách/SHLV/công vụ...)
- **02/KK-NHA** Kiểm kê sử dụng nhà — **1 cơ sở doanh trại/biểu** (ký hiệu nhà, năm XD, số tầng, cấp nhà, kết cấu: móng/nền/tường/cột/sàn/kèo/mái; thu sét; nguồn điện/nước; tường rào; đường GT; nhu cầu SC lớn/vừa/nhỏ)
- **03/KK-NHA** Chất lượng nhà
➡️ Ánh xạ **`facilities`** (+ `barracks`). Nhiều trường của 02/KK-NHA hiện **chưa có** trong `facilities` (kết cấu, hạ tầng điện/nước, tường rào) → xem mục 4 (khoảng trống).

### 2.3 Nhóm VẬT TƯ / HÀNG HÓA — `9/10/11. Biểu 01KK/02KK/03KK`
- **01/KK** Biểu tổng hợp giá trị VTHH QP (theo ngành: tồn đầu/tăng/giảm/tồn cuối; đang SD; kho Bộ-Ngành; kho đơn vị)
- **02/KK** Số lượng & giá trị VTHH (danh mục → ĐVT → đơn giá → tồn/tăng/giảm/tồn cuối; đang SD, kho, điều đi, thanh xử lý)
- **03/KK** Chất lượng VTHH — **phân cấp chất lượng Cấp 1→5** theo đang SD / kho Bộ-Ngành / kho đơn vị
➡️ Ánh xạ **`inventory` (`stock_balances`, `inventory_transactions`)** + **`inspection`**. Cấu trúc **giá trị (đơn giá×SL)** và **phân cấp chất lượng Cấp 1–5** là yêu cầu nghiệp vụ chưa mô hình hóa đầy đủ (mục 4).

### 2.4 Nhóm DỰ TRỮ DOANH TRẠI — `12–17. KKDT-2026-ĐV`
- **01/KKDT** **Bảng tổng hợp danh mục mặt hàng & giá trị vật chất, trang bị ngành doanh trại** (danh mục gốc — xem mục 3)
- **02/KKDT** Dự trữ vật chất, trang bị doanh trại **SSCĐ** (quy định dự trữ vs hiện có vs thiếu; Cấp 1–5)
- **03/KKDT** Dự trữ **nhiệm vụ đột xuất**
- **04/KKDT** Vật chất **gối đầu thường xuyên**
- **05/KKDT** Vật chất **thu hồi, hư hỏng chờ thanh xử lý**
- **06/KKDT** Vật chất **chậm luân chuyển**
➡️ Ánh xạ **`inventory` + `master-data` + `reporting`**. Đây là 6 trạng thái tồn kho theo mục đích dự trữ → nên mô hình bằng `reserve_purpose`/`stock_category` trên `stock_balances`.

## 3. Danh mục chuẩn doanh cụ/vật chất (Biểu 01/KKDT) — DÙNG LẠI ĐƯỢC NGAY

Sheet `01-KKDT` chứa **cây danh mục 6 nhóm chính** ngành Doanh trại (đã trích xuất):

```
NGÀNH DOANH TRẠI
 I.   DOANH CỤ            (giường-phản, bàn, ghế, tủ-hòm; gồm "Doanh cụ theo thiết kế mẫu")
 II.  DỤNG CỤ SINH HOẠT   (chậu, xô, ...)
 III. PHƯƠNG TIỆN, THIẾT BỊ (PCCC, chống mối mọt, thiết bị điện, vật chứa dầu, ...)
 IV.  VẬT CHẤT SSCĐ       (nhà bạt, bể mềm, đèn bão, ...)
 V.   VẬT CHẤT HL, DT
 VI.  MÁY CÁC LOẠI
```

**Doanh cụ theo thiết kế mẫu** — 10 mã ký hiệu chính thức (quy ước `<Mã>-<VậtLiệu>-<Năm>-TCHC`), **khớp 1–1 với bản vẽ kỹ thuật** trong thư mục:

| Mã ký hiệu | Tên | Bản vẽ tương ứng |
|---|---|---|
| TA3B-Go-2016-TCHC | Tủ áo gỗ 3 buồng | — |
| TA2B-Go-2016-TCHC | Tủ áo gỗ 2 buồng | Bản vẽ tủ gỗ 2 buồng / Tu ao go 2 buong |
| BLVCHd-Go-2016-TCHC | Bàn làm việc cấp CH Tiểu đoàn | Bản vẽ bàn làm việc |
| BTL-Go-2016-TCHC | Bàn làm việc trợ lý | Ban LV Tro ly |
| BGBcd-Go-2016-TCHC | Bàn họp giao ban c/d | Ban hop GB cap c, d |
| BHT-Go-2016-TCHC | Bàn hội trường | — |
| GTL-Go-2016-TCHC | Ghế trợ lý | Bản vẽ ghế / Ghe tro ly |
| GCB-Go-2016-TCHC | Giường gỗ cán bộ 1,2m | Bản vẽ giường gỗ / G go CB 1,2m |
| GCS1T-Sa-2016-TCHC | Giường sắt 1 tầng | — |
| GCS2T-Sa-2016-TCHC | Giường sắt 2 tầng | Bản vẽ giường sắt 02 tầng |

> Lưu ý: mã `...-2016-TCHC` là quy ước **cũ (2016)** của biểu Hải Phòng; danh mục chính thức của
> dự án là **CV 2837/DT-QLDT 16/7/2026** (1272 nút) nạp vào `asset_catalog_items`. Bộ 2016 dùng để
> **đối chiếu/ánh xạ (crosswalk)**, không ghi đè danh mục 2026.

### File trích xuất (trong `docs/thu-thap-csdl/`)
- `danh-muc-01-KKDT-hai-phong-2026.csv` — 163 dòng danh mục phân cấp (nhóm chính → nhóm phụ → mặt hàng)
- `taxonomy-doanh-trai-01KKDT.json` — cây taxonomy 6 nhóm (nested)
- `ma-ky-hieu-doanh-cu-thiet-ke-mau.csv` — 10 mã ký hiệu doanh cụ mẫu

## 4. Khoảng trống cần bổ sung mô hình dữ liệu (rủi ro/đề xuất)

1. **Phân cấp chất lượng Cấp 1–5**: các biểu 03/KK, 02–06/KKDT phân số lượng theo 5 cấp chất lượng
   và theo vị trí (đang SD / kho Bộ-Ngành / kho đơn vị). Hiện `inspection_lines.condition` chỉ 1 giá trị,
   `stock_balances` không tách theo cấp. → Đề xuất thêm bảng/cột phân cấp chất lượng.
2. **Giá trị (đơn giá × số lượng)**: biểu 01/02/KK và KKDT đều tính giá trị (1000đ). `materials`/`stock_balances`
   chưa có `unit_price`/`value`. → Cần trường đơn giá + giá trị tồn.
3. **Mục đích dự trữ (6 trạng thái KKDT)**: SSCĐ / đột xuất / gối đầu / thu hồi-chờ xử lý / chậm luân chuyển.
   → `stock_balances.reserve_purpose` (enum) hoặc phân loại kho.
4. **Thuộc tính nhà (02/KK-NHA)**: cấp nhà I–IV, số tầng, năm XD, kết cấu (móng/nền/tường/cột/sàn/kèo/mái),
   thu sét, nguồn điện/nước, tường rào, đường GT, nhu cầu SC. `facilities` mới có `type/area/build_year/condition`.
   → Mở rộng `facilities.attributes` (jsonb) hoặc bảng chi tiết.
5. **Biến động tăng/giảm kỳ kiểm kê**: mọi biểu đều có cột "kỳ trước / tăng / giảm / kỳ này".
   → Mô hình bằng chuỗi `inventory_transactions` theo kỳ kiểm kê + báo cáo đối chiếu.
6. **Xuất biểu (reporting)**: bộ biểu KK là **đầu ra bắt buộc**. `reporting` cần template xuất đúng
   01/KK-ĐQP, 01–03/KK-NHA, 01–03/KK, 01–06/KKDT.

## 5. Ánh xạ nhanh Dữ liệu → Phân hệ

| Dữ liệu thu thập | Phân hệ dùng | Ghi chú |
|---|---|---|
| 01/KKDT (danh mục doanh cụ) | **asset-catalog**, master-data | crosswalk 2016↔2026 |
| Bản vẽ kỹ thuật PDF | **documents**, asset-catalog | đính kèm cho doanh cụ mẫu |
| 01–06/KKDT, 01–03/KK | **inventory**, **inspection**, reporting | tồn/dự trữ/chất lượng |
| 01–03/KK-NHA | **facilities**, barracks, reporting | thuộc tính nhà |
| 01–05/KK-ĐQP, KGĐ | **land-parcels**, gis, reporting | đất QP, khu gia đình |
| Cơ cấu đơn vị trong biểu (Phòng/Tiểu đoàn/Đại đội...) | **organization** | cây đơn vị mẫu QK3 |
| `.DatKK` | integration | cần công cụ giải mã của Cục |

## 6. Bước tiếp theo đề xuất
1. Đối chiếu 10 mã 2016 ↔ danh mục 2026 (CV 2837) để lập bảng crosswalk trong asset-catalog.
2. Viết seed tham chiếu (không ghi đè) từ CSV mục 3 vào bảng đối chiếu.
3. Xây template xuất **Biểu 01–06/KKDT** trong reporting, dùng schema đã tài liệu hóa ở mục 2.
4. Bổ sung mô hình: phân cấp chất lượng, đơn giá/giá trị, mục đích dự trữ, thuộc tính nhà (ADR).
