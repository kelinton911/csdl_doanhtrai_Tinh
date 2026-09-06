# Bộ prompt xây dựng phần mềm CSDL Doanh trại cấp Tỉnh (DT-01 → DT-12)

> Tài liệu điều hướng cho toàn bộ quá trình phát triển phần mềm bám theo
> **Bộ Hồ sơ thiết kế kỹ thuật CSDL Doanh trại cấp Tỉnh — Phiên bản 1.0 (9/2026)**
> (Master `MASTER-DT-2026`, hợp nhất 12 quyển DT-01…DT-12).

---

## 1. Mục đích của bộ tài liệu này

Bộ hồ sơ thiết kế (12 quyển) mô tả **cái gì phải làm**. Bộ tài liệu này (`docs/dt-build/`)
mô tả **làm như thế nào trên chính repo hiện tại**, theo nguyên tắc:

- **Tiến hóa / lấp gap**, không xây lại từ đầu. Repo đã có NestJS (modular monolith) +
  Vite/React + PostGIS + MinIO với ~35 module (M01…M15). Mỗi phân hệ DT-xx được đối chiếu
  với module đang có → liệt kê phần đạt / phần thiếu → chỉ dẫn bổ sung & refactor để đạt
  đúng chuẩn thiết kế mới.
- **Mỗi giai đoạn hoàn thiện đầy đủ ngay ("làm đâu được đấy")**: mỗi file prompt là một
  đơn vị công việc đóng, có tiêu chí Definition of Done (DoD) và test nghiệm thu riêng.
  Không mở giai đoạn sau khi giai đoạn trước chưa đạt DoD.
- **Tài liệu hỗ trợ trước, phần mềm sau**: 3 tài liệu nền (`00`, `01`, `02`) phải được đọc
  và chốt trước khi thực thi bất kỳ prompt phân hệ nào.

## 2. Cấu trúc thư mục

```
docs/dt-build/
├── 00-README.md              ← (bạn đang ở đây) index + cách dùng + thứ tự giai đoạn
├── 01-DOI-CHIEU-GAP.md       ← đối chiếu DT-01..12 ↔ code hiện có + bảng gap tổng thể
├── 02-QUY-UOC-CHUNG.md       ← quy ước Sprint 0: API, error, enum, naming, C3, DoD, semantic
└── prompts/
    ├── 00-Sprint0-Chuan-hoa-nen-tang.md
    ├── DT-01-Danh-muc-chuan.md
    ├── DT-02-Ho-so-doanh-trai.md
    ├── DT-03-Ho-so-ky-thuat.md
    ├── DT-04-Thuc-luc-vat-chat.md
    ├── DT-05-Nhap-xuat-dieu-chuyen.md
    ├── DT-06-Du-tru-phan-bo.md
    ├── DT-07-Dinh-muc-chi-lenh.md
    ├── DT-08-Tinh-nhu-cau.md
    ├── DT-09-Nguon-dia-ban.md
    ├── DT-10-Kiem-ke.md
    ├── DT-11-Bao-cao.md
    ├── DT-12-Dashboard.md
    └── 99-Hardening.md
```

## 3. Ngăn xếp kỹ thuật hiện tại (bám theo, không đổi)

| Lớp | Công nghệ | Vị trí |
| --- | --- | --- |
| Backend | NestJS 10 (modular monolith) + TypeORM + class-validator | `backend/src/modules/*` |
| CSDL | PostgreSQL 16 + PostGIS 3.4 | migration TypeORM `backend/src/database` |
| Object storage | MinIO (S3 SDK) | module `storage` |
| Hàng đợi/cache | Redis | module `queue` (outbox là lộ trình) |
| API | REST `/api/v1`, Swagger/OpenAPI, problem+json | global prefix + `common` |
| Webapp | Vite + React 18 + TS, react-query, react-router, leaflet, chart.js, zxing | `webapp/src` |
| Triển khai | Docker Compose (dev :8100 / stack :8000 / prod) | `docker-compose*.yml` |

> Chi tiết cách khởi động instance dev :8100 xem `docs/dt-build/02-QUY-UOC-CHUNG.md` §Vận hành.

## 4. Thứ tự giai đoạn (lộ trình bắt buộc)

Theo Master `MASTER-DT-2026` §XIII và ràng buộc phụ thuộc dữ liệu xuyên phân hệ (§IV, §V):

| Thứ tự | File prompt | Phạm vi | Điều kiện mở |
| --- | --- | --- | --- |
| 0 | `00-Sprint0-Chuan-hoa-nen-tang.md` | Chốt quy ước, enum, error code, data dictionary, C3, IAM/RBAC/Audit/idempotency nền, semantic ngữ nghĩa | Sau khi đọc 01 + 02 |
| 1 | `DT-01-Danh-muc-chuan.md` | Master data R00, version, alias, ĐVT, mã tạm, đề nghị bổ sung | Sprint 0 đạt DoD |
| 2 | `DT-02-Ho-so-doanh-trai.md` | Tổ chức, địa bàn, cơ sở, đất, nhà, hạ tầng, kho/vị trí | DT-01 đạt DoD |
| 3 | `DT-03-Ho-so-ky-thuat.md` | Mẫu sản phẩm, revision, bản vẽ, BOM, nhãn, xác minh nguồn | DT-01 đạt DoD |
| 4 | `DT-04-Thuc-luc-vat-chat.md` | Sổ cái bất biến, lô/tài sản, HC theo thời điểm, chất lượng, snapshot | DT-01, DT-02, DT-03 |
| 5 | `DT-05-Nhap-xuat-dieu-chuyen.md` | Chứng từ, movement, posting, điều chuyển 2 đầu, thu hồi/sửa chữa | DT-04 |
| 6 | `DT-06-Du-tru-phan-bo.md` | Allocation, SSCĐ/đột xuất/gối đầu, hold/lock, chậm luân chuyển | DT-04, DT-05 |
| 7 | `DT-07-Dinh-muc-chi-lenh.md` | Văn bản căn cứ, norm set/version, scope, selector, Chỉ lệnh hậu cần | DT-01, DT-06 |
| 8 | `DT-08-Tinh-nhu-cau.md` | Scenario, TT GĐCB/GĐCĐ, PC SSCĐ, HC chốt, NC, calculation trace | DT-04, DT-07 |
| 9 | `DT-09-Nguon-dia-ban.md` | Nguồn nội bộ/địa bàn, xác minh, huy động, reservation, cân đối, gap | DT-08 |
| 10 | `DT-10-Kiem-ke.md` | Campaign, cutoff, book/physical snapshot, chênh lệch, official snapshot | DT-04, DT-05, DT-06 |
| 11 | `DT-11-Bao-cao.md` | Report engine, template version, dataset, workflow phát hành, 17 biểu | DT-10 (+ tất cả nguồn) |
| 12 | `DT-12-Dashboard.md` | Semantic/KPI, data mart, cảnh báo, decision support, bản đồ, truy vết | DT-01..DT-11 |
| 13 | `99-Hardening.md` | Performance, security, backup/DR, migration golden dataset, UAT, nghiệm thu | Toàn bộ DT-xx |

Có thể chạy song song các cặp không phụ thuộc (DT-02 ∥ DT-03; DT-05 ∥ chuẩn bị DT-06),
nhưng **không** được mở phân hệ khi phân hệ nguồn chưa đạt DoD (ví dụ DT-08 cần HC snapshot
của DT-04 và norm của DT-07).

## 5. Cách dùng một file prompt

Mỗi file `prompts/DT-xx-*.md` có cấu trúc thống nhất:

1. **Bối cảnh & nguồn thiết kế** — trỏ tới quyển gốc và các điều khoản (§, BR, UC).
2. **Đối chiếu hiện trạng** — module/entity đang có, phần đạt.
3. **Danh sách GAP** — bảng "phần thiếu" cụ thể phải làm, có mức ưu tiên.
4. **Việc phải làm (backend)** — entity/migration, service, controller/API, business rule.
5. **Việc phải làm (webapp)** — màn hình, luồng, thành phần UI.
6. **Business Rule bắt buộc** — trích từ quyển gốc (mã BR-DTxx-*).
7. **Test/nghiệm thu** — test case cốt lõi + chuỗi E2E.
8. **Definition of Done (DoD)** — checklist đóng giai đoạn.
9. **Ma trận truy vết** — C3 → UC → Entity → API → Screen → Test.

**Quy trình thực thi (con người hoặc AI agent):**

```
1. Đọc 00 + 01 + 02  → hiểu quy ước & gap toàn cục.
2. Mở file prompt của phân hệ theo đúng thứ tự lộ trình.
3. Xác nhận "Đối chiếu hiện trạng" khớp code thực tế (git pull mới nhất).
4. Thực hiện lần lượt: backend → migration/seed → webapp → test.
5. Chạy checklist DoD; chỉ chuyển phân hệ sau khi DoD = PASS.
6. Cập nhật cột "Hiện trạng" trong 01-DOI-CHIEU-GAP.md và ROADMAP.md.
7. Commit theo quy ước (mỗi phân hệ ≥ 1 commit `feat(DT-xx): ...`), cập nhật ma trận truy vết.
```

## 6. Nguyên tắc bất biến xuyên suốt (nhắc lại từ Master §VII)

| Mã | Nguyên tắc | Áp dụng khi build |
| --- | --- | --- |
| SYS-BR-01 | Mã R00 = loại vật chất; mã lô/tài sản là định danh riêng | DT-01, DT-04 |
| SYS-BR-02 | Số dư HC không sửa trực tiếp; đổi qua giao dịch/điều chỉnh có audit | DT-04, DT-05, DT-10 |
| SYS-BR-03 | Dữ liệu đã chốt snapshot/phát hành **không sửa**; sai phải tạo revision/reversal | DT-04, DT-08, DT-10, DT-11 |
| SYS-BR-04 | Không có định mức → `NO_RULE`; xung đột → `CONFLICT`; **không tự coi = 0** | DT-07, DT-08 |
| SYS-BR-05 | Không tính trùng nguồn: allocation + hold + reservation ≤ khả dụng theo thời điểm | DT-06, DT-09 |
| SYS-BR-06 | Dashboard/báo cáo không tạo số riêng; mọi chỉ tiêu có data lineage | DT-11, DT-12 |
| SYS-BR-07 | Mọi dữ liệu có yếu tố thời gian phải lưu effective_time + version/snapshot | Toàn hệ thống |
| SYS-BR-08 | Quyền = chức năng ∧ phạm vi dữ liệu (đơn vị/địa bàn/nhiệm vụ) | Toàn hệ thống |

**Công thức nghiệp vụ gốc (bất biến, DT-08):**

```
TT  = TT_GĐCB + TT_GĐCĐ
NC  = TT + PC_SSCĐ − HC = TT_GĐCB + TT_GĐCĐ + PC_SSCĐ − HC
SupplyRequired = max(NC, 0)          # chỉ tiêu dẫn xuất, KHÔNG thay NC
Gap = SupplyRequired − Σ(Planned/Reserved Source)
Σ Active Reservations(source, time_window) ≤ Available(time_window)
```
> `PC_SSCĐ` ("phải có sau chiến đấu") **khác** nhãn allocation "dự trữ SSCĐ" của DT-06.

## 7. Trạng thái theo dõi

Bảng theo dõi tiến độ giai đoạn được duy trì tại cuối `01-DOI-CHIEU-GAP.md`
(cột "Hiện trạng / DoD"). Cập nhật sau mỗi phân hệ.

## 8. Tài liệu nguồn liên quan trong repo

- Bản thiết kế đầy đủ: tệp PDF do người dùng cung cấp (12 quyển).
- `docs/ROADMAP.md` — bản đồ M01..M15 (kiến trúc cũ, dùng để đối chiếu).
- `docs/ADR-*.md` — các quyết định kiến trúc đã chốt.
- `docs/thu-thap-csdl/` — dữ liệu R00, taxonomy, mẫu ký hiệu (golden dataset ứng viên).
- `docs/testing-automation.md`, `docs/CHECKLIST-FE-BE-SYNC.md` — chuẩn kiểm thử & đồng bộ FE/BE.
