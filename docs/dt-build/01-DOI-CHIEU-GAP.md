# Đối chiếu thiết kế DT-01…DT-12 ↔ code hiện có + Bảng GAP tổng thể

> Phân tích ngày hợp nhất thiết kế 03/09/2026. Đối chiếu **Bộ Hồ sơ thiết kế v1.0**
> với repo tại nhánh `feat/toi-uu-quan-ly-vat-chat`.
> Mức đạt: 🟢 đạt phần lớn · 🟡 có nền, thiếu nhiều · 🔴 chưa có / rất mỏng.

## 0. Tổng quan mức độ sẵn sàng

| Phân hệ | Tên | Module hiện có | Mức | Khối lượng gap |
| --- | --- | --- | --- | --- |
| DT-01 | Danh mục chuẩn ngành | `master-data`, `asset-catalog`, `labels` | 🟡 | Trung bình |
| DT-02 | Hồ sơ Doanh trại | `organization`, `barracks`, `facilities`, `land-parcels`, `family-housing`, `utilities`, `gis` | 🟢 | Nhỏ–TB |
| DT-03 | Hồ sơ kỹ thuật vật chất | `asset-catalog` (một phần), `documents` | 🔴 | Lớn |
| DT-04 | Thực lực vật chất | `inventory` | 🟡 | Trung bình |
| DT-05 | Nhập–xuất–điều chuyển | `inventory` (transactions), `maintenance` | 🟡 | Trung bình |
| DT-06 | Dự trữ & phân bổ | `readiness-materials`, `readiness` | 🟡 | TB–Lớn |
| DT-07 | Định mức & Chỉ lệnh | `logistics-norms` | 🔴 | Lớn |
| DT-08 | Tính nhu cầu | `scenario`, `readiness-materials` | 🟡 | Lớn |
| DT-09 | Nguồn địa bàn & cân đối | `local-resources`, `scenario` (assurance) | 🟡 | Lớn |
| DT-10 | Kiểm kê & chốt số liệu | `inspection`, `approvals` | 🟡 | Trung bình |
| DT-11 | Báo cáo & biểu mẫu | `reporting` | 🟡 | Lớn |
| DT-12 | Dashboard chỉ huy | `dashboard`, `analytics`, `alerts` | 🟡 | Lớn |
| Nền | IAM/RBAC/Audit/Idem | `identity`, `rbac`, `audit`, `idempotency`, `digital-signature`, `queue`, `storage` | 🟢 | Nhỏ (hoàn thiện data-scope, outbox) |

---

## DT-01 — Quản lý danh mục chuẩn ngành (Quyển I)

**Hiện có:** `master-data` (entities: `catalog`, `material`, `material-version`),
`asset-catalog` (entities: `asset-catalog-item`, `asset-catalog-proposal`,
`asset-catalog-proposal-batch`; util `asset-code`, `asset-classify`), `labels`.

**Đạt:** danh mục 7 loại + materials, phiên bản hóa vật chất, publish, chống trùng mã,
đề nghị bổ sung theo batch, phân loại theo ký hiệu quân sự.

**GAP (bám Quyển I §VIII bảng CSDL):**

| # | Thiếu | Bảng/khái niệm gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | Máy trạng thái **catalog_version** DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED, effective_from/to | `catalog_version` | Cao |
| 2 | **material_alias** (tên khác) + tìm mã chuẩn từ alias + chống ánh xạ mâu thuẫn | `material_alias` (BR-DT01-009) | Cao |
| 3 | **unit_of_measure** độc lập, chuẩn hóa ký hiệu, kiểm tra vật chất đang tham chiếu | `unit_of_measure` | TB |
| 4 | **catalog_replacement** (mã cũ→mã mới) + cảnh báo khi dùng mã cũ | `catalog_replacement` (BR-DT01-011) | Cao |
| 5 | **temporary_material** (TEMP-DT, PENDING_MAPPING), cấm bắt đầu `R00` | `temporary_material` (BR-DT01-006) | Cao |
| 6 | **catalog_import_batch/error** có file_hash, đối chiếu phiên bản | `catalog_import_batch` | TB |
| 7 | **catalog_model_link** (liên kết mẫu kỹ thuật DT-03) | `catalog_model_link` | TB (mở khi DT-03) |
| 8 | Chống vòng lặp cây parent (A→B→C→A), 1 ACTIVE/thời điểm | BR-DT01-004/005/003 | Cao |
| 9 | So sánh 2 phiên bản danh mục (mã mới/bỏ/đổi tên/đổi ĐVT/đổi cha) | UC-DT01-07 | TB |

**Đã hiện thực (2026-09-06 — module `catalog`, code + unit test PASS):**
10 bảng §3.1 (migration `1753000035000-CatalogDT01`): `catalog_version`, `material_catalog`
(UNIQUE version+code), `material_alias`, `catalog_replacement`, `unit_of_measure`,
`catalog_import_batch/error`, `catalog_change_request`, `temporary_material`, `catalog_model_link`.
22 endpoint `/catalog/*` (versions/publish/compare, items/tree/search, units, aliases/resolve,
replacements, change-requests, temporary-materials/assign-official-code, import-batches/validate).
Domain rules thuần (`catalog-rules.ts`) cưỡng chế BR-DT01-001/004/005/006/009/011 + so sánh
phiên bản + validate import — 15 unit test PASS (TC-DT01-001/002/003/006/007/008). Publish phát
outbox `catalog.version.published`. Seed golden R00 `seed:catalog-dt01`.

**Webapp (2026-09-06 — 5 màn hình, tsc + vite build xanh):**
`CatalogPage` (SCR-DT01-01: cây R00 + hồ sơ mã tab Thông tin/Cây con/Tên khác/Mã thay thế + chọn
phiên bản + tìm kiếm), `CatalogImportPage` (SCR-DT01-02: wizard 5 bước, CHẶN xác nhận khi còn lỗi),
`CatalogComparePage` (SCR-DT01-03: so sánh + lọc loại thay đổi), `CatalogChangeRequestPage`
(SCR-DT01-04: BẮT BUỘC tra alias/danh mục trước khi mở form đề nghị), `CatalogQueuePage`
(SCR-DT01-05: mã tạm chờ ánh xạ + tạo mã tạm chặn R00 client-side + ánh xạ mã chính thức; đề nghị chờ).
Route `/catalog/*` + nav "Danh mục chuẩn R00 (DT-01)"; `webapp/src/lib/catalog.ts` (react-query).
**Còn lại đóng DoD:** chạy migration+seed trên dev; chuỗi E2E Playwright; di trú `material`(cũ)→`material_catalog`.

---

## DT-02 — Quản lý hồ sơ Doanh trại (Quyển II)

**Hiện có:** `organization`, `barracks` (+workflow submit/approve/revision), `facilities`,
`land-parcels`, `family-housing`, `utilities`, `gis` (PostGIS features/search-within).

**Đạt:** tổ chức + xã/phường (geometry), cơ sở doanh trại + workflow, công trình,
đất/nhà/hạ tầng, kho/vị trí (storage-location + revision trong `inventory`).

**GAP (Quyển II §VIII):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **address_snapshot** (province/district_legacy/commune/detail + effective_at) — bảo toàn địa chỉ lịch sử có huyện/quận | BR-DT02-001/023 | Cao |
| 2 | **land_usage_allocation** (phân bổ hiện trạng), kiểm tra tổng ≤ diện tích điểm đất | BR-DT02-004 | Cao |
| 3 | **land_change_event** (biến động tăng/giảm/bàn giao) + snapshot kỳ kiểm kê | BR-DT02-005/007 | Cao |
| 4 | **land_economic_use**, **family_area** (khu gia đình), trạng thái riêng "thanh lý chưa thu hồi" | BR-DT02-011 | TB |
| 5 | Sinh dữ liệu đầu vào biểu 01–04/KK-ĐQP, 01/KK-KGĐ, 01–03/KK-NHA từ domain (không tạo bảng theo biểu) | §X, BR-DT02-025 | TB (đồng bộ DT-11) |
| 6 | Cây `storage_location` chống vòng lặp + không xóa vị trí đã có lịch sử vật chất | BR-DT02-019/020 | Cao |
| 7 | Data-quality checks DQ-DT02-01..12 | §XVI | TB |

**Đã hiện thực (2026-09-06 — module `dt02-land`, code + unit test PASS):**
3 bảng gap (migration `1753000036000`): `address_snapshot` (bảo toàn huyện lịch sử, không tạo tầng
huyện — BR-DT02-001/023), `land_usage_allocation` (Σ ≤ diện tích — BR-DT02-004), `land_change_event`
(diện tích tại snapshot, không sửa kỳ trước — BR-DT02-005/007). API `/dt02/*` (addresses, land-points
usage/changes/area, data-quality). Domain rules thuần `land-rules.ts` + 10 unit test
(TC-DT02-003/004/007/017). **Còn lại:** các bảng nhà/hạ tầng/warehouse chi tiết (building*, family_area…),
màn hình webapp SCR-DT02-01..10, chuỗi E2E.

---

## DT-03 — Hồ sơ kỹ thuật vật chất (Quyển III) 🔴

**Hiện có:** `asset-catalog` lưu ký hiệu/mẫu ở mức mục lục; `documents` (upload MinIO,
checksum, presigned). **Chưa có** lớp hồ sơ kỹ thuật số có cấu trúc.

**GAP (Quyển III §VIII — gần như build mới toàn bộ):**

| # | Thiếu | Bảng gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **product_model** + **model_catalog_link** (1 R00 ↔ N mẫu, có hiệu lực) | product_model | Cao |
| 2 | **design_revision** (nhiều đời/K24/2016, SUPERSEDES, không ghi đè) | design_revision | Cao |
| 3 | **technical_document** + **drawing_sheet** (bộ bản vẽ nhiều tờ, file_hash bất biến) | technical_document | Cao |
| 4 | **technical_attribute / dimension_spec / material_spec** giữ raw_value + verification_status | BR-DT03-006/007 | Cao |
| 5 | **bom_header / bom_item / component_catalog** (raw_name + UNMAPPED) | bom_* | TB |
| 6 | **product_label_spec / label_field** (nhãn ≠ QR asset DT-04) | BR-DT03-012 | TB |
| 7 | **design_approval / source_provenance / verification_log** (trạng thái DRAFT_EXTRACTED→VERIFIED) | BR-DT03-006 | Cao |
| 8 | **model_relationship** (thay thế/tương đương, không suy diễn) + **conformity_criterion** | BR-DT03-013 | TB |
| 9 | Máy trạng thái revision + độ đầy đủ hồ sơ (INCOMPLETE→COMPLETE_VERIFIED) | §X | TB |

> Ưu tiên tối thiểu cho MVP DT-03: `product_model`, `design_revision`, `technical_document`,
> `drawing_sheet`, `source_provenance/verification` để DT-04 gắn model/revision cho lô/tài sản.

**Đã hiện thực (2026-09-06 — module `dt03-technical`, code + unit test PASS):**
10 bảng (migration `1753000037000`): product_model, model_catalog_link, design_revision,
technical_document, drawing_sheet, technical_attribute, bom_header, bom_item, source_provenance,
model_relationship. API `/technical-models`, `/revisions/*` (transition/publish/compare),
`/documents/{id}/sheets`, `/revisions/{id}/specifications|boms`, `/boms/{id}/items|export`,
`/verification/{entityType}/{id}`, `/attributes/{id}/use-as-criterion`, `/model-relationships`,
`/technical-completeness/{id}`. Domain rules thuần `tech-rules.ts` (máy trạng thái revision,
chống vòng lặp quan hệ thay thế, gate VERIFIED cho tiêu chí, BOM UNMAPPED, trùng hash, độ đầy đủ)
+ 14 unit test (TC-DT03-003/005/006/007/008). Publish supersede đời cũ. Seed mẫu từ CSV `seed:technical-dt03`.
**Còn lại:** conformity_criterion/label_spec/design_approval; màn hình webapp SCR-DT03-01..08; E2E 3 kiểu vật chất.

---

## DT-04 — Quản lý thực lực vật chất (Quyển IV)

**Hiện có:** `inventory` (entities: `inventory-transaction` [sổ cái], `stock-balance`,
`stock-quality-detail` [chất lượng], `storage-location` + revision, `inventory-period-snapshot`).

**Đạt:** giao dịch bất biến + số dư cache, chống tồn âm (INV-001), idempotency, snapshot kỳ,
chi tiết chất lượng.

**GAP (Quyển IV §VIII):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | Tách rõ **inventory_lot** vs **asset_instance** (QR/serial/model, quản lý cá thể) | §XII | Cao |
| 2 | **HC(t) as-of-time**: snapshot gần nhất + Σ movement APPROVED ≤ t; API kèm `as_of_time`+scope+source | BR-DT04-013/020 | Cao |
| 3 | Máy trạng thái giao dịch DRAFT→SUBMITTED→APPROVED→POSTED, chỉ POSTED tác động số dư | BR-DT04-004 | Cao |
| 4 | **quality_assessment / quality_distribution** có lịch sử; Σ cấp ≤ HC lô | BR-DT04-006 | TB |
| 5 | **inventory_adjustment_request** (workflow điều chỉnh, tách người lập/duyệt) → sinh ADJUSTMENT | BR-DT04-015 | Cao |
| 6 | **inventory_import_batch/row** (số dư đầu kỳ qua staging/mapping) | §X | TB |
| 7 | **inventory_reconciliation** + **inventory_exception** (âm/lệch cache-ledger) | BR-DT04-021 | TB |
| 8 | Tách/gộp lô giữ tổng HC; asset chỉ ACTIVE tại 1 vị trí/thời điểm | BR-DT04-007/010 | TB |

**Đã hiện thực (2026-09-06 — module `dt04-materiel`, code + unit test PASS):**
7 bảng (migration `1753000038000`): `inventory_lot`, `asset_instance` (asset_code UNIQUE + QR),
`materiel_movement` (sổ cái bất biến + state machine + effective_time/posted_at + reversal),
`materiel_snapshot`+`_line`, `quality_assessment`, `inventory_adjustment_request`. Domain rules thuần
`materiel-rules.ts` — **HC(t) as-of** (Σ signed POSTED, effective_time ≤ t), signed qty, máy trạng thái
giao dịch, chống tồn âm, Σ chất lượng ≤ HC, snapshot lock — **12 unit test** (TC-DT04-003/004/007/008/017).
API `/materiel/*`: `GET /materiel/hc` (kèm as_of_time/scope/source/locked cho DT-08), lots, assets(+by-qr),
movements (submit/approve/post/reverse), quality, snapshots(+lock/lines/reconciliation), adjustments(+approve).
Post movement phát outbox `materiel.movement.posted`; duyệt điều chỉnh sinh giao dịch ADJUSTMENT (SYS-BR-02).
Đặt dưới `/materiel` để cùng tồn tại module `inventory` (M06) cũ.
**Còn lại:** import staging số dư đầu kỳ, tách/gộp lô, exception; màn hình webapp SCR-DT04-01..12; E2E.

---

## DT-05 — Nhập–xuất–điều chuyển (Quyển V)

**Hiện có:** `inventory` (movement/adjustment), `maintenance` (damage→request→repair workflow).

**Đạt:** movement sổ kho, idempotency, damage/maintenance lifecycle.

**GAP (Quyển V §IX):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | Tách **inventory_document / document_line / movement / posting_batch** (1 chứng từ→N movement, posting nguyên tử) | §X | Cao |
| 2 | Máy trạng thái chứng từ DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED→POSTED→REVERSED | §VIII | Cao |
| 3 | **transfer_order/receipt** điều chuyển liên đơn vị 2 đầu (IN_TRANSIT, chênh lệch giao–nhận) | BR-DT05-008 | Cao |
| 4 | Reversal thay vì sửa; hủy chỉ khi chưa POST; idempotency-key POST | BR-DT05-002/003/011 | Cao |
| 5 | Thu hồi/sửa chữa/thanh xử lý tách trạng thái vs giao dịch giảm thực | §XIV | TB |
| 6 | **stock_period / period_lock** khóa kỳ, cấm backdate, đối chiếu movement↔balance | BR-DT05-010/026 | TB |
| 7 | Truy vết ô "tăng/giảm" 01/KK,02/KK → movement → chứng từ → file | BR-DT05-030 | TB (DT-11) |

**Đã hiện thực (2026-09-06 — module `dt05-documents`, code + unit test PASS):**
5 bảng (migration `1753000039000`): `inventory_document`/`_line`, `posting_batch`, `transfer_order`,
`stock_period`. **POST nguyên tử** sinh N movement DT-04 (all-or-nothing; kiểm tồn từng dòng giảm →
`INSUFFICIENT_STOCK` rollback toàn bộ — TC-DT05-002); reversal chứng từ POSTED (BR-DT05-002);
điều chuyển 2 đầu dispatch→IN_TRANSIT→receive (không cộng trùng HC — BR-DT05-008) + chênh lệch;
khóa kỳ cấm backdate (BR-DT05-010, `PERIOD_LOCKED`); truy vết chứng từ→movement→sổ cái (BR-DT05-030).
Domain rules `doc-rules.ts` + **10 unit test** (TC-DT05-003/005/008/009/013). Dùng lại
`materiel_movement` + máy trạng thái của DT-04; POST phát outbox `inventory.document.posted`.
API `/inventory-documents/*`, `/transfer-orders/*`, `/stock-periods/*`.
**Còn lại:** recall/disposal case, document_attachment, đối chiếu Σmovement=Δbalance đầy đủ; webapp SCR-DT05-01..10; E2E.

---

## DT-06 — Dự trữ & phân bổ (Quyển VI)

**Hiện có:** `readiness-materials` (plan/revision/line — báo cáo dự trữ 4 cấp SSCĐ),
`readiness`.

**Đạt:** khung dự trữ SSCĐ theo cấp + plan/revision/line + workflow.

**GAP (Quyển VI §IX):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **allocation_type** cấu hình EXCLUSIVE/OVERLAY + **inventory_allocation/line** đa mục đích (thường xuyên, gối đầu, SSCĐ, đột xuất, chờ xử lý, chậm luân chuyển) | §III/§IX | Cao |
| 2 | **allocation_hold** (khóa nguồn theo nhiệm vụ, số lượng+thời gian+priority), chống tính trùng: Σ exclusive ≤ HC_ALLOCATABLE | BR-DT06-002/007 | Cao |
| 3 | **reserve_requirement_link** ↔ định mức DT-07; tính thiếu/đủ/vượt | BR-DT06-008/009 | Cao (cần DT-07) |
| 4 | **slow_moving_rule/evaluation** (overlay, có version) | BR-DT06-012/027 | TB |
| 5 | **allocation_snapshot** tại cutoff (sinh 01–06/KKDT), checksum bất biến | BR-DT06-023/024 | Cao |
| 6 | Chuyển loại allocation qua workflow (SSCĐ cần phê duyệt), atomic, giữ HC | BR-DT06-006 | TB |
| 7 | Không tự trừ HC; DT-05 giảm HC dưới allocation → chặn/exception | BR-DT06-020 | Cao |

**Đã hiện thực (2026-09-06 — module `dt06-allocation`, code + unit test PASS):**
10 bảng (migration `1753000040000`): `allocation_type` (EXCLUSIVE/OVERLAY + category), `inventory_allocation`/`_line`,
`allocation_hold` (denormalized semantics/category), `reserve_requirement_link`, `allocation_snapshot`/`_line`,
`allocation_change_request`, `slow_moving_rule`/`_evaluation`. Lớp phủ ngữ nghĩa trên HC (DT-04), **không tự trừ HC**.
Domain rules `alloc-rules.ts` + **9 unit test**: `Σ EXCLUSIVE ≤ HC_ALLOCATABLE` → `OVER_ALLOCATED`
(SYS-BR-05, TC-DT06-002/003 chống tính trùng), gap định mức thiếu/đủ/vượt (TC-DT06-008), chặn HC tụt dưới
hold (TC-DT06-020), snapshot lock (TC-DT06-023). API `GET /allocations/allocatable` (HC khả dụng),
`GET /reserve/sscd` (**PC_SSCĐ / SEM-RESERVE-SSCD cho DT-08**), holds, change-requests, snapshots, slow-moving.
Dùng lại `materiel_movement` (DT-04) để tính HC. **Còn lại:** ràng buộc realtime khi DT-05 POST giảm HC dưới hold
(hiện có helper `assertHcCoversHolds`), webapp SCR-DT06-01..09, E2E.

---

## DT-07 — Định mức, quy định dự trữ & Chỉ lệnh (Quyển VII) 🔴

**Hiện có:** `logistics-norms` (entity `logistics-calc-norm` — một bảng định mức phẳng).

**GAP (Quyển VII §XIX — build mới phần lớn):**

| # | Thiếu | Bảng gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **normative_document + version + source_reference/appendix** (file_hash, trang/dòng căn cứ) | §VIII | Cao |
| 2 | **norm_set / norm_set_version / material_norm** (value_type: FIXED/PER_UNIT/FORMULA/LOOKUP; raw + effective window) | §XI | Cao |
| 3 | **norm_scope + dimension** (material/org/territory/mission/phase/quality/scale/time) | §X | Cao |
| 4 | **norm_selector_config + authority_rank_version** (chọn norm deterministic, có explanation), **norm_conflict_case** (không tự chọn) | BR-DT07-008/027 | Cao |
| 5 | **calculation_parameter** theo semantic: CONSUMPTION_PREPARATION / CONSUMPTION_COMBAT / POST_COMBAT_REQUIRED / RESERVE_* | §II | Cao |
| 6 | **command / command_version / command_requirement / command_assignment / command_progress** (Chỉ lệnh hậu cần) | §XV | Cao |
| 7 | Dịch vụ `/norms/resolve` trả SELECTED/NO_RULE/CONFLICT + source trace | BR-DT07-007 | Cao |
| 8 | Cấm sửa norm PUBLISHED; import Excel chỉ DRAFT; legacy chưa căn cứ → LEGACY_UNVERIFIED | BR-DT07-002/026 | Cao |

**Đã hiện thực (2026-09-07 — module `dt07-norms`, code + unit test PASS):**

17 bảng (migration `1753000041000-NormsDT07` reversible): `normative_document`(+`_version`,
`norm_source_reference`) · `norm_set`(+`_version`) · `material_norm`+`norm_dimension` (scope
đa chiều) · `calculation_parameter` · `norm_selector_config` · `authority_rank_version` ·
`norm_conflict_case` · `norm_import_batch` · `command`(+`_version`/`_requirement`/`_assignment`/
`_progress`). **Bộ chọn deterministic** (`norms-rules.resolveNorm` — hàm thuần): most-specific-wins
+ tách đồng ưu tiên bằng `authority_rank`; trả `SELECTED | NO_RULE | CONFLICT` **+ explanation
trace** (chiều khớp/độ đặc thù/hạng cơ quan/lý do loại), **không bao giờ ngầm 0** (BR-DT07-007/008/009).
`POST /norms/resolve` (DT-08 gọi) gắn `source_reference` khi SELECTED; ghi `norm_conflict_case`
khi CONFLICT (gom trùng theo hash). `/norm-conflicts/:id/resolve` giải quyết thủ công (không tự chọn).
Bộ định mức PUBLISHED **bất biến** → publish trong transaction + outbox `norm.set.published`,
supersede version cùng bộ (BR-DT07-002). Định mức có `source_reference` → VERIFIED, thiếu →
LEGACY_UNVERIFIED (bị loại khỏi resolve — BR-DT07-026); giữ `raw_value` + ĐVT gốc (BR-DT07-011);
hết hiệu lực không áp cho as_of (BR-DT07-016). Import Excel → `norm_import_batch` DRAFT +
material_norm LEGACY_UNVERIFIED. `authority_rank_version` có version, chỉ 1 bản active (BR-DT07-027).
Chỉ lệnh: vòng đời DRAFT→ISSUED→IN_PROGRESS→COMPLETED; `command_requirement` tự gắn định mức
PUBLISHED tại `effective_date` (BR-DT07-031). API dưới `/api/v1`: normative-documents, norm-sets,
norm-set-versions, norms/resolve|import|scopes, norm-conflicts, calculation-parameters,
authority-ranks, commands/requirements/assignments/progress. Seed `seed:norms-dt07` (chuỗi
văn bản→định mức→publish→resolve→chỉ lệnh). **14 unit test PASS** (TC-DT07-002/007/008/009/016/026
+ most-specific + authority_rank + máy trạng thái chỉ lệnh). Giữ nguyên `logistics-norms` cũ
(engine HC-KT Khâu 4) — DT-07 là kho định mức chuẩn có căn cứ, không phá dữ liệu cũ.

**Migration + seed đã áp trên CẢ 2 DB dev (2026-09-07):** 5435 (stack :8000) và 5436 (instance
:8100) — `migration:run` #32→#42 + `seed:catalog-dt01`/`seed:norms-dt07`; resolve chạy thật OK
(mission=ATTACK→SELECTED 15, tổng quát→10, hết hiệu lực/material lạ→NO_RULE).

**Webapp** `NormsPage` (`/norms`, 7 tab, tsc+vite xanh) — phủ đủ SCR-DT07-01..08: Thử chọn định
mức (form bối cảnh đa chiều → SELECTED/NO_RULE/CONFLICT + bảng trace + căn cứ) = SCR-05; Bộ định mức
+ công bố + danh sách định mức = SCR-02; Biên tập & nhập (tạo bộ/phiên bản, thêm định mức
VERIFIED/LEGACY, gắn chiều phạm vi, nhập nhanh CSV→DRAFT) = SCR-03/04; Xung đột + giải quyết thủ
công = SCR-06; Chỉ lệnh = SCR-07; Văn bản căn cứ = SCR-01; Legacy chưa xác minh (cảnh báo) = SCR-08.

Nhập file **.xlsx/.csv thật**: `POST /norms/import-file` (multipart, exceljs parse server-side,
file_hash = sha256 bytes) + UI upload trong tab Biên tập (SCR-04 đầy đủ). **Quản lý chỉ lệnh đầy đủ**
(SCR-07): tạo → phát hành/bắt đầu/hoàn thành → yêu cầu (gắn định mức PUBLISHED) → phân giao → tiến độ
(+ GET assignments/progress).

**Integration test** `norms.int-spec.ts` (`npm run test:int`, DB thật, **7 ca PASS**): publish
supersede+outbox, LOCKED_IMMUTABLE, resolve SELECTED/NO_RULE, CONFLICT ghi case, import dedup 409,
chuỗi chỉ lệnh gắn định mức (BR-DT07-031)+assignment+progress+transition, parser xlsx/csv.
**E2E Playwright** `e2e/dt07-norms.spec.ts` **2 test PASS** trên backend thật (resolve NO_RULE không
ngầm 0 → biên tập LEGACY → publish → màn Legacy → resolve NO_RULE; chỉ lệnh tạo→phát hành→yêu cầu).
**DoD DT-07 hoàn tất** — sẵn sàng làm nguồn định mức cho DT-08.

---

## DT-08 — Tính toán nhu cầu (Quyển VIII)

**Hiện có:** `scenario` (scenario/scenario-run/plan — engine assurance-v1 chỗ ở + cân đối),
`readiness-materials`.

**Đạt:** khung scenario + run có version + plan compare/approve bất biến.

**GAP (Quyển VIII §XXI — mở rộng lớn):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **calculation_scenario** (nhiệm vụ, phạm vi, effective_time, revision, engine_version) + phase (GĐCB/GĐCĐ) | §VIII | Cao |
| 2 | **material_calculation** lưu **riêng** TT_GĐCB, TT_GĐCĐ, TT, PC_SSCĐ, HC, NC, supply_required | BR-DT08-020 | Cao |
| 3 | **rule_resolution_snapshot** (gọi DT-07: SELECTED/NO_RULE/CONFLICT), **hc_snapshot_ref** (chốt HC từ DT-04) | BR-DT08-008/021 | Cao |
| 4 | **calculation_run** + input_hash/output_hash + engine_version; tái lập cùng input→cùng output | BR-DT08-016/017 | Cao |
| 5 | **calculation_step / calculation_trace_node** (giải thích tới nguồn) | §XV | Cao |
| 6 | NC âm lưu đúng; supply_required=max(NC,0) là trường dẫn xuất; không tự 0 | BR-DT08-004/006 | Cao |
| 7 | Workflow scenario + LOCK bất biến; clone/revision khi dữ liệu nguồn đổi | BR-DT08-011/012 | Cao |
| 8 | So sánh scenario (delta NC + nguyên nhân) | §XIX | TB |

**Đã làm (2026-09-07) — module `dt08-calculation`, engine `dt08-need-v1`:**

- 7 bảng: `calculation_scenario` (scope_json + effective_time + engine_version + revision_no +
  status DRAFT→CALCULATED→LOCKED + based_on_id + hc_snapshot_id), `calculation_run`
  (input_hash/output_hash + line/exception count), `material_calculation` (TT_GĐCB/TT_GĐCĐ/TT/
  PC_SSCĐ/HC/NC/supply_required **lưu riêng**, nullable; rule_status + hc_status),
  `rule_resolution_snapshot`, `hc_snapshot_ref`, `calculation_trace_node`, `scenario_comparison`.
- Công thức lõi (hàm thuần, 16 unit test): **TT = TT_GĐCB + TT_GĐCĐ**; **NC = TT + PC_SSCĐ − HC**
  (âm giữ dấu — BR-DT08-004); **supply_required = max(NC,0)** dẫn xuất (BR-DT08-006).
- Engine gọi DT-07 `resolve` theo giai đoạn (CONSUMPTION_PREPARATION/COMBAT) → lưu
  `rule_resolution_snapshot`; NO_RULE/CONFLICT **đánh dấu dòng, không quy 0** (BR-DT08-008). HC lấy
  từ `hc_snapshot` DT-04 (as-of), thiếu → **NO_HC_SNAPSHOT** (không đọc số dư sống — BR-DT08-021).
  PC_SSCĐ từ DT-06 `reserveSscd`.
- input_hash/output_hash + engine_version → **tái lập** (BR-DT08-016/017); LOCK bất biến, revise=clone
  (BR-DT08-011/012); trace tới nguồn (NORM/RESERVE/HC/FORMULA — BR-DT08-024); so sánh ΔNC
  (`scenario_comparison`); `GET /runs/{id}/supply-required` cấp cho DT-09; `/runs/{id}/exceptions`.
- API `/calculation-scenarios` (+`/{id}/run|revise|lock|runs`), `/runs/{id}` (+`/materials`,
  `/materials/{mid}/trace`, `/supply-required`, `/exceptions`), `/runs/compare?base=&target=`.
- **Webapp** CalculationPage `/calculation` 3 tab: Kịch bản & chạy (SCR-01/02/07), Bảng kết quả NC +
  trace + ngoại lệ (SCR-03/04/05), So sánh ΔNC (SCR-06).
- **Test:** 16 unit + 4 integration (DB thật, `test:int`) + 1 E2E Playwright — **Migration áp 5435 & 5436.**

**DoD DT-08 hoàn tất** — cấp `supply_required` cho DT-09.

---

## DT-09 — Nguồn địa bàn & cân đối (Quyển IX)

**Hiện có:** `local-resources` (entity `local-resource`) làm master-data; **module `dt09-balance` mới** (Quyển IX) với 12 bảng cân đối.

**Đạt (2026-09-08 — DoD PASS):** hồ sơ nguồn theo xã/điểm + xác minh + huy động + candidate 8 bước + cân đối chống overbooking + snapshot bất biến.

**GAP (Quyển IX) — ĐÃ ĐÓNG:**

| # | Hạng mục | Gốc | Trạng thái |
| --- | --- | --- | --- |
| 1 | **territorial_source / source_material** (+ liên kết local_resource, effective window) | PHẦN III | ✅ |
| 2 | **source_verification + verification_evidence** (UNVERIFIED→VERIFIED→EXPIRED; VERIFIED ≠ ELIGIBLE) | BR-DT09-001/002 | ✅ |
| 3 | **mobilization_assessment** (mobilizable_qty ≤ verified_qty, lead_time, readiness) | BR-DT09-003 | ✅ |
| 4 | **candidate service** (lọc 8 bước + xếp hạng + lý do loại) | PHẦN VII | ✅ |
| 5 | **balance_plan/line + source_reservation** chống overbooking (Σ ACTIVE ≤ available; transaction + pessimistic lock + `row_version`) | BR-DT09-008 | ✅ |
| 6 | Nhận supply_required từ DT-08 (không tính lại NC); Gap; execution_request→DT-05 + feedback | BR-DT09-009/028 | ✅ |
| 7 | balance_snapshot bất biến tại phê duyệt + `source_fingerprint` (truy vết verification/mobilization) | BR-DT09-020 | ✅ |

**Kiểm thử:** 31 unit (`balance-rules.spec.ts`) + 10 integration DB thật (`balance.int-spec.ts` — gồm 2 giữ chỗ song song vượt available → cái thứ 2 bị chặn, và snapshot bất biến) + 1 E2E Playwright (`dt09-balance.spec.ts`).

---

## DT-10 — Kiểm kê & chốt số liệu (Quyển X)

**Hiện có:** `inspection` (campaign/sheet/line/review-task/variance), `approvals`.

**Đạt:** campaign/sheet/line, variance, review-task, autosave, tách nhiệm vụ, chặn gửi rỗng.

**GAP (Quyển X):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **cutoff_time** + **book_snapshot/line** dựng từ DT-04/05 tại cutoff (bất biến, checksum) | BR-DT10-002/003 | Cao |
| 2 | Ba lớp độc lập Book / Physical / Official; blind count; recount round (không ghi đè) | BR-DT10-005/008 | Cao |
| 3 | Kiểm kê chất lượng C1–5, Σ = physical khi bắt buộc; unbooked/missing/location variance | BR-DT10-009/013..015 | Cao |
| 4 | **official_snapshot + lock** (bất biến, version), revision sau khóa | BR-DT10-019/020 | Cao |
| 5 | **adjustment_request → DT-05** (không sửa số dư trực tiếp), reconciliation hậu kiểm | BR-DT10-022 | Cao |
| 6 | **report_dataset** chuẩn (01/KK,02/KK,03/KK,01–06/KKDT) gắn snapshot_version | BR-DT10-025 | Cao (DT-11) |
| 7 | Loại đợt (PERIODIC/EXTRAORDINARY/HANDOVER/POST_EVENT) + scope đa chiều | PHẦN II | TB |

---

## DT-11 — Báo cáo & biểu mẫu (Quyển XI)

**Hiện có:** `reporting` (entity `report-job`, `land-forms`, xuất PDF DejaVuSans/Excel từ snapshot MinIO).

**Đạt:** job báo cáo, xuất PDF/Excel, biểu đất.

**GAP (Quyển XI §VIII — Report Engine):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **report_definition + template_version** (mã biểu, layout schema, hiệu lực; danh mục 17 biểu cấu hình, KHÔNG hard-code số lượng) | BR-DT11-004/019 | Cao |
| 2 | **dataset_definition/field/filter/formula + dataset_instance** (dataset_hash, source_fingerprint) | BR-DT11-006 | Cao |
| 3 | **dataset_validation** (reconciliation, quality total, NO_DATA≠ZERO≠MISSING_SUBMISSION) | BR-DT11-007/009 | Cao |
| 4 | Workflow DRAFT→VALIDATED→APPROVED→ISSUED→SUPERSEDED; file có checksum, không ghi đè | BR-DT11-016/017 | Cao |
| 5 | Tổng hợp nhiều đơn vị (rollup, chống aggregate trùng, drill-down, đơn vị chưa gửi ≠ 0) | BR-DT11-008/020/021 | Cao |
| 6 | **report_lineage** truy vết ô → dataset → snapshot/giao dịch/định mức | BR-DT11-002 | Cao |
| 7 | Sinh đủ 01–06/KKDT, 01–03/KK, 01–04/KK-ĐQP, 01/KK-KGĐ, 01–03/KK-NHA từ nguồn chuẩn | §II/§X | Cao |

---

## DT-12 — Dashboard chỉ huy (Quyển XII)

**Hiện có:** `dashboard` (summary), `analytics`, `alerts` (rule engine, gom trùng, assign, SLA).

**Đạt:** dashboard tổng hợp, analytics, cảnh báo cơ bản.

**GAP (Quyển XII):**

| # | Thiếu | Gốc | Ưu tiên |
| --- | --- | --- | --- |
| 1 | **Semantic/KPI layer**: kpi_definition + formula_version + kpi_threshold + metric_instance (as_of_time, lineage) | PHẦN VII, P2/P4 | Cao |
| 2 | **Data Mart** star schema (dim_time/material/org/location/mission/quality + fact_*) | PHẦN XI | Cao |
| 3 | Semantic phân biệt SEM-HC / HC-AVAILABLE / RESERVE-SSCD / PC-SCD / SUPPLY-REQUIRED / GAP | PHẦN III | Cao |
| 4 | **alert_rule/instance/assignment** cấu hình ngưỡng+severity+SLA + lifecycle (đã có nền `alerts`) | PHẦN VIII | TB |
| 5 | **decision_session/option/criterion/score/record** + What-if isolation (không ghi ngược) | PHẦN IX | TB |
| 6 | Bản đồ theo phân quyền vị trí; drill-down KPI→nguồn; freshness/STALE | PHẦN X, P10 | TB |
| 7 | Không tạo "số Dashboard" độc lập; mọi KPI có lineage | AC-15 | Cao |

---

## Nền tảng (Sprint 0)

**Hiện có:** `identity`, `rbac`, `audit` (append-only interceptor), `idempotency`,
`digital-signature`, `queue`, `storage`, `health`.

**GAP:** data-scope theo đơn vị/địa bàn/nhiệm vụ (row-level) hoàn thiện toàn cục;
enum/error-code/trạng thái chuẩn hóa dùng chung; data dictionary vật lý;
outbox pattern; OpenAPI contract test trong CI; C3 catalog + ma trận truy vết vận hành.
→ Xem `prompts/00-Sprint0-Chuan-hoa-nen-tang.md`.

**Đã hiện thực (2026-09-06 — code + unit test PASS):**

| GAP | Hiện thực | Vị trí | Test |
| --- | --- | --- | --- |
| 1 Enum & error-code | `BusinessError` + `BusinessException` + `BUSINESS_ERROR_STATUS/TITLE`; filter render `code` | `common/errors/business-error.ts`, `common/enums/*`, `common/filters/problem-exception.filter.ts` | TC-S0-006 |
| 2 Data-scope guard | `DataScopeGuard` (APP_GUARD) + `@Scoped()` + `ScopeContext`/`buildScopeContext` | `common/scope/*` | TC-S0-001 |
| 3 AbstractEntity + optimistic lock | `AbstractEntity`; `assertRowVersion`/`parseExpectedVersion`; `OptimisticLockInterceptor` → STALE_WRITE | `common/entities/abstract.entity.ts`, `common/concurrency/*` | TC-S0-002 |
| 4 Audit append-only | interceptor thêm entityType/reason/source/scope | `modules/audit/audit.interceptor.ts` | TC-S0-004 (đơn vị) |
| 5 As-of + response wrapper | `resolveAsOf`/`toHcmIso` (Asia/Ho_Chi_Minh); `asOfResponse` | `common/time/as-of.ts`, `common/dto/as-of-response.ts` | TC-S0-005 |
| 6 Idempotency mở rộng | áp cho POST/PUT/PATCH khi có Idempotency-Key | `modules/idempotency/idempotency.interceptor.ts` | TC-S0-003 |
| 7 Outbox pattern | `OutboxEvent` + `OutboxService.enqueue(manager)` + `OutboxDispatcher` + `OutboxEmitter` | `common/outbox/*`; migration `1753000034000` | dispatcher spec |
| 8 OpenAPI contract test | `scripts/generate-openapi.ts` (preview mode) + baseline + spec so-khác | `scripts/generate-openapi.ts`, `openapi.baseline.json`, `common/openapi/contract.spec.ts` | TC-S0 (CI) |
| 9 C3 catalog | module `/c3-catalog` + seed SYS-BR/Sprint0/DT-01..12 | `modules/c3-catalog/*`; seed `seed-c3-catalog.ts` | — |

Webapp §5: `webapp/src/lib/errorCodes.ts` (map mã lỗi → i18n) bổ trợ `lib/api.ts` (đã có correlation-id + problem+json).
**Còn lại để đóng DoD:** chạy migration `1753000034000` + `npm run seed:c3-catalog` trên instance dev; bổ sung `row_version` cho entity biến động còn thiếu; chuỗi e2e webapp.

---

## Bảng theo dõi tiến độ (cập nhật sau mỗi phân hệ)

| Giai đoạn | DoD | Ngày đạt | Commit | Ghi chú |
| --- | --- | --- | --- | --- |
| Sprint 0 | ◑ | 2026-09-06 | (chưa commit) | 9/9 GAP đã code + unit test PASS (88 test, 12 suite). Chờ: chạy migration+seed trên dev, e2e webapp để chốt DoD. |
| DT-01 | ◑ | 2026-09-06 | (chưa commit) | Backend đủ 10 bảng + 25 API + BR + so sánh phiên bản (15 unit test PASS) + 5 màn hình webapp (tsc + vite build xanh). Chờ: E2E Playwright, migration/seed trên dev, di trú material→material_catalog. |
| DT-02 | ◑ | 2026-09-06 | (chưa commit) | Backend lớp đất (3 bảng + /dt02/* + data-quality, 10 test) + **webapp** LandRegistryPage (phân bổ/biến động timeline/diện tích tại snapshot/DQ). Chờ: bảng nhà/hạ tầng chi tiết, E2E. |
| DT-03 | ◑ | 2026-09-06 | (chưa commit) | Backend 10 bảng + ~20 API + revision state machine + completeness (14 test) + **webapp** TechnicalModelsPage (thư viện mẫu/revision/publish/độ đầy đủ). Chờ: E2E 3 kiểu vật chất. |
| DT-04 | ◑ | 2026-09-06 | (chưa commit) | Backend sổ cái (7 bảng + 19 API + HC(t) as-of + snapshot lock, 12 test) + **webapp** MaterielPage (tra HC theo thời điểm + sổ cái + workflow giao dịch). Chờ: import staging, tách/gộp lô, E2E. |
| DT-05 | ◑ | 2026-09-06 | (chưa commit) | Backend chứng từ (5 bảng + 18 API + POST nguyên tử + transfer + khóa kỳ, 10 test) + **webapp** InventoryDocumentsPage (chứng từ/dòng/duyệt-POST/truy vết + điều chuyển + khóa kỳ). Chờ: recall/disposal, E2E. |
| DT-06 | ◑ | 2026-09-06 | (chưa commit) | Backend phân bổ: 10 bảng + 19 API + Σ exclusive ≤ HC_ALLOCATABLE + PC_SSCĐ cho DT-08 + snapshot lock; 9 unit test PASS. Chờ: ràng buộc realtime DT-05↔hold, webapp, E2E. |
| DT-07 | **PASS** | 2026-09-07 | 48363e6·96502a9·8490d2b·5d9f70f·d67c6a7·8266960·e11d127 | Backend định mức có căn cứ: 17 bảng + migration + `resolveNorm` deterministic (SELECTED/NO_RULE/CONFLICT + trace, không ngầm 0) + `/norms/resolve` cho DT-08 + norm_conflict_case + publish bất biến + import→DRAFT/LEGACY + **import-file .xlsx/.csv thật (exceljs, sha256)** + authority_rank version + chỉ lệnh đầy đủ (yêu cầu/phân giao/tiến độ) + `/norms/legacy`. **Test:** 174 unit + **7 integration** (DB thật, `test:int`) + **2 E2E** Playwright (PASS backend thật). **Migration+seed áp 5435 & 5436.** **Webapp** NormsPage `/norms` 7 tab phủ đủ SCR-DT07-01..08 (resolve+trace, bộ định mức+publish, biên tập/upload .xlsx/CSV, xung đột, chỉ lệnh master-detail, văn bản, legacy). |
| DT-08 | **PASS** | 2026-09-07 | (đang commit) | Engine tính nhu cầu `dt08-need-v1`: 7 bảng (calculation_scenario/run + material_calculation lưu riêng TT_GĐCB/TT_GĐCĐ/TT/PC_SSCĐ/HC/NC/supply_required + rule_resolution_snapshot + hc_snapshot_ref + calculation_trace_node + scenario_comparison) + **NC = TT + PC_SSCĐ − HC** (âm giữ dấu; supply_required=max(NC,0) dẫn xuất, không quy 0) kết hợp DT-07 `resolve` + HC as-of hc_snapshot DT-04 (thiếu→NO_HC_SNAPSHOT) + PC_SSCĐ DT-06 + NO_RULE/CONFLICT đánh dấu (không auto chọn) + input/output_hash tái lập + LOCK bất biến (revise=clone) + trace tới nguồn + so sánh ΔNC + `/runs/{id}/supply-required` cho DT-09 + `/runs/{id}/exceptions`. **Test:** 16 unit + **4 integration** (DB thật) + **1 E2E** Playwright (PASS backend thật). **Migration áp 5435 & 5436.** **Webapp** CalculationPage `/calculation` 3 tab phủ SCR-DT08-01..07 (kịch bản+chạy+khóa, bảng NC+trace+ngoại lệ, so sánh ΔNC). |
| DT-09 | ☐ | | | |
| DT-10 | ☐ | | | |
| DT-11 | ☐ | | | |
| DT-12 | ☐ | | | |
| Hardening | ☐ | | | |
