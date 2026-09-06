# PROMPT — DT-05: Nhập – Xuất – Điều chuyển – Thu hồi – Thanh xử lý

> **Nguồn:** Quyển V (DT-05). **Điều kiện mở:** DT-04 PASS. Áp quy ước chung.
> **Vai trò:** Lớp **chứng từ nghiệp vụ** phát sinh biến động vật chất. Mọi thay đổi HC ở DT-04
> đều bắt nguồn từ 1 chứng từ đã POST ở đây. DT-05 **không** giữ số dư — chỉ sinh movement.

## 1. Nguyên tắc lõi (Quyển V §II)
- 1 chứng từ → N movement; posting **nguyên tử** (all-or-nothing) vào sổ cái DT-04.
- Không sửa chứng từ đã POST → **reversal** (chứng từ đảo). Hủy chỉ khi chưa POST.
- Điều chuyển liên đơn vị có **2 đầu** (xuất/nhận), trạng thái IN_TRANSIT; chênh lệch giao–nhận là exception.
- Thu hồi/sửa chữa/thanh lý: tách **trạng thái tài sản** vs **giao dịch giảm thực**.
- Khóa kỳ (period_lock) cấm backdate vào kỳ đã chốt.

## 2. Đối chiếu hiện trạng
`inventory` (movement/adjustment + idempotency), `maintenance` (damage→request→repair). Có nền 🟡.

## 3. GAP → backend (Quyển V §X)

| Bảng | Trường chính |
| --- | --- |
| `inventory_document` | document_no, document_type (RECEIPT/ISSUE/TRANSFER/RECALL/DISPOSAL/CONVERSION), organization_id, counterparty_org_id?, basis_document_id, effective_date, status, submitted/approved/posted_by/at, reversal_of_id |
| `inventory_document_line` | document_id, line_no, material_catalog_id, lot_id?, asset_id?, quantity, unit_id, from/to_location_id, quality_grade, note |
| `inventory_movement` | document_line_id, transaction_id (→DT-04), direction (IN/OUT), quantity_signed, effective_time, posted_at |
| `posting_batch` | document_id, posted_at/by, movement_count, checksum, status |
| `transfer_order` / `transfer_receipt` | order_no, from_org, to_org, dispatched_at, received_at, status(DRAFT→DISPATCHED→IN_TRANSIT→RECEIVED→CLOSED), discrepancy_note |
| `disposal_case` / `recall_case` | case_no, asset/lot ref, reason_code, decision_document_id, status, effective_date |
| `stock_period` / `period_lock` | organization_id, period_from/to, status(OPEN/CLOSING/LOCKED), locked_by/at, unlock_reason |
| `document_attachment` | document_id, file_id, file_hash, doc_kind |

**Máy trạng thái chứng từ:** DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED→POSTED→(REVERSED). Hủy: DRAFT/SUBMITTED→CANCELLED.

## 4. API (Quyển V §XVI)
```
GET/POST /inventory-documents  /{id}  /{id}/submit  /{id}/review  /{id}/approve  /{id}/post  /{id}/reverse  /{id}/cancel
POST /inventory-documents/{id}/lines   GET /inventory-documents/{id}/movements
POST /transfer-orders  /{id}/dispatch  /{id}/receive  /{id}/close   GET /transfer-orders/in-transit
POST /recall-cases  /disposal-cases  /{id}/approve
GET/POST /stock-periods  /{id}/close  /{id}/lock  /{id}/unlock
GET /inventory-documents/{id}/trace
```

## 5. Business Rule (Quyển V §VIII)
BR-DT05-002 (POSTED bất biến → reversal) · -003 (hủy chỉ khi chưa POST) · -008 (điều chuyển 2 đầu, tồn IN_TRANSIT
không thuộc HC khả dụng bên nào cho tới khi nhận) · -010 (cấm backdate vào kỳ LOCKED) · -011 (idempotency-key mỗi POST) ·
-014 (thu hồi/sửa chữa đổi trạng thái ≠ tự giảm HC trừ khi có giao dịch giảm) · -026 (đối chiếu Σmovement = Δbalance) ·
-030 (mỗi ô tăng/giảm biểu KK truy được về movement→chứng từ→file).

## 6. Webapp (Quyển V §XV)
SCR-DT05-01 DS chứng từ (lọc loại/trạng thái/kỳ) · -02 Lập chứng từ nhập · -03 Lập chứng từ xuất ·
-04 Điều chuyển (2 đầu, theo dõi IN_TRANSIT) · -05 Thu hồi/sửa chữa · -06 Thanh lý/xử lý ·
-07 Duyệt & POST (xem movement preview) · -08 Reversal · -09 Khóa/mở kỳ · -10 Truy vết chứng từ→movement→sổ cái.

## 7. Test / nghiệm thu (Quyển V §XX)
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-DT05-002 | POST chứng từ xuất > HC | từ chối `INSUFFICIENT_STOCK`, không sinh movement nào |
| TC-DT05-003 | Sửa chứng từ đã POST | không cho; hướng reversal |
| TC-DT05-004 | Reverse chứng từ | sinh chứng từ đảo, HC quay đúng, audit đủ |
| TC-DT05-005 | Hủy chứng từ đã POST | từ chối |
| TC-DT05-008 | Điều chuyển: xuất xong, chưa nhận | tồn IN_TRANSIT; HC khả dụng 2 bên không cộng trùng |
| TC-DT05-009 | Nhận lệch số với lượng xuất | ghi discrepancy, tạo exception |
| TC-DT05-011 | POST 2 lần cùng idempotency-key | 1 posting_batch |
| TC-DT05-013 | Backdate vào kỳ LOCKED | từ chối `PERIOD_LOCKED` |
| TC-DT05-014 | Đưa tài sản đi sửa chữa | trạng thái UNDER_REPAIR, HC không tự giảm |

**Chuỗi E2E:** lập chứng từ nhập → duyệt → POST (HC tăng) → điều chuyển liên đơn vị (dispatch→in-transit→receive) →
xuất tiêu hao → reversal 1 chứng từ sai → khóa kỳ → truy vết 1 ô biểu KK về file gốc.

## 8. Definition of Done
- [ ] `inventory_document`/line/movement/posting_batch; posting nguyên tử; 1 chứng từ→N movement.
- [ ] Máy trạng thái + reversal + cancel; không sửa POSTED.
- [ ] transfer 2 đầu + IN_TRANSIT + discrepancy exception.
- [ ] period_lock cấm backdate; đối chiếu Σmovement=Δbalance.
- [ ] Truy vết chứng từ→movement→sổ cái (phục vụ DT-11).
- [ ] TC-DT05-001..025 PASS + E2E; `backend npm test` xanh.
- [ ] Cập nhật GAP + ROADMAP; commit `feat(DT-05): chứng từ nhập/xuất/điều chuyển + posting nguyên tử`.

## 9. Ma trận truy vết
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| DT-05.02 | UC-DT05-05 | inventory_document | /{id}/post | SCR-DT05-07 | TC-DT05-002 |
| DT-05.03 | UC-DT05-08 | inventory_document | /{id}/reverse | SCR-DT05-08 | TC-DT05-004 |
| DT-05.05 | UC-DT05-12 | transfer_order/receipt | /transfer-orders | SCR-DT05-04 | TC-DT05-008/009 |
| DT-05.09 | UC-DT05-20 | period_lock | /stock-periods/{id}/lock | SCR-DT05-09 | TC-DT05-013 |
