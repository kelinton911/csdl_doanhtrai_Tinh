# PROMPT — DT-12: Dashboard chỉ huy & hỗ trợ quyết định

> **Nguồn:** Quyển XII (DT-12). **Điều kiện mở:** DT-04..DT-11 có dữ liệu (mở sau cùng). Áp quy ước chung.
> **Vai trò:** Lớp **semantic/KPI** + **Data Mart** đọc từ các phân hệ, hiển thị chỉ huy, cảnh báo, what-if.
> **Không** tạo "số Dashboard" độc lập — mọi KPI có **lineage** về nguồn (AC-15).

## 1. Nguyên tắc lõi (Quyển XII PHẦN III)
- Semantic thống nhất, phân biệt rõ: **SEM-HC / SEM-HC-AVAILABLE / SEM-RESERVE-SSCD / SEM-PC-SCD / SEM-NC / SEM-SUPPLY-REQUIRED / SEM-GAP**.
- KPI có `as_of_time` + freshness (STALE khi nguồn cũ); mọi metric drill-down tới phân hệ nguồn.
- What-if **cách ly** (không ghi ngược dữ liệu vận hành).
- Data Mart là **dẫn xuất** (refresh qua outbox/job), không phải nguồn sự thật.

## 2. Đối chiếu hiện trạng
`dashboard` (summary), `analytics`, `alerts` (rule engine, gom trùng, assign, SLA). Nền 🟡, mở rộng lớn.

## 3. GAP → backend (Quyển XII PHẦN VII/VIII/XI)

| Bảng | Trường chính |
| --- | --- |
| `kpi_definition` / `kpi_formula_version` | kpi_code, name, semantic_ref, formula_expr, unit, effective_from/to, status |
| `kpi_threshold` | kpi_definition_id, scope, warn_level, critical_level, direction |
| `metric_instance` | kpi_definition_id, scope_json, as_of_time, value, lineage_json, freshness_status, computed_at |
| `dim_time` / `dim_material` / `dim_org` / `dim_location` / `dim_mission` / `dim_quality` | star schema dimensions |
| `fact_inventory` / `fact_requirement` / `fact_balance` / `fact_count` | measures + FK dims + snapshot_ref |
| `alert_rule` / `alert_instance` / `alert_assignment` | rule config (ngưỡng+severity+SLA), lifecycle(OPEN→ACK→RESOLVED), assignee (mở rộng `alerts`) |
| `decision_session` / `decision_option` / `decision_criterion` / `decision_score` / `decision_record` | what-if isolation, ghi lại quyết định |

## 4. API (Quyển XII §XV)
```
GET/POST /kpi-definitions  /{id}/thresholds
GET  /metrics?kpi=&scope=&as_of=   GET /metrics/{id}/lineage   GET /metrics/{id}/drill-down
POST /data-mart/refresh   GET /data-mart/freshness
GET/POST /alert-rules  GET /alerts  /{id}/ack  /{id}/resolve  /{id}/assign
POST /decision-sessions  /{id}/options  /{id}/score  /{id}/record   (what-if isolated)
GET  /dashboard/command-overview?scope=
GET  /map/materials?scope=   (theo phân quyền vị trí)
```

## 5. Business Rule (Quyển XII §VII)
AC-15 (không tạo số Dashboard độc lập; mọi KPI có lineage) · semantic phân biệt HC/HC-AVAILABLE/RESERVE-SSCD/PC-SCD/SUPPLY-REQUIRED/GAP ·
metric có as_of_time + freshness (STALE) · what-if không ghi ngược vận hành · bản đồ/drill-down theo data-scope (SYS-BR-08) ·
Data Mart refresh qua outbox, không sửa tay.

## 6. Webapp (Quyển XII §XIV)
SCR-DT12-01 Tổng quan chỉ huy (KPI + freshness) · -02 Bản đồ vật chất theo quyền vị trí · -03 Drill-down KPI→nguồn ·
-04 Semantic explorer (HC/HC-AVAILABLE/NC/GAP…) · -05 Cảnh báo (lifecycle + SLA) · -06 What-if (cách ly) ·
-07 Hỗ trợ quyết định (option/criterion/score) · -08 Độ tươi dữ liệu & nguồn.

## 7. Test / nghiệm thu (Quyển XII §XVIII)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT12-001 | Click KPI HC | drill-down tới DT-04 snapshot, khớp số |
| TC-DT12-003 | So SEM-HC vs SEM-HC-AVAILABLE | khác nhau đúng (trừ hold/in-transit) |
| TC-DT12-006 | Nguồn chưa refresh | KPI hiển thị STALE + as_of_time |
| TC-DT12-008 | What-if đổi tham số | không thay đổi dữ liệu vận hành |
| TC-DT12-010 | User xã xem bản đồ | chỉ thấy vị trí trong phạm vi (data-scope) |
| TC-DT12-012 | Cảnh báo vượt ngưỡng | sinh alert đúng severity + SLA |
| TC-DT12-015 | KPI bất kỳ | có lineage; không có "số Dashboard" tự chế |

**Chuỗi E2E:** định nghĩa KPI (semantic) → refresh Data Mart → tổng quan chỉ huy → drill-down HC về DT-04 →
so semantic HC vs HC-AVAILABLE vs GAP → cảnh báo vượt ngưỡng → what-if cách ly → ghi quyết định.

## 8. Definition of Done
- [ ] kpi_definition + formula_version + threshold + metric_instance (as_of_time + lineage + freshness).
- [ ] Data Mart star schema + refresh qua outbox; drill-down mọi KPI về nguồn.
- [ ] Semantic phân biệt HC/HC-AVAILABLE/RESERVE-SSCD/PC-SCD/SUPPLY-REQUIRED/GAP.
- [ ] alert lifecycle + SLA; bản đồ/drill-down theo data-scope; what-if cách ly.
- [ ] Không tạo số Dashboard độc lập (AC-15).
- [ ] TC-DT12-001..020 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-12): dashboard KPI semantic + data mart + lineage`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-12.01 | UC-DT12-02 | metric_instance | /metrics/{id}/lineage | SCR-DT12-03 | TC-DT12-001/015 |
| DT-12.03 | UC-DT12-06 | kpi_definition | /metrics?kpi= | SCR-DT12-04 | TC-DT12-003 |
| DT-12.05 | UC-DT12-10 | alert_rule/instance | /alerts/{id}/ack | SCR-DT12-05 | TC-DT12-012 |
| DT-12.06 | UC-DT12-14 | decision_session | /decision-sessions | SCR-DT12-06 | TC-DT12-008 |
