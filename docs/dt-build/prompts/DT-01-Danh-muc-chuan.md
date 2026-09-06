# PROMPT — DT-01: Quản lý danh mục chuẩn ngành Doanh trại

> **Nguồn thiết kế:** Quyển I (DT-01). **Điều kiện mở:** Sprint 0 PASS.
> **Đọc trước:** `02-QUY-UOC-CHUNG.md`. Áp mọi quy ước chung (API/error/enum/DoD/data-scope).
> **Vai trò:** Xây lớp Master Data Management — Single Source of Truth cho toàn hệ thống.

## 1. Mục tiêu (Quyển I §I.2)

Một loại đất/nhà/vật chất/thiết bị chỉ có **một mã danh mục chuẩn** tại một thời điểm; kế thừa
Tổng danh mục R00 cấp trên (bắt đầu `R00.00.00.00.00.000`); quản lý theo **phiên bản + hiệu lực**;
giữ lịch sử; alias; ĐVT chuẩn; mã cũ↔mã thay thế; mã tạm chờ ánh xạ; đề nghị bổ sung.

## 2. Đối chiếu hiện trạng

- `master-data`: `catalog`, `material`, `material-version` — đã có versioning, publish, chống trùng.
- `asset-catalog`: `asset-catalog-item`, `asset-catalog-proposal(+batch)`, util `asset-code`/`asset-classify`.
- `labels`.

## 3. GAP → việc phải làm (backend)

### 3.1 Entity & migration (Quyển I §VIII)

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| `catalog_version` | version_code UNIQUE, version_name, source_document_id, issued_by, effective_from/to, status(enum §3), published_at/by | Máy trạng thái DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED |
| `material_catalog` | version_id FK, code, name, parent_id (self), level_no, unit_id FK, is_leaf, status, effective_from/to, source_row_no · UNIQUE(version_id, code) | mở rộng `material` hiện có; parent-child là cây |
| `material_alias` | material_catalog_id FK, alias_name, alias_code?, alias_type, source?, status, verified_by/at | tìm mã chuẩn từ alias |
| `catalog_replacement` | old_material_id FK, new_material_id FK, effective_date, reason, document_id? | mã cũ→mã mới |
| `unit_of_measure` | code UNIQUE, name, symbol, unit_type, status | chuẩn hóa ĐVT |
| `catalog_import_batch` | file_name, file_hash, source_document_id?, version_code, imported_by/at, total/valid/error_rows, status | |
| `catalog_import_error` | batch_id FK, row_no, field_name, error_code, error_message, raw_value | |
| `catalog_change_request` | request_code UNIQUE, organization_id, request_type, proposed_name, proposed_unit_id?, proposed_parent_id?, description, technical_spec?, status, submitted/reviewed_by/at | tái dùng `asset-catalog-proposal` |
| `temporary_material` | temporary_code UNIQUE, request_id FK, display_name, unit_id?, proposed_parent_id?, status(PENDING_MAPPING…), official_material_id?, mapped_at | **cấm bắt đầu `R00`** |
| `catalog_model_link` | material_catalog_id FK, product_model_id (DT-03), effective_from/to, status | tạo cột, nối khi DT-03 |

### 3.2 Service/API (Quyển I §XII)

```
GET  /catalog/versions                         POST /catalog/versions           POST /catalog/versions/{id}/publish
GET  /catalog/versions/compare                 GET  /catalog/items              GET  /catalog/items/{id}
GET  /catalog/items/{id}/children              GET  /catalog/items/{id}/history GET  /catalog/search?q=  (mã/tên/alias)
POST /catalog/import-batches                   POST /catalog/import-batches/{id}/validate  GET /catalog/import-batches/{id}/errors
POST /catalog/aliases   PUT /catalog/aliases/{id}
POST /catalog/change-requests   .../submit   .../review   .../map-existing   .../assign-official-code
```

### 3.3 Logic bắt buộc
- Import: đọc file → tạo batch → kiểm tra cấu trúc mã, mã trùng, tên trùng/tương tự, quan hệ cha–con, ĐVT → so phiên bản đang hiệu lực → sinh danh sách lỗi/cảnh báo/thay đổi → VALIDATED (chưa dùng cho tới khi publish).
- Publish: `DRAFT→VALIDATED→PUBLISHED`; phiên bản trước `PUBLISHED→SUPERSEDED` tại thời điểm hiệu lực.
- So sánh phiên bản: mã mới / mã bỏ / đổi tên / đổi ĐVT / đổi cấu trúc cha-con.

## 4. Business Rule (Quyển I §VII)

| Mã | Nội dung | Cưỡng chế |
| --- | --- | --- |
| BR-DT01-001 | Mã chính thức duy nhất trong một phiên bản | UNIQUE(version_id, code) |
| BR-DT01-002 | Không xóa vật chất đã được phân hệ khác tham chiếu | chặn xóa → INACTIVE |
| BR-DT01-003 | ≤1 bản ghi ACTIVE/thời điểm hiệu lực | validate effective |
| BR-DT01-004/005 | Không tự làm cha; không vòng lặp cây A→B→C→A | check cycle |
| BR-DT01-006 | Mã tạm **không** bắt đầu `R00` | validator temporary_material |
| BR-DT01-007 | User xã/đơn vị **không** tạo mã R00 chính thức | RBAC + scope |
| BR-DT01-008 | Mã đã công bố không sửa lịch sử; đổi phải tạo version/change record | immutable |
| BR-DT01-009 | Alias không ánh xạ mâu thuẫn 2 mã đang hiệu lực nếu không có cảnh báo/quyết định | check alias conflict |
| BR-DT01-011 | Mã cũ có mã thay thế → cảnh báo người nhập dùng mã hiện hành | replacement warning |
| BR-DT01-012 | Dữ liệu lịch sử tham chiếu phiên bản/mã hiệu lực tại thời điểm phát sinh | version-aware read |

## 5. Webapp (Quyển I §XI)

| Screen | Nội dung |
| --- | --- |
| SCR-DT01-01 Danh mục Doanh trại | trái: cây R00; phải: hồ sơ mã (tab Thông tin, Cây phân loại, Tên khác, Mã cũ/thay thế, Mẫu kỹ thuật, Lịch sử, Dữ liệu sử dụng); thanh: chọn phiên bản, tìm kiếm, lọc, xuất, so sánh |
| SCR-DT01-02 Nhập danh mục | wizard 5 bước: nguồn→upload→mapping cột→kiểm tra→xác nhận; chặn công bố khi còn lỗi nghiêm trọng |
| SCR-DT01-03 So sánh phiên bản | phân biệt thêm/đổi/ngừng, lọc theo loại thay đổi |
| SCR-DT01-04 Đề nghị bổ sung | **bắt buộc tìm toàn danh mục + alias trước** khi tạo đề nghị |
| SCR-DT01-05 Hàng chờ chuẩn hóa | dữ liệu cũ chưa mã, mã tạm, alias chưa xác nhận, đề nghị chờ |

## 6. Test / nghiệm thu (Quyển I §XV)

| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT01-001 | Import file có mã trùng | từ chối dòng trùng + báo lỗi |
| TC-DT01-002 | Node tham chiếu parent không tồn tại | không cho validate |
| TC-DT01-003 | Tạo mã tạm bắt đầu `R00` | từ chối |
| TC-DT01-004 | User xã tạo mã chính thức | 403 |
| TC-DT01-005 | Mã đã có giao dịch bị yêu cầu xóa | không cho xóa |
| TC-DT01-006 | Nhập "Ghế TL" đã có alias | gợi ý mã chuẩn |
| TC-DT01-007 | Phiên bản mới bỏ một số mã | mã cũ vẫn tồn tại trong dữ liệu lịch sử |
| TC-DT01-008 | Mã A thay bằng B | nhập mới cảnh báo dùng B; lịch sử A vẫn tra được |
| TC-DT01-010 | Ánh xạ TEMP→mã chính thức | quan hệ chuyển đúng + audit |

**Chuỗi E2E:** nhận danh mục cấp trên → tạo phiên bản → kiểm tra mã & cấu trúc → công bố →
tra cây R00 → hồ sơ vật chất/alias/mã cũ-mới → đơn vị phát hiện vật chất chưa có mã → đề nghị/tạo mã tạm →
nhận mã chính thức → ánh xạ giữ nguyên lịch sử.

## 7. Definition of Done
- [ ] Đủ 10 bảng §3.1 (migration reversible, index UNIQUE); di trú `material`→`material_catalog` không mất dữ liệu.
- [ ] API §3.2 đủ + Swagger; import batch có file_hash; so sánh phiên bản chạy.
- [ ] BR-DT01-001…012 cưỡng chế; alias search + replacement warning hoạt động.
- [ ] 5 màn hình; wizard nhập chặn lỗi nghiêm trọng; đề nghị bắt buộc tìm trước.
- [ ] TC-DT01-001…010 PASS + chuỗi E2E PASS.
- [ ] Seed golden R00 từ `docs/thu-thap-csdl/` (taxonomy 01KKDT, danh mục Hải Phòng 2026).
- [ ] Cập nhật `01-DOI-CHIEU-GAP.md` (DT-01) + ROADMAP; commit `feat(DT-01): danh mục chuẩn R00 versioned`.

## 8. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-01.01.01 | UC-DT01-01 | catalog_import_batch | POST /import-batches | SCR-DT01-02 | TC-DT01-001 |
| DT-01.02.03 | UC-DT01-05 | material_catalog | GET /catalog/items | SCR-DT01-01 | TC-DT01-002 |
| DT-01.04.09 | UC-DT01-04 | catalog_version | POST /versions/{id}/publish | SCR-DT01-03 | TC-DT01-007 |
| DT-01.05 | UC-DT01-08 | catalog_replacement | replacement APIs | SCR-DT01-01 | TC-DT01-008 |
| DT-01.06 | UC-DT01-09 | material_alias | /catalog/aliases | SCR-DT01-01 | TC-DT01-006 |
| DT-01.10 | UC-DT01-14/15 | temporary_material | mapping APIs | SCR-DT01-05 | TC-DT01-003/010 |
