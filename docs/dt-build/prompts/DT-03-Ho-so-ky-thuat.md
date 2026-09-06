# PROMPT — DT-03: Hồ sơ kỹ thuật vật chất Doanh trại

> **Nguồn:** Quyển III (DT-03). **Điều kiện mở:** DT-01 PASS (song song DT-02). Mức hiện tại 🔴 → build mới phần lớn.
> **Vai trò:** "Hồ sơ kỹ thuật số" của loại vật chất/mẫu sản phẩm: mẫu, ký hiệu thiết kế, bản vẽ,
> quy cách, BOM, nhãn, phiên bản/thay thế, liên kết mã R00. DT-04 tham chiếu model/revision cho lô/tài sản.

## 1. Mục tiêu (Quyển III §I.2)
Một R00 có thể có **nhiều** product_model; một model có **nhiều** design_revision (2016/K24…), không
ghi đè; bản vẽ là tập nhiều tờ; thông số giữ raw_value + nguồn; BOM tách khỏi tồn kho; nhãn ≠ QR asset;
OCR/trích tự động chỉ DRAFT_EXTRACTED cho tới khi VERIFIED.

## 2. Đối chiếu hiện trạng
`asset-catalog` (mục lục ký hiệu), `documents` (upload MinIO + checksum + presigned). Chưa có lớp hồ sơ
kỹ thuật có cấu trúc → xây mới.

## 3. GAP → backend (Quyển III §VIII)

| Bảng | Trường chính |
| --- | --- |
| `product_model` | model_code_internal, model_name, short_name, design_symbol, design_year, issuing_authority, technology_group, status |
| `model_catalog_link` | product_model_id, material_catalog_id, link_type, effective_from/to, status, basis_document_id |
| `design_revision` | product_model_id, revision_code, effective_from/to, status, supersedes_revision_id, change_summary, published_at |
| `technical_document` | revision_id, document_type, title, file_id, file_hash, source_name, issue_date, total_sheets, status |
| `drawing_sheet` | technical_document_id, sheet_no, sheet_title, sheet_type, scale_text, source_page, preview_file_id, status |
| `technical_specification` + `technical_attribute` / `dimension_spec` / `material_spec` | value_numeric, raw_value, raw_unit, unit_id, verification_status, source_sheet_id |
| `bom_header` / `bom_item` / `component_catalog` | line_no, group_name, component_id?, raw_name, unit_id, quantity, length/width/thickness_mm, verification_status |
| `product_label_spec` / `label_field` | label_name, material, size, background_text, placement, source_sheet_id |
| `design_approval` | revision_id, document_no, document_date, issuing_authority, file_id, effective_from |
| `source_provenance` / `verification_log` | entity_type/id, source_file, source_page, extraction_method, confidence_level, verification_status, verified_by/at |
| `model_relationship` | source_model_id, target_model_id, relationship_type, basis_document_id, status |
| `conformity_criterion` | revision_id, criterion_type, attribute_id, comparator, expected_value, tolerance, mandatory |

**Trạng thái revision:** DRAFT→EXTRACTED→UNDER_TECHNICAL_REVIEW→VERIFIED→PUBLISHED→SUPERSEDED→ARCHIVED.
**Độ đầy đủ hồ sơ:** INCOMPLETE→PARTIAL→COMPLETE_VERIFIED (bản vẽ/thông số/BOM/nhãn/văn bản/nguồn).

## 4. API (Quyển III §XII)
```
GET/POST /technical-models   /technical-models/{id}   POST /technical-models/{id}/catalog-links /revisions
GET /revisions/{id}  POST /revisions/{id}/publish  GET /revisions/compare
POST /revisions/{id}/documents  GET/POST /documents/{id}/sheets
POST /revisions/{id}/specifications  /specifications/{id}/attributes /dimensions
POST /revisions/{id}/boms  /boms/{id}/items  GET /boms/{id}/export
POST /revisions/{id}/labels  /approvals   POST /verification/{entityType}/{id}
POST /model-relationships   GET /technical-completeness   GET /technical-models/{id}/export
```

## 5. Business Rule chính (Quyển III §VII)
BR-DT03-001 (ký hiệu thiết kế ≠ R00 ≠ asset_code) · -002 (1 R00 ↔ N model) · -004 (không xóa revision đã được
lô/mua sắm/kiểm kê tham chiếu) · -005 (bản vẽ bất biến theo hash, sửa → file/version mới) · -006 (thông số chỉ
chính thức khi VERIFIED) · -007 (giữ raw_value/unit/source_reference) · -012 (nhãn ≠ QR/Barcode) ·
-013 (thay thế 2016↔K24 phải có căn cứ, không suy từ tên gần giống) · -014 (revision mới thay cũ, tài sản lịch sử
giữ revision đã nhận dạng) · -024 (xuất hồ sơ ghi rõ revision + hiệu lực).

## 6. Webapp (Quyển III §XI)
SCR-DT03-01 Thư viện mẫu · -02 Hồ sơ kỹ thuật (tab Tổng quan/Bản vẽ/Thông số/BOM/Nhãn/Văn bản/Revision/Lịch sử) ·
-03 Trình xem bản vẽ · -04 Biên tập BOM (raw_name + ánh xạ component) · -05 So sánh revision ·
-06 Xác minh dữ liệu nguồn (crop tờ + VERIFIED/REJECTED/NEEDS_VERIFICATION) · -07 Nhãn · -08 Dashboard độ đầy đủ.

## 7. Test / nghiệm thu (Quyển III §XVIII)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT03-001 | 2 model khác cùng R00 | cho phép, hiển thị danh sách |
| TC-DT03-003 | Upload lại PDF cùng hash | cảnh báo trùng, không nhân bản |
| TC-DT03-005 | BOM item chưa ánh xạ component | lưu raw_name UNMAPPED |
| TC-DT03-006 | Giá trị OCR chưa VERIFIED dùng làm tiêu chí | từ chối |
| TC-DT03-007 | Revision mới PUBLISHED thay cũ | cũ→SUPERSEDED; tài sản lịch sử giữ liên kết cũ |
| TC-DT03-008 | A thay B và B thay A | từ chối vòng lặp |
| TC-DT03-013 | Tài sản DT-04 không xác định model | UNKNOWN/UNVERIFIED, không ép gán |
| TC-DT03-017/018 | Tìm `19.GTL-K24` / `GCB-Go-2016-TCHC` | trả đúng Ghế/Giường tương ứng |

**Chuỗi E2E (≥3 kiểu vật chất: gỗ, kim loại, nhựa):** R00→model→ký hiệu→revision→bộ bản vẽ nhiều tờ→
thông số→BOM→nhãn→văn bản→truy nguồn từng dữ liệu→xác minh→công bố→so sánh 2016/K24→DT-04 gắn model/revision.

## 8. Definition of Done
- [ ] Bảng §3 đủ; bản vẽ bất biến theo hash; revision không ghi đè.
- [ ] API §4 + xác minh + completeness dashboard.
- [ ] BR §5 cưỡng chế; source_provenance cho mọi giá trị VERIFIED.
- [ ] Nối `catalog_model_link` (DT-01) và `asset_technical_identity` (DT-04).
- [ ] TC-DT03-001..020 PASS + E2E 3 kiểu vật chất.
- [ ] Seed mẫu từ `docs/thu-thap-csdl/ma-ky-hieu-doanh-cu-thiet-ke-mau.csv`.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-03): hồ sơ kỹ thuật model/revision/bản vẽ/BOM`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-03.01 | UC-DT03-01 | product_model | /technical-models | SCR-DT03-01 | TC-DT03-001 |
| DT-03.04 | UC-DT03-04/14 | design_revision | /revisions | SCR-DT03-05 | TC-DT03-007/008 |
| DT-03.05-06 | UC-DT03-05/06 | technical_document/drawing_sheet | /documents,/sheets | SCR-DT03-03 | TC-DT03-003 |
| DT-03.09-10 | UC-DT03-09/10 | bom_* | /boms | SCR-DT03-04 | TC-DT03-005 |
| DT-03.13 | UC-DT03-13 | source_provenance | /verification | SCR-DT03-06 | TC-DT03-006 |
