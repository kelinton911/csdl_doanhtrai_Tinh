# PROMPT — Hardening: Tích hợp liên phân hệ, hiệu năng, bảo mật, vận hành

> **Điều kiện mở:** DT-01…DT-12 đều PASS DoD. **Vai trò:** kỹ sư tích hợp/vận hành.
> Mục tiêu: bảo đảm **luồng dữ liệu xuyên suốt** đúng bất biến toàn hệ thống, chịu tải, an toàn,
> quan trắc được, sẵn sàng nghiệm thu tổng thể theo `MASTER-DT-2026`.

## 1. Kiểm chứng bất biến toàn hệ thống (SYS-BR-01…08)
Rà toàn bộ endpoint/luồng, khẳng định:
- SYS-BR-01: mã loại (R00) ≠ mã lô ≠ asset_code ở mọi phân hệ.
- SYS-BR-02: **không** đường nào sửa số dư trực tiếp (chỉ qua chứng từ DT-05/điều chỉnh DT-10).
- SYS-BR-03: snapshot/dữ liệu đã chốt/phát hành **bất biến** → revision/reversal (DT-04/08/10/11).
- SYS-BR-04: NO_RULE/CONFLICT không bao giờ tự quy 0 (DT-07/08).
- SYS-BR-05: không tính trùng nguồn — Σ(allocation+hold+reservation) ≤ khả dụng (DT-06/09).
- SYS-BR-06: dashboard/báo cáo không tạo số riêng; mọi chỉ tiêu có data lineage (DT-11/12).
- SYS-BR-07: entity có yếu tố thời gian lưu effective_time + version/snapshot.
- SYS-BR-08: quyền = chức năng ∧ phạm vi (data-scope) trên **mọi** route.

## 2. Luồng E2E xuyên hệ thống (nghiệm thu tổng thể)
Chuỗi vàng phải chạy end-to-end trên instance dev :8100:
```
DT-01 danh mục → DT-02 doanh trại/kho → DT-03 model/revision → DT-04 tiếp nhận HC
→ DT-05 nhập/điều chuyển → DT-06 khóa dự trữ SSCĐ → DT-07 định mức+resolve
→ DT-08 tính NC=TT+PC_SSCĐ−HC → DT-09 cân đối nguồn+execution→DT-05
→ DT-10 kiểm kê chốt official→adjustment→DT-05 → DT-11 sinh biểu KK có lineage
→ DT-12 KPI drill-down khớp số về tận DT-04.
```
- Kiểm tra **truy vết 2 chiều**: 1 ô biểu DT-11 → dataset → snapshot → giao dịch DT-05 → HC DT-04.
- Kiểm tra **tái lập**: cùng input_hash → cùng output_hash (DT-08); snapshot checksum ổn định.

## 3. Hiệu năng & mở rộng
- Chỉ mục cho truy vấn as-of (effective_time), tồn theo org/location, ledger lớn; cân nhắc partition theo kỳ.
- Cache số dư (DT-04) + job reconcile; refresh Data Mart (DT-12) qua outbox/queue, không khóa OLTP.
- Test tải: sổ cái ≥ N triệu dòng, HC(t) < ngưỡng SLA; báo cáo rollup nhiều đơn vị.
- Pagination/streaming cho export lớn; tránh N+1 (eager/join hợp lý).

## 4. Bảo mật & tuân thủ
- Rà RBAC + data-scope theo ma trận vai trò (Tỉnh/cơ quan/đơn vị/xã); test vượt phạm vi = 403.
- Audit append-only phủ 100% thao tác thay đổi/duyệt/khóa/reversal; bất biến, có correlation-id.
- Ký số (digital-signature) cho snapshot/biểu phát hành nơi yêu cầu; xác minh checksum khi tải.
- Rà rò rỉ dữ liệu qua API list/search (lọc theo scope trước khi trả).
- Quản lý secret/khóa MinIO/DB; TLS; rate-limit; chống injection (class-validator + query tham số hóa).

## 5. Quan trắc & vận hành
- Health/readiness cho backend/DB/PostGIS/MinIO/Redis; `/health` tổng hợp.
- Log cấu trúc (correlation-id) + metric (Prometheus) + trace luồng tính toán DT-08.
- Backup/restore DB + object storage; thử khôi phục; retention snapshot/audit.
- Migration reversible; script seed golden data; runbook nâng cấp.
- Alert vận hành (khác alert nghiệp vụ DT-12): job lỗi, outbox tồn đọng, reconcile lệch.

## 6. Chất lượng dữ liệu & di trú
- Bộ kiểm tra DQ toàn hệ: mã mồ côi, alias mâu thuẫn, tồn âm, snapshot lệch ledger, dataset lệch reconciliation.
- Di trú dữ liệu cũ (M01…M15) → mô hình DT-xx: mapping, dry-run, đối chiếu tổng, rollback plan.
- Legacy chưa căn cứ (định mức/nguồn) đánh dấu *_UNVERIFIED, không dùng chính thức.

## 7. Test / nghiệm thu
| Mã | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| TC-HD-001 | Chuỗi vàng E2E §2 | chạy trọn, số khớp xuyên phân hệ |
| TC-HD-002 | Truy vết ô biểu → giao dịch gốc | drill-down tới tận DT-04/05 |
| TC-HD-003 | Tái lập DT-08 cùng input | output_hash trùng |
| TC-HD-004 | Vượt phạm vi trên 12 phân hệ | 403 `NO_PERMISSION_SCOPE` đồng nhất |
| TC-HD-005 | Sửa số dư trực tiếp (thử mọi ngả) | không đường nào cho phép |
| TC-HD-006 | Tải sổ cái lớn + HC(t) | trong ngưỡng SLA |
| TC-HD-007 | Khôi phục từ backup | dữ liệu + snapshot nguyên vẹn (checksum khớp) |
| TC-HD-008 | Contract test OpenAPI | không breaking change ngầm |

## 8. Definition of Done (nghiệm thu tổng thể)
- [ ] SYS-BR-01…08 kiểm chứng có bằng chứng test trên mọi phân hệ liên quan.
- [ ] Chuỗi vàng E2E §2 PASS; truy vết 2 chiều + tái lập PASS.
- [ ] Hiệu năng đạt SLA (HC(t), báo cáo rollup, export lớn).
- [ ] Bảo mật: data-scope 403, audit 100%, ký số/checksum, không rò rỉ list/search.
- [ ] Quan trắc: health/log/metric/trace; backup-restore thử thành công; migration reversible.
- [ ] DQ toàn hệ xanh; kế hoạch di trú M01…M15 có dry-run + rollback.
- [ ] `backend npm test` + e2e xanh; CI contract test xanh.
- [ ] Cập nhật `01-DOI-CHIEU-GAP.md` (đóng toàn bộ) + ROADMAP; commit `chore(hardening): tích hợp & nghiệm thu tổng thể DT-2026`.

## 9. Ma trận truy vết (tổng thể)
| C3 | UC | Entity | API | Screen | Test |
| --- | --- | --- | --- | --- | --- |
| SYS-BR-01..08 | — | (toàn hệ) | (guard/interceptor) | — | TC-HD-004/005 |
| §E2E | — | (12 phân hệ) | chuỗi vàng | các SCR | TC-HD-001/002 |
| §Perf | — | ledger/snapshot | as-of/export | — | TC-HD-006 |
| §Contract | — | OpenAPI | CI | — | TC-HD-008 |
