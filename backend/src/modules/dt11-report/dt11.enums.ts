// DT-11 — Báo cáo & biểu mẫu (Quyển XI). Enum tập trung (§3 quy ước chung) — KHÔNG hard-code chuỗi rời.

// Vòng đời báo cáo phát hành (BR-DT11-016/017). ISSUED bất biến; phát hành lại ⇒ version mới + SUPERSEDED bản cũ.
export enum ReportInstanceStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  APPROVED = 'APPROVED',
  ISSUED = 'ISSUED',
  SUPERSEDED = 'SUPERSEDED',
}

export const REPORT_TRANSITIONS: Record<ReportInstanceStatus, ReportInstanceStatus[]> = {
  [ReportInstanceStatus.DRAFT]: [ReportInstanceStatus.VALIDATED],
  [ReportInstanceStatus.VALIDATED]: [ReportInstanceStatus.APPROVED, ReportInstanceStatus.DRAFT],
  [ReportInstanceStatus.APPROVED]: [ReportInstanceStatus.ISSUED, ReportInstanceStatus.DRAFT],
  [ReportInstanceStatus.ISSUED]: [ReportInstanceStatus.SUPERSEDED],
  [ReportInstanceStatus.SUPERSEDED]: [],
};

// Vòng đời phiên bản template biểu (danh mục/phiên bản — §3).
export enum TemplateVersionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

// Vòng đời định nghĩa biểu.
export enum ReportDefinitionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

// Trạng thái bản sinh dataset.
export enum DatasetInstanceStatus {
  GENERATED = 'GENERATED',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
}

// Loại nguồn dataset — quyết định adapter đọc snapshot chuẩn nào (DT-04/08/09/10 + land config).
export enum DatasetSourceType {
  DT10_OFFICIAL_SNAPSHOT = 'DT10_OFFICIAL_SNAPSHOT',
  DT04_MATERIEL_SNAPSHOT = 'DT04_MATERIEL_SNAPSHOT',
  DT09_BALANCE_SNAPSHOT = 'DT09_BALANCE_SNAPSHOT',
  DT08_CALCULATION_RUN = 'DT08_CALCULATION_RUN',
  LAND_FORMS = 'LAND_FORMS',
}
export const DATASET_SOURCE_TYPES = Object.values(DatasetSourceType);

// Loại kiểm tra dataset (BR-DT11-007/009).
export enum ValidationCheckType {
  RECONCILIATION = 'RECONCILIATION', // Σ dataset khớp tổng nguồn
  QUALITY_TOTAL = 'QUALITY_TOTAL', // Σ cấp chất lượng = tổng số
  COMPLETENESS = 'COMPLETENESS', // NO_DATA ≠ ZERO ≠ MISSING_SUBMISSION
}

export enum ValidationStatus {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
}

// Trạng thái gửi báo cáo của đơn vị con trong rollup (BR-DT11-020; đơn vị chưa gửi ≠ 0).
export enum SubmissionStatus {
  SUBMITTED = 'SUBMITTED',
  MISSING = 'MISSING',
}

// Trạng thái ô số liệu — phân biệt NO_DATA ≠ ZERO ≠ MISSING_SUBMISSION (BR-DT11-009).
export enum CellState {
  VALUE = 'VALUE', // có số liệu thực
  ZERO = 'ZERO', // có dòng nhưng bằng 0
  NO_DATA = 'NO_DATA', // nguồn không có dòng
  MISSING_SUBMISSION = 'MISSING_SUBMISSION', // đơn vị con chưa gửi
}

// Định dạng file phát hành.
export enum ReportFileFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
}
export const REPORT_FILE_FORMATS = Object.values(ReportFileFormat);

// Phiên bản engine — cùng dataset + engine ⇒ cùng dataset_hash (BR-DT11-006).
export const REPORT_ENGINE_VERSION = 'dt11-report-v1';

// Danh mục mã biểu KK gợi ý (đồng bộ DT-10 KK_FORM_CODES). KHÔNG hard-code số lượng biểu —
// danh mục thực nằm ở bảng report_definition (seed cấu hình). Đây chỉ là hằng tham chiếu chéo.
export const KK_FORM_CODES = ['01/KK', '02/KK', '03/KK'] as const;
export const KKDT_FORM_CODES = ['01/KKDT', '02/KKDT', '03/KKDT', '04/KKDT', '05/KKDT', '06/KKDT'] as const;
