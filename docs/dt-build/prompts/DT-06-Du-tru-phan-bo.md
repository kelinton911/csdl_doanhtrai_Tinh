# PROMPT — DT-06: Dự trữ & phân bổ mục đích sử dụng

> **Nguồn:** Quyển VI (DT-06). **Điều kiện mở:** DT-04 PASS (DT-07 để tính đủ/thiếu dự trữ).
> **Vai trò:** Gán **mục đích sử dụng** cho HC (thường xuyên, gối đầu, SSCĐ 4 cấp, đột xuất, chờ xử lý,
> chậm luân chuyển) và **khóa nguồn** theo nhiệm vụ **mà không** dịch chuyển vật chất. Cung cấp
> `PC_SSCĐ` (dự trữ SSCĐ) cho DT-08 và ràng buộc `Σ exclusive ≤ HC_ALLOCATABLE`.

## 1. Nguyên tắc lõi (Quyển VI §III)
- Phân bổ là **lớp phủ ngữ nghĩa** trên HC (DT-04), **không** tự trừ/tạo số tồn (SYS-BR-02).
- Phân biệt allocation **EXCLUSIVE** (khóa cứng, không dùng cho mục đích khác) vs **OVERLAY** (nhãn phân tích).
- Chống tính trùng: `Σ(reservation EXCLUSIVE đang hiệu lực) ≤ HC_ALLOCATABLE` (SYS-BR-05).
- DT-05 làm HC tụt dưới mức đã khóa → chặn/exception (không âm thầm phá reservation).

## 2. Đối chiếu hiện trạng
`readiness-materials` (plan/revision/line — dự trữ SSCĐ 4 cấp + workflow), `readiness`. Có nền 🟡.

## 3. GAP → backend (Quyển VI §IX)

| Bảng | Trường chính |
| --- | --- |
| `allocation_type` | code, name, semantics (EXCLUSIVE/OVERLAY), priority_default, requires_approval, status |
| `inventory_allocation` / `allocation_line` | allocation_no, allocation_type_id, organization_id, mission_id?, effective_from/to, status; line: material/lot ref, quantity, unit_id, priority |
| `allocation_hold` (reservation) | allocation_line_id, material/lot/org, quantity_reserved, priority, effective_from/to, status(ACTIVE/RELEASED/EXPIRED), basis_document_id |
| `reserve_requirement_link` | allocation_id, norm_reference (DT-07), required_qty, allocated_qty, gap_qty (dẫn xuất) |
| `slow_moving_rule` / `slow_moving_evaluation` | rule_version, criteria_json (no-movement days…), evaluated_at, result_qty, overlay |
| `allocation_snapshot` / `_line` | snapshot_code, cutoff_time, scope, checksum, locked_at/by (sinh 01–06/KKDT) |
| `allocation_change_request` | from_type, to_type, quantity, reason, status (SSCĐ cần duyệt) |

**HC_ALLOCATABLE** = HC (DT-04) − (IN_TRANSIT + chờ xử lý loại trừ). Semantic **SEM-RESERVE-SSCD** = Σ hold cấp SSCĐ.

## 4. API (Quyển VI §XVI)
```
GET/POST /allocation-types
GET/POST /allocations  /{id}  /{id}/lines  /{id}/submit  /{id}/approve
POST /allocations/{id}/holds  /holds/{id}/release   GET /allocations/allocatable?material=&org=  (HC_ALLOCATABLE)
POST /allocation-change-requests  /{id}/approve
GET/POST /slow-moving/rules  /slow-moving/evaluate
POST /allocation-snapshots  /{id}/lock  GET /allocation-snapshots/compare
GET /reserve/sscd?scope=  (PC_SSCĐ cho DT-08)
```

## 5. Business Rule (Quyển VI §VIII)
BR-DT06-002 (Σ exclusive ≤ HC_ALLOCATABLE, tính trùng bị chặn) · -006 (chuyển loại qua workflow, atomic, giữ HC) ·
-007 (hold có SL+thời gian+priority) · -008/009 (đối chiếu định mức DT-07: thiếu/đủ/vượt) · -012 (slow-moving là overlay có version) ·
-020 (DT-05 giảm HC dưới hold → chặn/exception) · -023/024 (snapshot cutoff bất biến, checksum) · -027 (đánh giá chậm luân chuyển có version quy tắc).

## 6. Webapp (Quyển VI §XV)
SCR-DT06-01 Bảng phân bổ theo mục đích (stacked) · -02 Lập/sửa allocation · -03 Khóa nguồn theo nhiệm vụ (hold) ·
-04 Dự trữ SSCĐ 4 cấp (từ readiness-materials) · -05 Đối chiếu định mức (thiếu/đủ/vượt) · -06 Chậm luân chuyển ·
-07 Chuyển loại phân bổ (workflow) · -08 Snapshot phân bổ · -09 Cảnh báo tính trùng/vượt HC.

## 7. Test / nghiệm thu (Quyển VI §XIX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT06-002 | Khóa exclusive tổng > HC_ALLOCATABLE | từ chối `OVER_ALLOCATED` |
| TC-DT06-003 | Hai nhiệm vụ cùng khóa 1 lượng | không cộng trùng; chỉ nhận trong giới hạn |
| TC-DT06-006 | Chuyển thường xuyên→SSCĐ | qua duyệt, tổng HC không đổi |
| TC-DT06-008 | So với định mức DT-07 | hiển thị gap thiếu/đủ/vượt đúng |
| TC-DT06-012 | Đánh dấu chậm luân chuyển | overlay, không đổi HC |
| TC-DT06-020 | DT-05 xuất làm HC < hold | chặn/exception, không phá hold ngầm |
| TC-DT06-023 | Snapshot cutoff rồi thay đổi hold | snapshot bất biến |

**Chuỗi E2E:** cấu hình allocation_type → phân bổ đa mục đích → khóa nguồn SSCĐ theo nhiệm vụ →
đối chiếu định mức DT-07 → thử vượt HC (bị chặn) → snapshot cutoff → cấp PC_SSCĐ cho DT-08.

## 8. Definition of Done
- [ ] allocation_type EXCLUSIVE/OVERLAY; inventory_allocation/line/hold.
- [ ] `Σ exclusive ≤ HC_ALLOCATABLE` cưỡng chế; không tính trùng.
- [ ] reserve_requirement_link so định mức DT-07; slow-moving có version.
- [ ] allocation_snapshot + lock; API `/reserve/sscd` cấp PC_SSCĐ cho DT-08.
- [ ] Không tự trừ HC; đồng bộ chặn khi DT-05 làm HC tụt dưới hold.
- [ ] TC-DT06-001..020 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-06): phân bổ mục đích + khóa nguồn SSCĐ + snapshot`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-06.02 | UC-DT06-04 | allocation_hold | /allocations/{id}/holds | SCR-DT06-03 | TC-DT06-002/003 |
| DT-06.03 | UC-DT06-08 | reserve_requirement_link | /reserve/sscd | SCR-DT06-05 | TC-DT06-008 |
| DT-06.05 | UC-DT06-14 | allocation_snapshot | /allocation-snapshots/{id}/lock | SCR-DT06-08 | TC-DT06-023 |
| DT-06.07 | UC-DT06-20 | (guard) | /allocations/allocatable | SCR-DT06-09 | TC-DT06-020 |
