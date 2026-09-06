import { C3SeedRow } from '../../../modules/c3-catalog/c3-catalog.service';

// Danh mục C3 khởi tạo (Sprint 0 §1 GAP-9). Gồm nguyên tắc bất biến hệ thống (SYS-BR-01..08),
// các hạng mục Sprint 0 và mã C3 đại diện cho 12 quyển DT-01..DT-12 (đầu mục + business rule
// chính theo 01-DOI-CHIEU-GAP.md). Mở rộng chi tiết C3-yy-zz khi mở từng phân hệ.
export const C3_CATALOG_SEED: C3SeedRow[] = [
  // ---- Nguyên tắc bất biến toàn hệ thống (Master §VII) ----
  { c3Code: 'SYS-BR-01', subsystem: 'SYS', name: 'Mã R00 = loại vật chất; mã lô/tài sản là định danh riêng', businessRule: 'SYS-BR-01', description: 'Áp dụng DT-01, DT-04' },
  { c3Code: 'SYS-BR-02', subsystem: 'SYS', name: 'Số dư HC không sửa trực tiếp; đổi qua giao dịch/điều chỉnh có audit', businessRule: 'SYS-BR-02', description: 'DT-04, DT-05, DT-10' },
  { c3Code: 'SYS-BR-03', subsystem: 'SYS', name: 'Dữ liệu đã chốt snapshot/phát hành không sửa; sai phải revision/reversal', businessRule: 'SYS-BR-03', description: 'DT-04, DT-08, DT-10, DT-11' },
  { c3Code: 'SYS-BR-04', subsystem: 'SYS', name: 'Không định mức → NO_RULE; xung đột → CONFLICT; không tự coi = 0', businessRule: 'SYS-BR-04', api: '/norms/resolve', description: 'DT-07, DT-08' },
  { c3Code: 'SYS-BR-05', subsystem: 'SYS', name: 'Không tính trùng nguồn: allocation + hold + reservation ≤ khả dụng', businessRule: 'SYS-BR-05', description: 'DT-06, DT-09' },
  { c3Code: 'SYS-BR-06', subsystem: 'SYS', name: 'Dashboard/báo cáo không tạo số riêng; mọi chỉ tiêu có data lineage', businessRule: 'SYS-BR-06', description: 'DT-11, DT-12' },
  { c3Code: 'SYS-BR-07', subsystem: 'SYS', name: 'Mọi dữ liệu thời gian lưu effective_time + version/snapshot', businessRule: 'SYS-BR-07', description: 'Toàn hệ thống' },
  { c3Code: 'SYS-BR-08', subsystem: 'SYS', name: 'Quyền = chức năng ∧ phạm vi dữ liệu', businessRule: 'SYS-BR-08', screen: 'route guard', api: 'DataScopeGuard', test: 'TC-S0-001', description: 'Toàn hệ thống' },

  // ---- Sprint 0 — nền tảng ----
  { c3Code: 'SYS-S0-01', subsystem: 'SYS', name: 'Enum & mã lỗi nghiệp vụ tập trung (problem+json)', api: 'BusinessException', test: 'TC-S0-006' },
  { c3Code: 'SYS-S0-02', subsystem: 'SYS', name: 'Optimistic lock row_version (If-Match → STALE_WRITE)', api: 'AbstractEntity', test: 'TC-S0-002' },
  { c3Code: 'SYS-S0-03', subsystem: 'SYS', name: 'Idempotency-Key cho endpoint ghi sổ', api: 'IdempotencyInterceptor', test: 'TC-S0-003' },
  { c3Code: 'SYS-S0-04', subsystem: 'SYS', name: 'Audit append-only who/when/action/entity/reason/source/correlation', api: 'AuditInterceptor', test: 'TC-S0-004' },
  { c3Code: 'SYS-S0-05', subsystem: 'SYS', name: 'As-of/effective-time helper + response wrapper', api: 'resolveAsOf/asOfResponse', test: 'TC-S0-005' },
  { c3Code: 'SYS-S0-06', subsystem: 'SYS', name: 'Outbox event + dispatcher (in-process)', api: 'OutboxService' },
  { c3Code: 'SYS-S0-07', subsystem: 'SYS', name: 'C3 catalog + ma trận truy vết', api: '/c3-catalog' },
  { c3Code: 'SYS-S0-08', subsystem: 'SYS', name: 'OpenAPI contract test trong CI', api: 'openapi.snapshot.json' },

  // ---- DT-01 Danh mục chuẩn ----
  { c3Code: 'DT-01.00', subsystem: 'DT-01', name: 'Quản lý danh mục chuẩn ngành', description: 'master-data, asset-catalog, labels' },
  { c3Code: 'DT-01.01', subsystem: 'DT-01', name: 'catalog_version DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED', businessRule: 'BR-DT01-003' },
  { c3Code: 'DT-01.02', subsystem: 'DT-01', name: 'material_alias + tìm mã chuẩn từ alias', businessRule: 'BR-DT01-009' },
  { c3Code: 'DT-01.03', subsystem: 'DT-01', name: 'catalog_replacement (mã cũ→mới) + cảnh báo', businessRule: 'BR-DT01-011' },
  { c3Code: 'DT-01.04', subsystem: 'DT-01', name: 'temporary_material (TEMP-DT, PENDING_MAPPING)', businessRule: 'BR-DT01-006' },
  { c3Code: 'DT-01.01.01', subsystem: 'DT-01', name: 'Nhập danh mục (import batch, file_hash)', useCase: 'UC-DT01-01', api: 'POST /catalog/import-batches', screen: 'SCR-DT01-02', test: 'TC-DT01-001' },
  { c3Code: 'DT-01.02.03', subsystem: 'DT-01', name: 'Cây phân loại material_catalog', useCase: 'UC-DT01-05', api: 'GET /catalog/items', screen: 'SCR-DT01-01', test: 'TC-DT01-002' },
  { c3Code: 'DT-01.04.09', subsystem: 'DT-01', name: 'Công bố phiên bản (supersede)', useCase: 'UC-DT01-04', api: 'POST /catalog/versions/{id}/publish', screen: 'SCR-DT01-03', test: 'TC-DT01-007' },
  { c3Code: 'DT-01.05', subsystem: 'DT-01', name: 'Mã thay thế (replacement warning)', useCase: 'UC-DT01-08', api: 'GET /catalog/items/{id}/replacement', screen: 'SCR-DT01-01', test: 'TC-DT01-008' },
  { c3Code: 'DT-01.06', subsystem: 'DT-01', name: 'Alias (tra mã chuẩn)', useCase: 'UC-DT01-09', api: 'GET /catalog/aliases/resolve', screen: 'SCR-DT01-01', test: 'TC-DT01-006' },
  { c3Code: 'DT-01.10', subsystem: 'DT-01', name: 'Ánh xạ mã tạm → mã chính thức', useCase: 'UC-DT01-14/15', api: 'POST /catalog/temporary-materials/{id}/assign-official-code', screen: 'SCR-DT01-05', test: 'TC-DT01-003/010' },

  // ---- DT-02 Hồ sơ doanh trại ----
  { c3Code: 'DT-02.00', subsystem: 'DT-02', name: 'Quản lý hồ sơ Doanh trại', description: 'organization, barracks, facilities, land, gis' },
  { c3Code: 'DT-02.01', subsystem: 'DT-02', name: 'address_snapshot (bảo toàn địa chỉ lịch sử)', businessRule: 'BR-DT02-001', api: 'POST /dt02/addresses', test: 'TC-DT02-002' },
  { c3Code: 'DT-02.02', subsystem: 'DT-02', name: 'land_usage_allocation + kiểm tra tổng ≤ diện tích', businessRule: 'BR-DT02-004', api: 'POST /dt02/land-points/{id}/usage', test: 'TC-DT02-004' },
  { c3Code: 'DT-02.03', subsystem: 'DT-02', name: 'storage_location chống vòng lặp + không xóa vị trí có lịch sử', businessRule: 'BR-DT02-019', test: 'TC-DT02-017' },
  { c3Code: 'DT-02.07', subsystem: 'DT-02', name: 'land_change_event + diện tích tại snapshot', useCase: 'UC-DT02-08/09', businessRule: 'BR-DT02-005/007', api: 'POST /dt02/land-points/{id}/changes; GET .../area', test: 'TC-DT02-007' },
  { c3Code: 'DT-02.DQ', subsystem: 'DT-02', name: 'Kiểm tra chất lượng dữ liệu DT-02', api: 'GET /dt02/data-quality' },

  // ---- DT-03 Hồ sơ kỹ thuật ----
  { c3Code: 'DT-03.00', subsystem: 'DT-03', name: 'Hồ sơ kỹ thuật vật chất' },
  { c3Code: 'DT-03.01', subsystem: 'DT-03', name: 'product_model + model_catalog_link (1 R00 ↔ N mẫu)', useCase: 'UC-DT03-01', businessRule: 'BR-DT03-002', api: '/technical-models', test: 'TC-DT03-001' },
  { c3Code: 'DT-03.04', subsystem: 'DT-03', name: 'design_revision (SUPERSEDES, không ghi đè)', useCase: 'UC-DT03-04/14', businessRule: 'BR-DT03-014', api: 'POST /revisions/{id}/publish', test: 'TC-DT03-007/008' },
  { c3Code: 'DT-03.05', subsystem: 'DT-03', name: 'technical_document + drawing_sheet (file_hash bất biến)', businessRule: 'BR-DT03-005', api: 'POST /revisions/{id}/documents', test: 'TC-DT03-003' },
  { c3Code: 'DT-03.09', subsystem: 'DT-03', name: 'BOM (raw_name + UNMAPPED)', useCase: 'UC-DT03-09/10', businessRule: 'BR-DT03-005', api: 'POST /boms/{id}/items', test: 'TC-DT03-005' },
  { c3Code: 'DT-03.13', subsystem: 'DT-03', name: 'source_provenance + xác minh (chỉ VERIFIED dùng tiêu chí)', useCase: 'UC-DT03-13', businessRule: 'BR-DT03-006', api: 'POST /verification/{entityType}/{id}', test: 'TC-DT03-006' },

  // ---- DT-04 Thực lực vật chất ----
  { c3Code: 'DT-04.00', subsystem: 'DT-04', name: 'Quản lý thực lực vật chất', description: 'inventory' },
  { c3Code: 'DT-04.01', subsystem: 'DT-04', name: 'inventory_lot vs asset_instance' },
  { c3Code: 'DT-04.02', subsystem: 'DT-04', name: 'HC(t) as-of-time = snapshot + Σ movement APPROVED ≤ t', businessRule: 'BR-DT04-013', api: '/inventory/hc?as_of_time=' },
  { c3Code: 'DT-04.03', subsystem: 'DT-04', name: 'Giao dịch DRAFT→SUBMITTED→APPROVED→POSTED; chỉ POSTED tác động số dư', businessRule: 'BR-DT04-004', api: 'POST /materiel/movements/{id}/post|reverse', test: 'TC-DT04-004/005' },
  { c3Code: 'DT-04.06', subsystem: 'DT-04', name: 'quality_assessment (Σ cấp ≤ HC lô)', businessRule: 'BR-DT04-006', api: 'POST /materiel/quality-assessments', test: 'TC-DT04-008' },
  { c3Code: 'DT-04.11', subsystem: 'DT-04', name: 'snapshot + lock bất biến', businessRule: 'BR-DT04-011', api: 'POST /materiel/snapshots/{id}/lock', test: 'TC-DT04-016/017' },
  { c3Code: 'DT-04.13', subsystem: 'DT-04', name: 'inventory_adjustment_request → ADJUSTMENT', businessRule: 'BR-DT04-015', api: 'POST /materiel/adjustments/{id}/approve', test: 'TC-DT04-018' },
  { c3Code: 'DT-04.HC', subsystem: 'DT-04', name: 'HC(t) as-of cho DT-08 (as_of_time/scope/source/locked)', businessRule: 'BR-DT04-020', api: 'GET /materiel/hc', test: 'TC-DT04-007/020' },

  // ---- DT-05 Nhập-xuất-điều chuyển ----
  { c3Code: 'DT-05.00', subsystem: 'DT-05', name: 'Nhập–xuất–điều chuyển' },
  { c3Code: 'DT-05.01', subsystem: 'DT-05', name: 'inventory_document/line/movement/posting_batch' },
  { c3Code: 'DT-05.02', subsystem: 'DT-05', name: 'transfer_order/receipt 2 đầu (IN_TRANSIT)', businessRule: 'BR-DT05-008' },

  // ---- DT-06 Dự trữ & phân bổ ----
  { c3Code: 'DT-06.00', subsystem: 'DT-06', name: 'Dự trữ & phân bổ' },
  { c3Code: 'DT-06.01', subsystem: 'DT-06', name: 'allocation_type EXCLUSIVE/OVERLAY + inventory_allocation' },
  { c3Code: 'DT-06.02', subsystem: 'DT-06', name: 'allocation_hold: Σ exclusive ≤ HC_ALLOCATABLE', businessRule: 'BR-DT06-002' },

  // ---- DT-07 Định mức & Chỉ lệnh ----
  { c3Code: 'DT-07.00', subsystem: 'DT-07', name: 'Định mức, quy định dự trữ & Chỉ lệnh', description: 'logistics-norms' },
  { c3Code: 'DT-07.01', subsystem: 'DT-07', name: 'norm_set/version/material_norm (FIXED/PER_UNIT/FORMULA/LOOKUP)' },
  { c3Code: 'DT-07.02', subsystem: 'DT-07', name: '/norms/resolve → SELECTED/NO_RULE/CONFLICT + source trace', businessRule: 'BR-DT07-007', api: '/norms/resolve' },

  // ---- DT-08 Tính nhu cầu ----
  { c3Code: 'DT-08.00', subsystem: 'DT-08', name: 'Tính toán nhu cầu', description: 'scenario' },
  { c3Code: 'DT-08.01', subsystem: 'DT-08', name: 'material_calculation lưu riêng TT_GĐCB/TT_GĐCĐ/PC_SSCĐ/HC/NC/supply_required', businessRule: 'BR-DT08-020' },
  { c3Code: 'DT-08.02', subsystem: 'DT-08', name: 'NC = TT + PC_SSCĐ − HC (giữ dấu); supply_required=max(NC,0)', businessRule: 'BR-DT08-004' },

  // ---- DT-09 Nguồn địa bàn ----
  { c3Code: 'DT-09.00', subsystem: 'DT-09', name: 'Nguồn địa bàn & cân đối', description: 'local-resources' },
  { c3Code: 'DT-09.01', subsystem: 'DT-09', name: 'source_reservation chống overbooking (Σ ≤ available)', businessRule: 'BR-DT09-008' },

  // ---- DT-10 Kiểm kê ----
  { c3Code: 'DT-10.00', subsystem: 'DT-10', name: 'Kiểm kê & chốt số liệu', description: 'inspection' },
  { c3Code: 'DT-10.01', subsystem: 'DT-10', name: 'cutoff + book_snapshot; Book/Physical/Official độc lập', businessRule: 'BR-DT10-005' },
  { c3Code: 'DT-10.02', subsystem: 'DT-10', name: 'official_snapshot + lock (bất biến, version)', businessRule: 'BR-DT10-019' },

  // ---- DT-11 Báo cáo ----
  { c3Code: 'DT-11.00', subsystem: 'DT-11', name: 'Báo cáo & biểu mẫu', description: 'reporting' },
  { c3Code: 'DT-11.01', subsystem: 'DT-11', name: 'report_definition + template_version (17 biểu cấu hình)', businessRule: 'BR-DT11-004' },
  { c3Code: 'DT-11.02', subsystem: 'DT-11', name: 'report_lineage: ô → dataset → snapshot/giao dịch/định mức', businessRule: 'BR-DT11-002' },

  // ---- DT-12 Dashboard ----
  { c3Code: 'DT-12.00', subsystem: 'DT-12', name: 'Dashboard chỉ huy', description: 'dashboard, analytics, alerts' },
  { c3Code: 'DT-12.01', subsystem: 'DT-12', name: 'KPI layer: kpi_definition + formula_version + metric_instance (lineage)' },
  { c3Code: 'DT-12.02', subsystem: 'DT-12', name: 'Semantic: SEM-HC / HC-AVAILABLE / RESERVE-SSCD / PC-SCD / SUPPLY-REQUIRED / GAP' },
];
