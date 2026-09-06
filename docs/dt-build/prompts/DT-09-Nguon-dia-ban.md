# PROMPT — DT-09: Nguồn địa bàn & cân đối bảo đảm

> **Nguồn:** Quyển IX (DT-09). **Điều kiện mở:** DT-08 PASS (nhận supply_required), DT-02 (địa bàn). Áp quy ước chung.
> **Vai trò:** Hồ sơ **nguồn khai thác tại chỗ** (theo xã/điểm) + engine **cân đối** nhu cầu (DT-08) với
> nguồn nội bộ/địa bàn, chống overbooking, sinh yêu cầu thực thi → DT-05.

## 1. Nguyên tắc lõi (Quyển IX PHẦN II)
- **Nhận** `supply_required` từ DT-08, **không** tính lại NC (SYS-BR: một nguồn sự thật).
- Nguồn có vòng đời tin cậy: UNVERIFIED→VERIFIED→EXPIRED. **VERIFIED ≠ ELIGIBLE** (còn phụ thuộc lead_time, huy động được).
- `Σ(reservation đang hiệu lực) ≤ available` cho mỗi nguồn (optimistic locking chống overbooking).
- `Gap = supply_required − Σ(nguồn đã lập kế hoạch/giữ chỗ)`.

## 2. Đối chiếu hiện trạng
`local-resources` (`local-resource`), engine assurance trong `scenario`. Nền cơ bản 🟡, mở rộng lớn.

## 3. GAP → backend (Quyển IX PHẦN III/VII)

| Bảng | Trường chính |
| --- | --- |
| `territorial_source` / `source_site` | source_code, name, admin_unit_id (xã/điểm DT-02), source_type, contact, status, effective_from/to |
| `source_material` / `source_material_snapshot` | source_id, material_catalog_id, declared_qty, unit_id, price?, as_of_time, snapshot_checksum |
| `source_verification` / `verification_evidence` | source_material_id, status(UNVERIFIED/VERIFIED/EXPIRED), verified_qty, verified_by/at, evidence_file_id, expires_at |
| `mobilization_assessment` | source_material_id, mobilizable_qty (≤ verified_qty), lead_time_days, readiness_level, assessed_at |
| `balance_plan` / `_revision` / `_line` | plan_code, scenario_run_id (DT-08), status(DRAFT→BALANCED→APPROVED→LOCKED), revision_no; line: material, supply_required, planned_source_qty, gap_qty |
| `source_reservation` | balance_line_id, source_material_id, reserved_qty, priority, status(ACTIVE/RELEASED/EXPIRED), row_version |
| `execution_request` / `execution_feedback` | balance_line_id, requested_qty, target_org, status, dt05_document_id?, delivered_qty, feedback_note |
| `balance_snapshot` | plan_revision_id, approved_at, checksum, source_fingerprint (truy tới verification/revision) |

### Dịch vụ candidate (PHẦN VII — 8 bước, có giải thích)
Lọc: material match → verified → không hết hạn → mobilizable>0 → còn available → trong bán kính/địa bàn → lead_time ≤ deadline → ưu tiên. Trả danh sách xếp hạng + lý do loại từng nguồn.

## 4. API (Quyển IX §XVIII)
```
GET/POST /territorial-sources  /{id}/materials  POST /source-materials/{id}/verify  /assess-mobilization
GET/POST /balance-plans  /{id}/revise  /{id}/balance  /{id}/approve  /{id}/lock
GET  /balance-plans/{id}/candidates?line=   (8-step, có explanation)
POST /balance-lines/{id}/reservations  /reservations/{id}/release
POST /balance-lines/{id}/execution-requests   POST /execution-requests/{id}/feedback
GET  /balance-plans/{id}/gap-summary
```

## 5. Business Rule (Quyển IX §VII)
BR-DT09-001/002 (UNVERIFIED→VERIFIED→EXPIRED; VERIFIED ≠ ELIGIBLE) · -003 (mobilizable ≤ verified; xét lead_time) ·
-008 (Σ reservation ≤ available, optimistic locking chống overbooking) · -009 (nhận supply_required, không tính lại NC) ·
-020 (snapshot nguồn tại phê duyệt bất biến + fingerprint) · -028 (execution_request → DT-05; feedback cập nhật delivered).

## 6. Webapp (Quyển IX §XVII)
SCR-DT09-01 Bản đồ/DS nguồn địa bàn · -02 Hồ sơ nguồn (vật chất khai báo + xác minh + evidence) · -03 Đánh giá huy động ·
-04 Lập kế hoạch cân đối (nhận supply_required DT-08) · -05 Gợi ý nguồn (candidate 8 bước + lý do) · -06 Giữ chỗ nguồn ·
-07 Gap & yêu cầu thực thi → DT-05 · -08 Snapshot cân đối · -09 Theo dõi phản hồi thực thi.

## 7. Test / nghiệm thu (Quyển IX §XXI)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT09-001 | Nguồn khai báo chưa xác minh dùng cân đối | cảnh báo/loại; VERIFIED mới ELIGIBLE |
| TC-DT09-003 | mobilizable > verified | từ chối |
| TC-DT09-008 | Hai kế hoạch giữ chỗ vượt available | nguồn thứ 2 bị chặn overbooking |
| TC-DT09-009 | Sửa NC trong DT-09 | không cho; chỉ nhận supply_required từ DT-08 |
| TC-DT09-012 | Nguồn hết hạn xác minh | EXPIRED, loại khỏi candidate |
| TC-DT09-020 | Approve rồi nguồn thay đổi | snapshot cân đối bất biến |
| TC-DT09-028 | Tạo execution_request | sinh yêu cầu → DT-05; feedback cập nhật delivered/gap |

**Chuỗi E2E:** khai báo nguồn theo xã → xác minh + evidence → đánh giá huy động → nhận supply_required (DT-08) →
candidate 8 bước → giữ chỗ (chống overbooking) → gap → execution_request → DT-05 thực thi → feedback → snapshot.

## 8. Definition of Done
- [ ] territorial_source/site/material + verification/evidence/mobilization; VERIFIED≠ELIGIBLE.
- [ ] balance_plan/revision/line nhận supply_required (không tính lại NC); Gap.
- [ ] source_reservation optimistic locking chống overbooking (Σ ≤ available).
- [ ] candidate 8 bước có explanation; execution_request→DT-05 + feedback.
- [ ] balance_snapshot bất biến + fingerprint tới verification/revision.
- [ ] TC-DT09-001..025 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-09): nguồn địa bàn + cân đối chống overbooking`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-09.02 | UC-DT09-04 | source_verification | /source-materials/{id}/verify | SCR-DT09-02 | TC-DT09-001/012 |
| DT-09.05 | UC-DT09-12 | source_reservation | /balance-lines/{id}/reservations | SCR-DT09-06 | TC-DT09-008 |
| DT-09.04 | UC-DT09-10 | balance_plan | /balance-plans/{id}/balance | SCR-DT09-04 | TC-DT09-009 |
| DT-09.07 | UC-DT09-20 | execution_request | /execution-requests | SCR-DT09-07 | TC-DT09-028 |
