# PROMPT — DT-07: Định mức, quy định dự trữ & Chỉ lệnh hậu cần

> **Nguồn:** Quyển VII (DT-07). **Điều kiện mở:** DT-01, DT-04 PASS. Mức 🔴 → build mới phần lớn.
> **Vai trò:** Kho **quy tắc định mức** có căn cứ pháp lý + bộ **chọn định mức deterministic**
> phục vụ DT-08 (`/norms/resolve` → SELECTED/NO_RULE/CONFLICT + trace). Quản lý **Chỉ lệnh hậu cần**.

## 1. Nguyên tắc lõi (Quyển VII §II)
- Mỗi định mức gắn **văn bản căn cứ** (file_hash, trang/dòng); không có căn cứ → LEGACY_UNVERIFIED, không dùng chính thức.
- Định mức PUBLISHED **bất biến** (SYS-BR-03); sửa → version mới. Import Excel chỉ tạo DRAFT.
- Chọn định mức phải **deterministic + giải thích được**; xung đột **không tự chọn** → CONFLICT (SYS-BR-04: NO_RULE/CONFLICT ≠ 0).
- Semantic phân biệt tham số: CONSUMPTION_PREPARATION (GĐCB), CONSUMPTION_COMBAT (GĐCĐ), POST_COMBAT_REQUIRED, RESERVE_*.

## 2. Đối chiếu hiện trạng
`logistics-norms` (một bảng `logistics-calc-norm` phẳng). Thiếu văn bản căn cứ, scope đa chiều, selector, chỉ lệnh. 🔴.

## 3. GAP → backend (Quyển VII §VIII/§X/§XI/§XV)

| Bảng | Trường chính |
| --- | --- |
| `normative_document` / `_version` | doc_no, title, issuing_authority, issue_date, file_id, file_hash, effective_from/to, status |
| `norm_source_reference` / `norm_appendix` | document_version_id, page_no, line_ref, quote_text, appendix_code |
| `norm_set` / `norm_set_version` | set_code, name, document_version_id, status(DRAFT→PUBLISHED→SUPERSEDED), published_at |
| `material_norm` | norm_set_version_id, material_catalog_id, value_type(FIXED/PER_UNIT/FORMULA/LOOKUP), value_numeric, raw_value, unit_id, formula_expr?, semantic_param, effective_from/to |
| `norm_scope` / `norm_dimension` | material_norm_id, dimension_type (material/org/territory/mission/phase/quality/scale/time), dimension_value |
| `norm_selector_config` / `authority_rank_version` | strategy, tie_break_order, rank_json |
| `norm_conflict_case` | resolve_request_hash, candidate_norm_ids, status(OPEN/RESOLVED), resolution_note |
| `calculation_parameter` | semantic_param, description, unit_id (định nghĩa ngữ nghĩa cho DT-08) |
| `command` / `command_version` / `command_requirement` / `command_assignment` / `command_progress` | command_no, title, issuing_authority, effective_date; requirement: material, qty, deadline; assignment: org, allocated_qty; progress: reported_qty, status |

### Dịch vụ `/norms/resolve` (DT-08 gọi)
Input: material_catalog_id, semantic_param, scope{org, territory, mission, phase, quality, scale, time}, as_of_time.
Output: `SELECTED{norm_id, value, source_reference}` | `NO_RULE` | `CONFLICT{candidates}` + **explanation trace** (dimensions matched, rank applied). Không bao giờ ngầm trả 0.

## 4. API (Quyển VII §XVII)
```
GET/POST /normative-documents  /{id}/versions  /versions/{id}/references
GET/POST /norm-sets  /{id}/versions  /{id}/publish
GET/POST /norm-set-versions/{id}/norms   POST /norms/{id}/scopes
POST /norms/resolve            GET /norm-conflicts  /{id}/resolve
GET/POST /calculation-parameters
GET/POST /commands  /{id}/versions  /{id}/requirements  /{id}/assignments  POST /commands/{id}/progress
```

## 5. Business Rule (Quyển VII §VII)
BR-DT07-002 (PUBLISHED bất biến → version mới) · -007 (resolve deterministic + trace) · -008 (xung đột không tự chọn → CONFLICT) ·
-011 (giữ raw_value + đơn vị gốc) · -016 (định mức hết hiệu lực không áp cho as_of trong tương lai) ·
-026 (import Excel → DRAFT; legacy chưa căn cứ → LEGACY_UNVERIFIED) · -027 (authority_rank có version, thay đổi không hồi tố kết quả đã chốt) ·
-031 (command_requirement tham chiếu định mức PUBLISHED tại effective_date).

## 6. Webapp (Quyển VII §XVI)
SCR-DT07-01 Thư viện văn bản căn cứ · -02 Bộ định mức + version · -03 Biên tập định mức (scope đa chiều, semantic_param) ·
-04 Nhập Excel định mức (DRAFT + đối chiếu) · -05 Thử `resolve` (mô phỏng chọn + trace) · -06 Hàng chờ xung đột định mức ·
-07 Chỉ lệnh hậu cần (yêu cầu/phân giao/tiến độ) · -08 Legacy chưa xác minh.

## 7. Test / nghiệm thu (Quyển VII §XX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT07-002 | Sửa định mức PUBLISHED | từ chối; buộc tạo version |
| TC-DT07-007 | resolve có đúng 1 match | SELECTED + source_reference + trace |
| TC-DT07-008 | resolve 2 định mức cùng độ ưu tiên | CONFLICT, không tự chọn |
| TC-DT07-009 | resolve không match | NO_RULE (không trả 0) |
| TC-DT07-011 | Định mức nhập từ Excel | trạng thái DRAFT, chưa dùng resolve |
| TC-DT07-016 | resolve as_of sau khi định mức hết hiệu lực | không áp định mức đã hết hiệu lực |
| TC-DT07-026 | Legacy chưa có căn cứ | LEGACY_UNVERIFIED, cảnh báo khi dùng |
| TC-DT07-031 | Chỉ lệnh tham chiếu định mức | gắn đúng version PUBLISHED tại effective_date |

**Chuỗi E2E:** nạp văn bản căn cứ → tạo norm_set + material_norm (scope org+mission+phase) → publish →
`resolve` (SELECTED/NO_RULE/CONFLICT) → resolve xung đột → phát hành Chỉ lệnh → phân giao → cập nhật tiến độ.

## 8. Definition of Done
- [ ] normative_document + reference (file_hash, trang/dòng); norm_set/version/material_norm + scope đa chiều.
- [ ] `/norms/resolve` deterministic, trả SELECTED/NO_RULE/CONFLICT + explanation; **không** ngầm 0.
- [ ] PUBLISHED bất biến; import Excel→DRAFT; LEGACY_UNVERIFIED.
- [ ] calculation_parameter semantic đủ cho DT-08; authority_rank có version.
- [ ] command/version/requirement/assignment/progress.
- [ ] TC-DT07-001..030 PASS + E2E; `backend npm test` xanh.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-07): định mức có căn cứ + selector deterministic + chỉ lệnh`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-07.03 | UC-DT07-06 | material_norm/norm_scope | POST /norms/{id}/scopes | SCR-DT07-03 | TC-DT07-007 |
| DT-07.05 | UC-DT07-10 | norm_selector_config | POST /norms/resolve | SCR-DT07-05 | TC-DT07-008/009 |
| DT-07.02 | UC-DT07-03 | norm_set_version | /norm-sets/{id}/publish | SCR-DT07-02 | TC-DT07-002 |
| DT-07.08 | UC-DT07-18 | command_* | /commands | SCR-DT07-07 | TC-DT07-031 |
