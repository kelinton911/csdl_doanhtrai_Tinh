# PROMPT — DT-10: Kiểm kê & chốt số liệu

> **Nguồn:** Quyển X (DT-10). **Điều kiện mở:** DT-04, DT-05 PASS. Áp quy ước chung.
> **Vai trò:** Đợt kiểm kê định kỳ/đột xuất: dựng **sổ sách tại cutoff** (bất biến), kiểm đếm **thực tế**
> độc lập, đối chiếu lệch, chốt **số liệu chính thức** (khóa), sinh điều chỉnh → DT-05 và dataset → DT-11.

## 1. Nguyên tắc lõi (Quyển X PHẦN II)
- Ba lớp **độc lập**: Book (sổ sách tại cutoff) / Physical (kiểm đếm thực) / Official (chốt sau đối chiếu).
- **Blind count**: không lộ số sổ sách khi kiểm đếm; recount là **vòng mới**, không ghi đè vòng trước.
- book_snapshot **bất biến** (checksum) — dựng từ DT-04/05 tại cutoff_time, không đọc số sống.
- Điều chỉnh sau kiểm kê **không** sửa số dư trực tiếp → tạo `adjustment_request` → **DT-05** (SYS-BR-02).
- official_snapshot khóa bất biến; sửa sau khóa = revision có version + lý do.

## 2. Đối chiếu hiện trạng
`inspection` (campaign/sheet/line/review-task/variance), `approvals`. Có nền tốt 🟡.

## 3. GAP → backend (Quyển X PHẦN VIII)

| Bảng | Trường chính |
| --- | --- |
| `inventory_count_campaign` | campaign_code, count_type(PERIODIC/EXTRAORDINARY/HANDOVER/POST_EVENT), scope_json, cutoff_time, status, created_by |
| `book_snapshot` / `book_snapshot_line` | campaign_id, as_of=cutoff_time, checksum, locked; line: material/lot/location, book_qty, grade1..5, value |
| `count_sheet` / `count_line` | campaign_id, org/location scope, assignee, status; line: material, physical_qty, quality_grade, note, round_no |
| `recount_round` | count_sheet_id, round_no, reason, created_at |
| `count_variance` | campaign_id, material/location, book_qty, physical_qty, variance_qty, variance_type(SHORTAGE/SURPLUS/UNBOOKED/MISSING/LOCATION), status |
| `official_snapshot` / `_line` / `official_lock` | campaign_id, approved_at, version, checksum; lock: locked_by/at, unlock_reason |
| `count_adjustment_request` | campaign_id, variance_id, proposed_delta, reason_code, status, dt05_document_id? |
| `report_dataset` | campaign_id, form_code (01/KK,02/KK,03/KK,01–06/KKDT), snapshot_version, dataset_hash |

## 4. API (Quyển X §XVI)
```
GET/POST /count-campaigns  /{id}/build-book-snapshot  /{id}/cutoff
POST /count-campaigns/{id}/sheets  /sheets/{id}/lines  /sheets/{id}/submit  /sheets/{id}/recount
GET  /count-campaigns/{id}/variances   POST /variances/{id}/resolve
POST /count-campaigns/{id}/official-snapshot  /{id}/lock  /{id}/unlock
POST /count-campaigns/{id}/adjustment-requests   (→ DT-05)
GET  /count-campaigns/{id}/datasets   (→ DT-11)
```

## 5. Business Rule (Quyển X §VII)
BR-DT10-002/003 (book_snapshot dựng tại cutoff, bất biến, checksum) · -005 (3 lớp độc lập, blind count) ·
-008 (recount là vòng mới, không ghi đè) · -009 (kiểm kê chất lượng C1–5, Σ=physical khi bắt buộc) ·
-013..015 (variance unbooked/missing/location) · -019/020 (official_snapshot khóa bất biến, revision có version) ·
-022 (điều chỉnh → DT-05, không sửa số dư trực tiếp) · -025 (report_dataset gắn snapshot_version).

## 6. Webapp (Quyển X §XV)
SCR-DT10-01 DS đợt kiểm kê · -02 Thiết lập đợt + cutoff + dựng book_snapshot · -03 Phiếu kiểm đếm (blind, autosave) ·
-04 Kiểm kê chất lượng C1–5 · -05 Đối chiếu lệch (variance) · -06 Recount (vòng mới) · -07 Chốt số chính thức + khóa ·
-08 Điều chỉnh → DT-05 · -09 Dataset biểu KK → DT-11 · -10 Reconciliation hậu kiểm.

## 7. Test / nghiệm thu (Quyển X §XIX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT10-002 | Dựng book_snapshot rồi phát sinh giao dịch mới | snapshot bất biến tại cutoff |
| TC-DT10-005 | Kiểm đếm hiển thị số sổ sách | không (blind count) |
| TC-DT10-008 | Recount vòng 2 | tạo round mới, giữ round 1 |
| TC-DT10-009 | Σ C1–5 ≠ physical (bắt buộc) | từ chối `QUALITY_TOTAL_MISMATCH` |
| TC-DT10-013 | Có vật chất thực không có sổ sách | variance UNBOOKED |
| TC-DT10-019 | Sửa official_snapshot đã khóa | từ chối `LOCKED_IMMUTABLE`; buộc revision |
| TC-DT10-022 | Chốt lệch rồi điều chỉnh | tạo adjustment_request→DT-05, không sửa số dư trực tiếp |
| TC-DT10-025 | Sinh biểu 03/KK | dataset gắn đúng official snapshot_version |

**Chuỗi E2E:** tạo đợt → cutoff + book_snapshot → phiếu kiểm đếm blind → chất lượng C1–5 → variance →
recount → chốt official + khóa → adjustment_request → DT-05 POST → reconciliation → dataset → DT-11.

## 8. Definition of Done
- [ ] book_snapshot dựng tại cutoff, bất biến + checksum; 3 lớp Book/Physical/Official độc lập; blind count.
- [ ] recount vòng mới không ghi đè; variance đủ loại; chất lượng C1–5 Σ=physical.
- [ ] official_snapshot khóa bất biến + revision có version.
- [ ] adjustment_request → DT-05 (không sửa số dư trực tiếp); reconciliation.
- [ ] report_dataset gắn snapshot_version (cấp cho DT-11).
- [ ] TC-DT10-001..025 PASS + E2E.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-10): kiểm kê 3 lớp + chốt official + điều chỉnh qua DT-05`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-10.02 | UC-DT10-04 | book_snapshot | /{id}/build-book-snapshot | SCR-DT10-02 | TC-DT10-002 |
| DT-10.03 | UC-DT10-08 | count_sheet/recount_round | /sheets/{id}/recount | SCR-DT10-06 | TC-DT10-008 |
| DT-10.04 | UC-DT10-14 | official_snapshot/lock | /{id}/lock | SCR-DT10-07 | TC-DT10-019 |
| DT-10.05 | UC-DT10-16 | count_adjustment_request | /{id}/adjustment-requests | SCR-DT10-08 | TC-DT10-022 |
