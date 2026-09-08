// DT-12 — Dashboard chỉ huy & hỗ trợ quyết định (Quyển XII). Enum tập trung (§3 quy ước chung) —
// KHÔNG hard-code chuỗi rời. Semantic phân biệt rõ (PHẦN III); KPI có lineage + freshness (AC-15).

// Phiên bản engine DT-12 — cùng nguồn + engine ⇒ cùng metric_hash (tái lập).
export const DT12_ENGINE_VERSION = 'dt12-dashboard-v1';

// 7 semantic tách bạch (Quyển XII PHẦN III). Mỗi semantic đọc SNAPSHOT CHUẨN của phân hệ thượng nguồn,
// KHÔNG tự chế số (SYS-BR-06 / AC-15). Ánh xạ nguồn xem semantic-sources.ts.
export enum Semantic {
  SEM_HC = 'SEM_HC', // Hiện có — DT-04 materiel_snapshot Σ quantity_on_hand
  SEM_HC_AVAILABLE = 'SEM_HC_AVAILABLE', // Khả dụng = HC − hold/in-transit (DT-06 allocation_hold ACTIVE/EXCLUSIVE)
  SEM_RESERVE_SSCD = 'SEM_RESERVE_SSCD', // Dự trữ SSCĐ — DT-06 hold category SSCD
  SEM_PC_SCD = 'SEM_PC_SCD', // Phân cấp SSCĐ — DT-08 material_calculation Σ pc_sscd
  SEM_NC = 'SEM_NC', // Nhu cầu = TT + PC_SSCĐ − HC — DT-08 material_calculation Σ nc
  SEM_SUPPLY_REQUIRED = 'SEM_SUPPLY_REQUIRED', // Cần bảo đảm — DT-09 balance Σ supply_required (fallback DT-08)
  SEM_GAP = 'SEM_GAP', // Thiếu hụt — DT-09 balance Σ gap_qty
}
export const SEMANTICS = Object.values(Semantic);

// Loại nguồn snapshot cho lineage (đồng bộ DatasetSourceType của DT-11).
export enum Dt12SourceType {
  DT04_MATERIEL_SNAPSHOT = 'DT04_MATERIEL_SNAPSHOT',
  DT06_ALLOCATION_HOLD = 'DT06_ALLOCATION_HOLD',
  DT06_ALLOCATION_SNAPSHOT = 'DT06_ALLOCATION_SNAPSHOT',
  DT08_CALCULATION_RUN = 'DT08_CALCULATION_RUN',
  DT09_BALANCE_SNAPSHOT = 'DT09_BALANCE_SNAPSHOT',
  DT10_OFFICIAL_SNAPSHOT = 'DT10_OFFICIAL_SNAPSHOT',
}

// Độ tươi dữ liệu của metric (P10). STALE khi nguồn có phiên bản mới hơn phiên bản metric đã tính.
export enum FreshnessStatus {
  FRESH = 'FRESH',
  STALE = 'STALE',
  NO_SOURCE = 'NO_SOURCE', // chưa có snapshot nguồn nào (khác 0 — giữ nghĩa NO_DATA)
}

// Vòng đời định nghĩa KPI.
export enum KpiDefinitionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

// Vòng đời phiên bản công thức KPI.
export enum KpiFormulaVersionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

// Hướng ngưỡng: giá trị càng CAO càng xấu (GAP, NC) hay càng THẤP càng xấu (HC, HC-AVAILABLE).
export enum ThresholdDirection {
  HIGHER_WORSE = 'HIGHER_WORSE',
  LOWER_WORSE = 'LOWER_WORSE',
}

// Mức nghiêm trọng cảnh báo (§VII).
export enum AlertSeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  CRITICAL = 'CRITICAL',
}

// Vòng đời cảnh báo (Quyển XII §VIII): OPEN → ACK → RESOLVED. RESOLVED bất biến.
export enum AlertInstanceStatus {
  OPEN = 'OPEN',
  ACK = 'ACK',
  RESOLVED = 'RESOLVED',
}

export const ALERT_TRANSITIONS: Record<AlertInstanceStatus, AlertInstanceStatus[]> = {
  [AlertInstanceStatus.OPEN]: [AlertInstanceStatus.ACK, AlertInstanceStatus.RESOLVED],
  [AlertInstanceStatus.ACK]: [AlertInstanceStatus.RESOLVED],
  [AlertInstanceStatus.RESOLVED]: [],
};

// Vòng đời phiên hỗ trợ quyết định (§IX). What-if cách ly: chỉ ghi bảng decision_*, không ghi ngược vận hành.
export enum DecisionSessionStatus {
  DRAFT = 'DRAFT',
  SCORED = 'SCORED',
  RECORDED = 'RECORDED',
}

// Loại bảng fact của Data Mart (PHẦN XI).
export enum FactType {
  INVENTORY = 'INVENTORY', // DT-04 materiel snapshot
  REQUIREMENT = 'REQUIREMENT', // DT-08 calculation run
  BALANCE = 'BALANCE', // DT-09 balance snapshot
  COUNT = 'COUNT', // DT-10 official snapshot
}
export const FACT_TYPES = Object.values(FactType);
