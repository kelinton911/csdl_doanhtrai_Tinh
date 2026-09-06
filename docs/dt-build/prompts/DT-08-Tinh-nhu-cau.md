# PROMPT — DT-08: Tính toán nhu cầu vật chất

> **Nguồn:** Quyển VIII (DT-08). **Điều kiện mở:** DT-04, DT-06, DT-07 PASS. Áp quy ước chung.
> **Vai trò:** Engine tính nhu cầu bảo đảm theo nhiệm vụ/kịch bản: kết hợp **định mức (DT-07)** +
> **thực lực HC (DT-04)** + **dự trữ SSCĐ (DT-06)**. Đầu ra `supply_required` cho DT-09.

## 1. Công thức lõi (Quyển VIII §II — bất biến toàn hệ thống)
```
TT      = TT_GĐCB + TT_GĐCĐ          (tiêu thụ = giai đoạn chuẩn bị + chiến đấu)
NC      = TT + PC_SSCĐ − HC          (nhu cầu = tiêu thụ + dự trữ SSCĐ − hiện có)
supply_required = max(NC, 0)         (trường DẪN XUẤT, KHÔNG tự ghi 0 vào NC)
```
- TT_GĐCB/TT_GĐCĐ lưu **riêng** (BR-DT08-020). NC âm giữ nguyên dấu; `supply_required` mới là max(NC,0).
- HC lấy từ **hc_snapshot** (DT-04 as-of), không đọc số dư sống. PC_SSCĐ từ DT-06. Định mức qua DT-07 `resolve`.
- NO_RULE/CONFLICT (DT-07) **không** quy 0 — đánh dấu dòng cần xử lý (SYS-BR-04).

## 2. Đối chiếu hiện trạng
`scenario` (scenario/run/plan — engine assurance-v1 + compare/approve bất biến), `readiness-materials`. Nền 🟡, mở rộng lớn.

## 3. GAP → backend (Quyển VIII §VIII/§XV)

| Bảng | Trường chính |
| --- | --- |
| `calculation_scenario` | scenario_code, mission_id, scope_json, effective_time, engine_version, revision_no, status(DRAFT→CALCULATED→LOCKED), based_on_id |
| `calculation_run` | scenario_id, input_hash, output_hash, engine_version, started/finished_at, status |
| `material_calculation` | run_id, material_catalog_id, phase, **tt_gdcb**, **tt_gdcd**, **tt**, **pc_sscd**, **hc**, **nc**, **supply_required**, unit_id, rule_status(SELECTED/NO_RULE/CONFLICT) |
| `rule_resolution_snapshot` | run_id, material, semantic_param, resolved_norm_id?, status, source_reference, explanation_json |
| `hc_snapshot_ref` | run_id, dt04_snapshot_id, as_of_time, scope, locked |
| `calculation_step` / `calculation_trace_node` | material_calculation_id, step_type, input_refs, formula, output_value (giải thích tới nguồn) |
| `scenario_comparison` | base_run_id, target_run_id, delta_json (ΔNC + nguyên nhân) |

## 4. API (Quyển VIII §XVIII)
```
GET/POST /calculation-scenarios  /{id}  /{id}/revise
POST /calculation-scenarios/{id}/run   GET /runs/{id}   GET /runs/{id}/materials   GET /runs/{id}/materials/{mid}/trace
POST /calculation-scenarios/{id}/lock
GET  /runs/compare?base=&target=
GET  /runs/{id}/supply-required   (cho DT-09)
GET  /runs/{id}/exceptions        (NO_RULE/CONFLICT/NO_HC_SNAPSHOT)
```

## 5. Business Rule (Quyển VIII §VII)
BR-DT08-004 (NC âm giữ nguyên) · -006 (supply_required=max(NC,0) dẫn xuất) · -008 (gọi DT-07 resolve, lưu snapshot rule) ·
-011/012 (LOCK bất biến; nguồn đổi → clone/revision, không sửa run cũ) · -016/017 (cùng input_hash+engine_version → cùng output_hash) ·
-020 (lưu riêng TT_GĐCB/TT_GĐCĐ) · -021 (HC từ hc_snapshot as-of, không đọc số dư sống) · -024 (mỗi dòng truy tới định mức + HC + dự trữ).

## 6. Webapp (Quyển VIII §XVII)
SCR-DT08-01 DS kịch bản · -02 Lập kịch bản (nhiệm vụ/phạm vi/effective_time) · -03 Bảng kết quả (TT_GĐCB/TT_GĐCĐ/TT/PC_SSCĐ/HC/NC/supply_required) ·
-04 Diễn giải 1 dòng (trace tới định mức/HC/dự trữ) · -05 Hàng chờ ngoại lệ (NO_RULE/CONFLICT) · -06 So sánh kịch bản (ΔNC) · -07 Khóa & bàn giao DT-09.

## 7. Test / nghiệm thu (Quyển VIII §XXII)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT08-004 | HC > TT+PC_SSCĐ | NC âm hiển thị đúng; supply_required=0; NC không bị ghi 0 |
| TC-DT08-006 | Định mức NO_RULE 1 vật chất | dòng đánh dấu NO_RULE, không tính 0 âm thầm |
| TC-DT08-008 | Định mức CONFLICT | dòng CONFLICT, chờ xử lý, không auto chọn |
| TC-DT08-016 | Chạy lại cùng input | output_hash trùng (tái lập) |
| TC-DT08-011 | Sửa scenario đã LOCK | từ chối; buộc revise (clone) |
| TC-DT08-020 | Kiểm tra lưu TT_GĐCB/TT_GĐCĐ | hai giá trị lưu riêng, tổng = TT |
| TC-DT08-021 | Thiếu hc_snapshot | `NO_HC_SNAPSHOT`, không đọc số dư sống |
| TC-DT08-024 | Trace 1 dòng | tới định mức (source_reference) + HC snapshot + PC_SSCĐ |

**Chuỗi E2E:** tạo kịch bản → chốt hc_snapshot (DT-04) + resolve định mức (DT-07) + PC_SSCĐ (DT-06) →
run → xem bảng NC + trace → xử lý NO_RULE/CONFLICT → so sánh 2 kịch bản → LOCK → cấp supply_required cho DT-09.

## 8. Definition of Done
- [ ] material_calculation lưu riêng TT_GĐCB/TT_GĐCĐ/TT/PC_SSCĐ/HC/NC/supply_required.
- [ ] Gọi DT-07 resolve + lưu rule_resolution_snapshot; NO_RULE/CONFLICT không quy 0.
- [ ] HC từ hc_snapshot as-of (DT-04); thiếu → NO_HC_SNAPSHOT.
- [ ] input_hash/output_hash + engine_version → tái lập; LOCK bất biến, revise=clone.
- [ ] Trace tới nguồn; so sánh scenario ΔNC; API supply_required cho DT-09.
- [ ] TC-DT08-001..025 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-08): engine tính nhu cầu NC=TT+PC_SSCĐ−HC + trace`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-08.02 | UC-DT08-04 | material_calculation | /{id}/run | SCR-DT08-03 | TC-DT08-004/020 |
| DT-08.03 | UC-DT08-06 | rule_resolution_snapshot | /runs/{id}/exceptions | SCR-DT08-05 | TC-DT08-006/008 |
| DT-08.04 | UC-DT08-10 | calculation_run | /runs/compare | SCR-DT08-06 | TC-DT08-016 |
| DT-08.05 | UC-DT08-12 | calculation_trace_node | /runs/{id}/materials/{mid}/trace | SCR-DT08-04 | TC-DT08-024 |
