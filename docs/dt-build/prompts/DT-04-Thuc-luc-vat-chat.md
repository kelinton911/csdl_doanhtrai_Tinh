# PROMPT — DT-04: Quản lý thực lực vật chất (lõi sổ cái)

> **Nguồn:** Quyển IV (DT-04). **Điều kiện mở:** DT-01, DT-02, DT-03 PASS. Áp quy ước chung.
> **Vai trò:** Sổ cái số thống nhất về vật chất — trả lời "hiện có bao nhiêu, ở đâu, chất lượng nào,
> nguồn nào, **tại bất kỳ thời điểm nào**". Cung cấp biến **HC** cho DT-08.

## 1. Nguyên tắc lõi (Quyển IV §II)
- Tên/mã/ĐVT lấy DT-01; model/revision DT-03; đơn vị/vị trí DT-02. **Không nhập lại**.
- Mọi tăng/giảm qua giao dịch/điều chỉnh **đã duyệt**; **không** sửa số tồn trực tiếp (SYS-BR-02).
- Không ghi đè lịch sử; HC(t) tái lập từ sổ cái/snapshot.
- Mã R00 = loại; mã lô/asset = quản lý thực tế (SYS-BR-01).
- Chất lượng có lịch sử đánh giá (không chỉ 1 giá trị hiện hành).

## 2. Đối chiếu hiện trạng
`inventory`: `inventory-transaction` (sổ cái), `stock-balance` (cache), `stock-quality-detail`,
`storage-location`(+revision), `inventory-period-snapshot`. Chống tồn âm (INV-001), idempotency. Nền tốt 🟡.

## 3. GAP → backend (Quyển IV §VIII)

| Bảng | Trường chính |
| --- | --- |
| `inventory_lot` | lot_code, material_catalog_id, product_revision_id?, organization_id, primary_location_id, source_id, received_date, manufacture_year?, status |
| `asset_instance` | asset_code (UNIQUE toàn hệ thống), material_catalog_id, lot_id?, product_revision_id?, serial_number, organization_id, location_id, quality_current, status, qr_value |
| `inventory_transaction` (mở rộng) | transaction_no, transaction_type, material/lot/asset, quantity_signed, from/to_org, from/to_location, document_id, **effective_time**, **posted_at**, status(DRAFT→SUBMITTED→APPROVED→POSTED), reversal_of_id |
| `inventory_balance` (cache) | material/lot/org/location, quantity_on_hand, updated_at, ledger_version — **dẫn xuất**, reconcile lại ledger |
| `inventory_snapshot` + `_line` | snapshot_code, as_of_time, scope, checksum, locked_at/by; line: qty + grade1..5 + value |
| `quality_assessment` + `quality_distribution` | assessment_time, grade, quantity, basis_document_id, assessor, status |
| `inventory_source` | source_code, source_type, name, source_document_id, status |
| `inventory_adjustment_request` | request_code, before_qty, proposed_qty, delta_qty, reason_code, status, requested_by, approved_by |
| `inventory_import_batch` / `_row` | staging số dư đầu kỳ, mapping danh mục/đơn vị, totals_json, hash, validation_status |
| `asset_movement_history` | asset_id, from/to org+location, effective_time, transaction_id |
| `inventory_period_lock` | organization_id, period_from/to, status, locked_by/at, unlock_reason |
| `inventory_reconciliation` / `inventory_exception` | ledger_total, balance_total, difference; exception_type, severity, resolution |

### Cơ chế HC theo thời điểm (Quyển IV §X)
```
HC(t) = OpeningBalance + Σ(In APPROVED≤t) − Σ(Out APPROVED≤t) ± Σ(Adjustment APPROVED≤t)
```
- Chỉ giao dịch **POSTED** tác động số dư; effective_time tách posted_at (BR-DT04-013).
- API HC kèm `as_of_time` + scope + source(snapshot/ledger) + `locked` (BR-DT04-020) → dùng cho DT-08.
- Giao dịch POSTED **không** sửa quantity/effective_time/material → reversal (BR-DT04-004).

## 4. API (Quyển IV §XV)
```
GET /inventory/materials   GET /inventory/materials/{id}/as-of?as_of_time=   GET /inventory/hc  (cho DT-08)
POST /inventory/lots  GET /inventory/lots/{id}   POST /inventory/assets  GET /inventory/assets/{id}  GET /inventory/assets/by-qr/{value}
POST /inventory/transactions  /{id}/submit  /{id}/post  /{id}/reverse
POST /inventory/quality-assessments  GET /inventory/quality-history
POST /inventory/snapshots  /{id}/lock  GET /inventory/snapshots/compare
POST /inventory/import-batches  /{id}/validate  /{id}/post
POST /inventory/adjustments  /{id}/approve
GET /inventory/reconciliation   GET /inventory/exceptions
```

## 5. Business Rule (Quyển IV §VII)
BR-DT04-001 (số dư không sửa CRUD) · -002 (R00 ≠ lô ≠ asset) · -004 (POSTED bất biến → reversal) ·
-005 (không âm trừ ngoại lệ cấu hình) · -006 (Σ cấp 1-5 ≤ HC lô) · -007 (asset ACTIVE tại 1 vị trí/1 đơn vị/thời điểm) ·
-010 (tách lô giữ tổng HC) · -011 (snapshot LOCKED bất biến) · -013 (HC chỉ tính giao dịch tác động, effective_time ≤ t) ·
-015 (điều chỉnh có reason_code + căn cứ) · -016 (asset_code UNIQUE toàn hệ thống) · -020 (HC cho DT-08 kèm as_of_time/scope/source/locked).

## 6. Webapp (Quyển IV §XIV)
SCR-DT04-01 Dashboard thực lực · -02 DS vật chất · -03 Hồ sơ lô · -04 Hồ sơ asset (QR/serial/model/lịch sử) ·
-05 Sổ cái (số trước/sau) · -06 Chất lượng C1-5 · -07 Snapshot · -08 Nhập Excel (staging→mapping→validate→chốt) ·
-09 Điều chỉnh · -10 Tra cứu theo thời điểm (HC(t) drill-down) · -11 Đối chiếu · -12 QR Scan.

## 7. Test / nghiệm thu (Quyển IV §XIX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT04-003 | POST giao dịch làm tồn âm | từ chối `INSUFFICIENT_STOCK` |
| TC-DT04-004 | Sửa quantity giao dịch POSTED | không cho |
| TC-DT04-005 | Reverse giao dịch | sinh transaction đảo, HC quay đúng |
| TC-DT04-007 | Xem HC ngày quá khứ | chỉ tính effective_time ≤ ngày chọn |
| TC-DT04-008 | Đánh giá chất lượng Σ > HC | từ chối `QUALITY_TOTAL_MISMATCH` |
| TC-DT04-009 | Tách lô 30/100 | tổng HC không đổi |
| TC-DT04-012 | Asset ở 2 vị trí cùng thời điểm | từ chối |
| TC-DT04-016 | Snapshot sau reconcile | tổng snapshot = ledger tại as_of_time |
| TC-DT04-017 | Sửa snapshot LOCKED | từ chối `LOCKED_IMMUTABLE` |
| TC-DT04-020 | API HC cho DT-08 | trả quantity + as_of_time + scope + source/status |

**Chuỗi E2E:** tạo lô/asset → gán model/revision (DT-03) → giao dịch tiếp nhận POSTED → HC hiện tại/quá khứ →
chất lượng C1-5 → tách/gộp → snapshot + lock → điều chỉnh sau kiểm kê (nhận từ DT-10) → reconcile.

## 8. Definition of Done
- [ ] Tách `inventory_lot`/`asset_instance`; asset_code UNIQUE + QR.
- [ ] HC(t) as-of chạy đúng; API `/inventory/hc` kèm metadata cho DT-08.
- [ ] Máy trạng thái giao dịch + reversal; không sửa POSTED; INSUFFICIENT_STOCK.
- [ ] quality_assessment lịch sử; Σ cấp ≤ HC.
- [ ] adjustment workflow tách người lập/duyệt; import staging; reconciliation + exception.
- [ ] snapshot + lock bất biến; compare snapshot.
- [ ] TC-DT04-001..025 PASS + E2E; `backend npm test` xanh.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-04): sổ cái thực lực + HC theo thời điểm + snapshot`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-04.04 | UC-DT04-06 | inventory_transaction/balance | GET /inventory/materials/{id}/as-of | SCR-DT04-10 | TC-DT04-007 |
| DT-04.05 | UC-DT04-10/11 | inventory_transaction | /transactions/{post,reverse} | SCR-DT04-05 | TC-DT04-004/005 |
| DT-04.06 | UC-DT04-08 | quality_assessment | /quality-assessments | SCR-DT04-06 | TC-DT04-008 |
| DT-04.11 | UC-DT04-18/19 | inventory_snapshot | /snapshots/{id}/lock | SCR-DT04-07 | TC-DT04-016/017 |
| DT-04.13 | UC-DT04-16/17 | inventory_adjustment_request | /adjustments/{id}/approve | SCR-DT04-09 | TC-DT04-018 |
