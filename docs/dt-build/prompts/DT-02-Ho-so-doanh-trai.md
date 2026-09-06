# PROMPT — DT-02: Quản lý hồ sơ Doanh trại

> **Nguồn:** Quyển II (DT-02). **Điều kiện mở:** DT-01 PASS. Áp quy ước chung.
> **Vai trò:** Lớp dữ liệu nền không gian – tổ chức – cơ sở vật chất cố định. Cung cấp
> `location_id` cho DT-04. Sinh dữ liệu đầu vào biểu đất/nhà (không tạo bảng theo biểu).

## 1. Mục tiêu
Một hồ sơ số duy nhất cho mỗi cơ sở doanh trại/điểm đất/nhà; mô hình Tỉnh → cơ quan/đơn vị và
Tỉnh → xã/phường/đặc khu (không tầng huyện); bảo toàn địa chỉ lịch sử có huyện/quận; lịch sử
tăng/giảm/bàn giao/chuyển mục đích/pháp lý; liên kết đất→cơ sở→nhà→kho→vị trí→vật chất.

## 2. Đối chiếu hiện trạng
`organization`, `barracks` (+workflow), `facilities`, `land-parcels`, `family-housing`, `utilities`,
`gis` (PostGIS), `storage-location`(+revision) trong `inventory`. Nền mạnh 🟢.

## 3. GAP → backend (Quyển II §VIII)

| Bảng cần bổ sung/hoàn thiện | Trường chính | BR |
| --- | --- | --- |
| `address_snapshot` | province_text, district_text_legacy, commune_text, detail_text, effective_at | BR-DT02-001/023 |
| `land_usage_allocation` | land_point_id, usage_type, area_m2, effective_from/to, basis_doc_id | BR-DT02-004 |
| `land_change_event` | land_point_id, change_type, point_delta, area_delta_m2, effective_date, reason, doc_id | BR-DT02-005/007 |
| `land_legal_document` | land_point_id, doc_type, doc_no, issue_date, issuer, certified_area_m2, verification_status | BR-DT02-008 |
| `land_economic_use` | arrangement_type, legal_basis_type, area_m2, contract_no, start/end_date, status | BR-DT02-011 |
| `family_area` | land_point_id, name, area_m2, household_count, legal_basis, handover_reason, expected_handover_date, status | BR-DT02-009/012 |
| `building`(+structure/use_allocation/repair_assessment/official_housing) | cấp nhà I–IV, công năng, thu sét, kết cấu, sửa chữa | BR-DT02-013..018 |
| `facility_infrastructure` | infra_type (điện/nước/giếng/tường rào/đường), quantity/value, unit, spec, effective_from/to | — |
| `warehouse` / `storage_location` | cây parent_id, location_code, location_type, status | BR-DT02-019/020 |
| `document_attachment` | owner_type/id, doc_type, file_name, file_hash, version, uploaded_by/at | BR-DT02-021 |

**Nguyên tắc:** không dùng huyện/quận làm tầng tổ chức; kiểm tra tổng phân bổ hiện trạng ≤ diện tích
điểm đất; diện tích kỳ kiểm kê lấy từ snapshot (không lấy ngược giá trị hiện hành); không xóa
điểm đất/nhà/vị trí đã có dữ liệu — chỉ chuyển trạng thái.

## 4. API (Quyển II §XIII)
```
GET/POST /organizations   /admin-units   /facilities   GET /facilities/{id}/summary
GET/POST /land-points     POST /land-points/{id}/usage  /legal-documents  /changes
GET/POST /land-economic-uses  /family-areas  /buildings  POST /buildings/{id}/structures /uses /repair-assessments
GET/POST /official-housing  /facility-infrastructure  /warehouses  /storage-locations  POST /documents
GET /dt02/data-quality
```

## 5. Business Rule chính (Quyển II §VII)
BR-DT02-001 (không tầng huyện) · -002 (1 ID/cơ sở, đổi tên không tạo mới) · -003 (điểm đất ≥1 đơn vị + địa bàn) ·
-004 (Σ hiện trạng ≤ diện tích) · -006 (không xóa đã kiểm kê) · -010 (tranh chấp/lấn chiếm là trạng thái riêng) ·
-013/014 (sàn ≥ xây dựng; sử dụng ≤ sàn, ngoại lệ có duyệt) · -019/020 (cây kho không vòng lặp, không xóa vị trí có lịch sử) ·
-024 (DT-02 không tạo số tồn; chỉ cấp location_id).

## 6. Webapp (Quyển II §XII)
SCR-DT02-01 DS cơ sở · -02 Hồ sơ cơ sở (tab Tổng quan/Đất/Nhà/Hạ tầng/Kho/Hồ sơ/Lịch sử) · -03 Hồ sơ điểm đất ·
-04 Biến động đất (timeline) · -05 Hồ sơ nhà · -06 Hạ tầng · -07 Kho & cây vị trí · -08 Hồ sơ pháp lý ·
-09 Kiểm tra chất lượng dữ liệu · -10 Tra cứu/bản đồ (GIS optional).

## 7. Test / nghiệm thu (Quyển II §XVII)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT02-001 | Tạo cơ sở tại xã/phường | không yêu cầu huyện |
| TC-DT02-002 | Import địa chỉ cũ có huyện/quận | lưu snapshot lịch sử, không sinh node huyện |
| TC-DT02-003 | Điểm đất diện tích ≤0 | từ chối |
| TC-DT02-004 | Phân bổ hiện trạng vượt tổng | từ chối duyệt |
| TC-DT02-007 | Ghi tăng +500m² | snapshot kỳ sau tăng, kỳ trước không đổi |
| TC-DT02-012 | Nhà usable > floor | từ chối/ngoại lệ có thẩm quyền |
| TC-DT02-017 | storage_location parent = chính nó | từ chối |
| TC-DT02-018 | Xóa vị trí đã có lịch sử vật chất | từ chối; chỉ INACTIVE |
| TC-DT02-020 | Sinh dữ liệu 03/KK-ĐQP | tổng khớp domain tại snapshot |

**Chuỗi E2E:** tạo cơ sở → điểm đất + hiện trạng + pháp lý + biến động → nhà + kết cấu + công năng →
hạ tầng → kho + cây vị trí → tái lập biểu đất/nhà tại snapshot kiểm kê.

## 8. Definition of Done
- [ ] Bảng §3 đầy đủ (migration reversible); address_snapshot bảo toàn địa chỉ lịch sử.
- [ ] API §4 + `/dt02/data-quality` (DQ-DT02-01..12).
- [ ] BR §5 cưỡng chế; cây kho chống vòng lặp + không xóa vị trí có lịch sử.
- [ ] Màn hình §6; timeline biến động; kiểm tra chất lượng dữ liệu.
- [ ] TC-DT02-001..021 PASS + E2E.
- [ ] Cung cấp `location_id` ổn định cho DT-04; nối GIS geometry cho điểm/nhà/kho khi có tọa độ.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-02): hồ sơ doanh trại + đất/nhà/kho + snapshot`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-02.03.01 | UC-DT02-03 | facility | POST /facilities | SCR-DT02-02 | TC-DT02-001 |
| DT-02.06 | UC-DT02-06 | land_usage_allocation | POST /land-points/{id}/usage | SCR-DT02-03 | TC-DT02-004 |
| DT-02.07 | UC-DT02-08/09 | land_change_event | POST /land-points/{id}/changes | SCR-DT02-04 | TC-DT02-007 |
| DT-02.16 | UC-DT02-21 | warehouse/storage_location | /warehouses,/storage-locations | SCR-DT02-07 | TC-DT02-017/018 |
