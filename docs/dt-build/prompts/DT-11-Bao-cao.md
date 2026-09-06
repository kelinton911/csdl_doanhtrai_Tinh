# PROMPT — DT-11: Báo cáo & biểu mẫu (Report Engine)

> **Nguồn:** Quyển XI (DT-11). **Điều kiện mở:** DT-04, DT-10 PASS (nguồn snapshot). Áp quy ước chung.
> **Vai trò:** Report Engine cấu hình được: định nghĩa biểu → dataset từ **snapshot chuẩn** → validate →
> phê duyệt → phát hành (file có checksum, không ghi đè) → truy vết ô về nguồn. Sinh đủ hệ biểu KK.

## 1. Nguyên tắc lõi (Quyển XI PHẦN II)
- Biểu **cấu hình** (report_definition + template_version), **không** hard-code số lượng/khung cứng (17 biểu là danh mục cấu hình).
- Dataset lấy từ **snapshot/dataset chuẩn** (DT-10/04/08/09), có `dataset_hash` + `source_fingerprint`; không đọc số sống.
- Phân biệt **NO_DATA ≠ ZERO ≠ MISSING_SUBMISSION** (đơn vị chưa gửi ≠ 0).
- File phát hành **bất biến** (checksum), phát hành lại = version mới. Mọi ô **truy vết** về dataset→snapshot→giao dịch/định mức.

## 2. Đối chiếu hiện trạng
`reporting` (`report-job`, `land-forms`; xuất PDF DejaVuSans/Excel từ snapshot MinIO). Nền 🟡, mở rộng lớn.

## 3. GAP → backend (Quyển XI PHẦN VIII)

| Bảng | Trường chính |
| --- | --- |
| `report_definition` / `report_template_version` | form_code, title, category, layout_schema_json, effective_from/to, status, version_no |
| `dataset_definition` / `dataset_field` / `dataset_filter` / `dataset_formula` | source_type (DT-04/08/09/10), field_map, filter_expr, formula_expr, unit_id |
| `dataset_instance` | dataset_definition_id, source_snapshot_ref, dataset_hash, source_fingerprint, generated_at, status |
| `dataset_validation` | dataset_instance_id, check_type (reconciliation/quality_total/completeness), status, message |
| `report_instance` | report_definition_id, template_version_id, dataset_instance_id, scope_json, status(DRAFT→VALIDATED→APPROVED→ISSUED→SUPERSEDED), file_id, checksum, issued_at |
| `report_rollup` | parent_report_id, child_org_id, child_instance_id, submission_status(SUBMITTED/MISSING), aggregated (chống trùng) |
| `report_lineage` | report_instance_id, cell_ref, dataset_field, snapshot_ref, transaction/norm_ref |

**Hệ biểu:** 01–06/KKDT, 01–03/KK, 01–04/KK-ĐQP, 01/KK-KGĐ, 01–03/KK-NHA — cấu hình, sinh từ nguồn chuẩn.

## 4. API (Quyển XI §XVI)
```
GET/POST /report-definitions  /{id}/template-versions
GET/POST /dataset-definitions  /{id}/fields  /filters  /formulas
POST /dataset-instances  /{id}/validate
POST /report-instances  /{id}/validate  /{id}/approve  /{id}/issue   GET /report-instances/{id}/download
POST /report-instances/{id}/rollup   GET /report-instances/{id}/rollup-status  (đơn vị chưa gửi)
GET  /report-instances/{id}/lineage?cell=
```

## 5. Business Rule (Quyển XI §VII)
BR-DT11-002 (mỗi ô truy vết về dataset→snapshot→giao dịch/định mức) · -004/019 (biểu cấu hình, không hard-code số lượng) ·
-006 (dataset_hash + source_fingerprint) · -007/009 (validate reconciliation + quality total; NO_DATA≠ZERO≠MISSING_SUBMISSION) ·
-008/020/021 (rollup chống aggregate trùng, drill-down, đơn vị chưa gửi ≠ 0) · -016/017 (workflow ISSUED; file checksum, không ghi đè).

## 6. Webapp (Quyển XI §XV)
SCR-DT11-01 Danh mục biểu (cấu hình) · -02 Thiết kế template/layout · -03 Thiết kế dataset (field/filter/formula) ·
-04 Sinh & validate dataset · -05 Lập báo cáo (chọn snapshot) · -06 Tổng hợp nhiều đơn vị (trạng thái gửi) ·
-07 Duyệt & phát hành · -08 Truy vết ô → nguồn · -09 Kho báo cáo đã phát hành (version).

## 7. Test / nghiệm thu (Quyển XI §XIX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT11-002 | Click 1 ô số liệu | drill-down tới dataset→snapshot→giao dịch |
| TC-DT11-006 | Sinh lại dataset cùng nguồn | dataset_hash trùng |
| TC-DT11-007 | Dataset lệch reconciliation | validate FAIL, chặn phê duyệt |
| TC-DT11-009 | Đơn vị chưa gửi báo cáo | hiển thị MISSING_SUBMISSION, không cộng như 0 |
| TC-DT11-016 | Phát hành lại báo cáo đã ISSUED | tạo version mới, file cũ giữ nguyên checksum |
| TC-DT11-019 | Thêm biểu mới bằng cấu hình | không sửa code |
| TC-DT11-021 | Rollup 2 lần cùng đơn vị con | không aggregate trùng |

**Chuỗi E2E:** cấu hình report_definition + template → dataset_definition từ DT-10 snapshot → sinh dataset + validate →
lập report → rollup nhiều đơn vị (đánh dấu chưa gửi) → duyệt → phát hành (checksum) → drill-down 1 ô → phát hành lại (version).

## 8. Definition of Done
- [ ] report_definition/template_version cấu hình; hệ biểu KK sinh từ nguồn chuẩn (không hard-code số lượng).
- [ ] dataset_instance có dataset_hash + source_fingerprint; validate reconciliation/quality/completeness.
- [ ] NO_DATA≠ZERO≠MISSING_SUBMISSION; rollup chống trùng + drill-down.
- [ ] workflow ISSUED; file checksum, không ghi đè; report_lineage mỗi ô.
- [ ] TC-DT11-001..025 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-11): report engine cấu hình + lineage + rollup`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-11.03 | UC-DT11-06 | dataset_instance | /dataset-instances/{id}/validate | SCR-DT11-04 | TC-DT11-006/007 |
| DT-11.05 | UC-DT11-10 | report_instance | /{id}/issue | SCR-DT11-07 | TC-DT11-016 |
| DT-11.06 | UC-DT11-14 | report_rollup | /{id}/rollup-status | SCR-DT11-06 | TC-DT11-009/021 |
| DT-11.02 | UC-DT11-04 | report_lineage | /{id}/lineage | SCR-DT11-08 | TC-DT11-002 |
