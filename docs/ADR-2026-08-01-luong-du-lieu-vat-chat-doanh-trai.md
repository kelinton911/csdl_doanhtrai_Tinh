# ADR 2026-08-01 — Làm rõ luồng dữ liệu quản lý vật chất doanh trại (thời bình · SSCĐ · bảo đảm chiến đấu)

- Trạng thái: **Đã chấp nhận (kế hoạch triển khai Pha 0→3)**
- Ngày: 2026-08-01
- Bối cảnh nguồn:
  - Yêu cầu nghiệp vụ "làm rõ luồng dữ liệu quản lý CSDL vật chất doanh trại" (6 khâu — xem mục Vấn đề).
  - Tài liệu căn cứ tính toán: [Quiuoctinhtoan.pdf](Quiuoctinhtoan.pdf) — "Thống nhất quy ước tính toán làm văn kiện hậu cần chiến đấu trong diễn tập".
  - Liên quan: [ADR-2026-08-01-inventory-quality-house-schema.md](ADR-2026-08-01-inventory-quality-house-schema.md) (đã thêm `stock_quality_details.reserve_purpose`).
  - Hồ sơ vận hành AI: REF-2026-001 (không bịa, sản phẩm "Dự thảo", nêu căn cứ, kiểm soát mật).

## Vấn đề

Nghiệp vụ mong muốn gồm **6 khâu**:

1. Xã khai báo vật chất **thời bình** tại doanh trại/kho trạm → tổng hợp về "quản lý vật chất chung của xã", lọc theo từng xã hoặc tổng toàn tỉnh.
2. Vật chất **SSCĐ** khai báo ở giao diện riêng, theo biểu mẫu chung của xã, nhập theo quy định của Tỉnh.
3. Khi **chuyển trạng thái SSCĐ** (Tăng cường / Cao / Toàn bộ): bản khai báo **tự động copy từ trạng thái liền trước** rồi chỉnh sửa lại theo quy định; Lưu → cập nhật CSDL.
4. Khi có tình huống **bảo đảm cho chiến đấu**: module riêng hỗ trợ tính toán & xây dựng **kế hoạch/văn kiện bảo đảm** doanh trại của Tỉnh.
5. Dữ liệu xã sau khi **chỉ huy xã phê duyệt** → chuyển lên **Tỉnh** quản lý/kiểm tra/thống kê.
6. Tỉnh dùng dữ liệu làm cơ sở chỉ huy các xã, xác định nhu cầu bảo đảm phù hợp.

**Trở ngại cần làm rõ:** trong mã nguồn hiện tồn tại **nhiều khái niệm "SSCĐ" chồng lấn** dễ gây nhầm; tồn kho (`stock_balances`) **không lọc theo xã**; **chưa có** khai báo SSCĐ theo mức + copy-forward; engine bảo đảm chiến đấu (`scenario`) đang dùng **định mức giả lập**.

## Bức tranh luồng dữ liệu (chuẩn hoá)

```
                          CẤP XÃ  (COMMUNE_USER khai báo → chỉ huy xã duyệt)
   ┌────────────────────────────────────────────────────────────────────┐
   │  Trục A — VẬT CHẤT THỜI BÌNH (tồn kho thực)                          │
   │    Doanh trại/Kho trạm → StockBalance + sổ kho InventoryTransaction  │
   │    (kiểm kê chi tiết: StockQualityDetail theo mục đích dự trữ)       │
   │                                                                      │
   │  Trục B — VẬT CHẤT SSCĐ (bản khai báo theo MỨC)  ★ MỚI               │
   │    ReadinessMaterialPlan(mức) → Line; copy-forward mức liền dưới     │
   │                                                                      │
   │  Trục C — ĐỊA ĐIỂM BỐ TRÍ (DeploymentSite.defenseState)  (giữ nguyên)│
   └──────────────┬─────────────────────────────────────────────────────┘
                  │  workflow DRAFT → PENDING_REVIEW → APPROVED (không tự duyệt)
                  ▼
        data-scope (barracksScope theo area_id/organization_id)
                  │  KHÔNG ETL — "một CSDL chung", Tỉnh đọc bản APPROVED
                  ▼
                          CẤP TỈNH  (PROVINCIAL_COMMAND …)
   ┌────────────────────────────────────────────────────────────────────┐
   │  Tổng hợp/thống kê: dashboard · analytics · reporting                │
   │  Bảo đảm chiến đấu: scenario(engine + định mức HC-KT) → văn kiện     │
   └────────────────────────────────────────────────────────────────────┘
```

Bảng "khâu ↔ nơi hiện thực":

| Khâu | Entity / bảng | Endpoint | Màn hình |
|---|---|---|---|
| 1. Thời bình | `stock_balances`, `inventory_transactions`, `stock_quality_details` | `/inventory/*` (+ `summary-by-area` ★) | `InventoryPage`, "Vật chất chung của xã" ★ |
| 2–3. SSCĐ theo mức | `readiness_material_plans`, `readiness_material_lines` ★ | `/readiness-materials/*` ★ | `SscdMaterialsPage` ★ |
| 4. Bảo đảm chiến đấu | `scenarios`/`scenario_runs`/`plans`, `logistics_calc_norms` ★ | `/scenarios`, `/plans`, `/reports/*` | `ScenarioPage`, `ReportsPage` |
| 5–6. Duyệt xã → Tỉnh | workflow trên các entity + `data-scope` | `/approvals`, `/dashboard/*` | `ApprovalQueuePage`, `CommandWorkspace` |

(★ = phần bổ sung theo kế hoạch Pha 1–3.)

## Ba trục dữ liệu vật chất — phân định rõ

| Trục | Ý nghĩa | Lưu ở | Đặc tính |
|---|---|---|---|
| **A. Thời bình** | Tồn kho thực đang có tại kho/doanh trại | `stock_balances` (+ sổ `inventory_transactions` bất biến; chi tiết chất lượng `stock_quality_details`) | Số thực, biến động bằng bút toán |
| **B. SSCĐ theo mức** ★ | Lượng vật chất **kế hoạch/khai báo** cho từng mức SSCĐ theo quy định Tỉnh | `readiness_material_plans` + `readiness_material_lines` | Khai báo theo mức, copy-forward, có workflow duyệt |
| **C. Địa điểm bố trí** | Trạng thái sử dụng dự kiến của địa điểm sơ tán/bố trí | `deployment_sites.defense_state` | Thuộc tính của **địa điểm**, không phải của vật chất |

## Bốn khái niệm "SSCĐ" đang tồn tại — làm rõ & xử lý

| # | Nơi | Kiểu | Ý nghĩa hiện tại | Quyết định |
|---|---|---|---|---|
| 1 | `stock_quality_details.reserve_purpose` | 1 trong 6: `THUONG_XUYEN`, **`SSCD`**, `DOT_XUAT`, `GOI_DAU`, `THU_HOI_XU_LY`, `CHAM_LUAN_CHUYEN` | **Mục đích dự trữ** của tồn kho thực (SSCD = dự trữ SSCĐ) — Trục A | **Giữ nguyên**. Đây là mục đích dự trữ, KHÔNG phải mức SSCĐ |
| 2 | `deployment_sites.defense_state` | 1 trong 5: `NORMAL`, **`SSCD`**, `EVACUATION`, `COMBAT`, `RECOVERY` | Trạng thái sử dụng của **địa điểm bố trí** — Trục C | **Giữ nguyên** |
| 3 | `InventoryPage` op-mode `SSCD` + định mức `×1.25` | UI/localStorage `CSDL_OP_MODE` | Chế độ xem đối soát định mức (số ×1.25 **hard-code**) | **Thay** số ×1.25 bằng tham chiếu `logistics_calc_norms` (Pha 3) |
| 4 | `readiness_material_plans.readiness_state` ★ | 1 trong 4: `THUONG_XUYEN` → `TANG_CUONG` → `CAO` → `TOAN_BO` | **Mức SSCĐ** của bản khai báo vật chất — Trục B | **Tạo mới** (Pha 2) |

### ⚠ Cảnh báo va chạm tên (bắt buộc ghi nhớ khi code)
`reserve_purpose = 'THUONG_XUYEN'` (mục đích dự trữ thường xuyên, Trục A) **KHÁC** `readiness_state = 'THUONG_XUYEN'` (mức SSCĐ nền, Trục B). Hai giá trị **trùng chữ, khác miền**. Giữ nguyên hằng `THUONG_XUYEN` ở cả hai (đúng thuật ngữ nghiệp vụ) nhưng **không dùng chung enum/kiểu**; đặt tên biến/kiểu rõ ràng (`ReservePurpose` vs `ReadinessState`).

## Quyết định

1. **Ba trục A/B/C tách bạch** như bảng trên; không gộp Trục B vào `stock_balances` (giữ granularity + upsert lõi) và không gộp vào `stock_quality_details` (đó là kiểm kê chất lượng tồn thực, không phải khai báo kế hoạch theo mức).
2. **Khâu 1:** bổ sung data-scope cho `listBalances` (đang **thiếu** — [inventory.service.ts](../backend/src/modules/inventory/inventory.service.ts)) và endpoint `GET /inventory/summary-by-area` tổng hợp theo xã/tổng.
3. **Khâu 2–3:** module `readiness-materials` với `READINESS_STATES = [THUONG_XUYEN, TANG_CUONG, CAO, TOAN_BO]` (có thứ tự), workflow chuẩn `DRAFT→PENDING_REVIEW→APPROVED` (tái dùng `transitionWithRevision`, `assertNotSelfApprove`), và `copyFromPreviousState(area, targetState)` chỉ copy từ bản mức liền dưới đã APPROVED. Trường dòng khai báo chốt theo **biểu mẫu chính thức của Tỉnh** (không bịa).
4. **Khâu 4:** bảng `logistics_calc_norms` nạp trung thực từ [Quiuoctinhtoan.pdf](Quiuoctinhtoan.pdf) theo 6 ngành (QN/QY/XD/VT/DT/QS), thay `NORMS` **giả lập** ở [scenario.service.ts](../backend/src/modules/scenario/scenario.service.ts); mở rộng engine tính nhu cầu theo ngành → sinh **văn kiện hậu cần chiến đấu** (tái dùng module `reporting`, đóng dấu "Dự thảo" + căn cứ).
5. **Khâu 5–6:** giữ nguyên "một CSDL chung" — không ETL; Tỉnh đọc bản `APPROVED` qua data-scope; mở rộng hàng chờ duyệt gộp để bao gồm bản SSCĐ.
6. **Bảo mật (REF-2026-001):**
   - `logistics_calc_norms` (định mức HC-KT): **xã ĐƯỢC xem** (chỉ đọc) để tự khai báo SSCĐ theo chuẩn; chỉ SYS_ADMIN/seed được sửa.
   - Văn kiện hậu cần chiến đấu + `scenario_runs`/`plans` tổng hợp: **chỉ cấp Tỉnh + cán bộ được phân quyền**; đánh dấu nội bộ, watermark người xuất, tôn trọng data-scope.

## Kế hoạch triển khai (tóm tắt, tuần tự)

- **Pha 0** — ADR này (làm rõ luồng).
- **Pha 1** — Tổng hợp vật chất thời bình theo xã (scope + `summary-by-area` + màn "Vật chất chung của xã").
- **Pha 2** — Khai báo & chuyển trạng thái vật chất SSCĐ (4 mức + copy-forward + workflow + FE).
- **Pha 3** — Bộ định mức HC-KT + engine tính toán + văn kiện hậu cần chiến đấu.

## Hệ quả

- Chấm dứt nhầm lẫn giữa 4 khái niệm "SSCĐ": mỗi khái niệm có miền dữ liệu và mục đích riêng, ghi rõ trong tài liệu và tên kiểu.
- Tương thích ngược: giữ nguyên Trục A và C; phần mới là bảng/độc lập, cộng thêm.
- Engine bảo đảm chiến đấu có **căn cứ thật** (trích dẫn nguồn), sản phẩm tính ở trạng thái "Dự thảo".
- Cần đầu vào: **biểu mẫu SSCĐ chính thức của Tỉnh** để chốt trường dòng khai báo Trục B.

## Tham chiếu

- Định mức tính toán: [Quiuoctinhtoan.pdf](Quiuoctinhtoan.pdf) (6 ngành HC-KT).
- Kiểm kê chất lượng & mục đích dự trữ: [ADR-2026-08-01-inventory-quality-house-schema.md](ADR-2026-08-01-inventory-quality-house-schema.md).
- Tham chiếu mềm (không FK cứng) theo quy ước dự án cho `reserve_purpose`, `readiness_state`, mã ngành định mức.
