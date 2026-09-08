// Enum cục bộ DT-10 (Quyển X — Kiểm kê & chốt số liệu). Ba lớp độc lập Book/Physical/Official,
// blind count, recount vòng mới (không ghi đè), official_snapshot khóa bất biến, điều chỉnh → DT-05.

// Loại đợt kiểm kê (PHẦN II): định kỳ / đột xuất / bàn giao / sau sự kiện.
export enum CountType {
  PERIODIC = 'PERIODIC',
  EXTRAORDINARY = 'EXTRAORDINARY',
  HANDOVER = 'HANDOVER',
  POST_EVENT = 'POST_EVENT',
}

// Vòng đời đợt kiểm kê. CUTOFF = đã dựng book_snapshot bất biến; OFFICIAL_LOCKED = chốt số chính thức.
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  CUTOFF = 'CUTOFF',
  COUNTING = 'COUNTING',
  RECONCILING = 'RECONCILING',
  OFFICIAL_LOCKED = 'OFFICIAL_LOCKED',
  ADJUSTING = 'ADJUSTING',
  CLOSED = 'CLOSED',
}

export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.CUTOFF],
  [CampaignStatus.CUTOFF]: [CampaignStatus.COUNTING],
  [CampaignStatus.COUNTING]: [CampaignStatus.RECONCILING],
  // RECONCILING → COUNTING: mở lại để recount vòng mới trước khi chốt (BR-DT10-008).
  [CampaignStatus.RECONCILING]: [CampaignStatus.COUNTING, CampaignStatus.OFFICIAL_LOCKED],
  [CampaignStatus.OFFICIAL_LOCKED]: [CampaignStatus.ADJUSTING, CampaignStatus.CLOSED],
  [CampaignStatus.ADJUSTING]: [CampaignStatus.CLOSED, CampaignStatus.OFFICIAL_LOCKED],
  [CampaignStatus.CLOSED]: [],
};

// Vòng đời phiếu kiểm đếm (blind). NEEDS_REVISION khi người duyệt trả lại.
export enum SheetStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}

export const SHEET_TRANSITIONS: Record<SheetStatus, SheetStatus[]> = {
  [SheetStatus.DRAFT]: [SheetStatus.SUBMITTED],
  [SheetStatus.SUBMITTED]: [SheetStatus.APPROVED, SheetStatus.NEEDS_REVISION],
  [SheetStatus.NEEDS_REVISION]: [SheetStatus.SUBMITTED],
  [SheetStatus.APPROVED]: [],
};

// Loại chênh lệch (BR-DT10-013..015). SHORTAGE thiếu · SURPLUS thừa · UNBOOKED có thực không sổ ·
// MISSING có sổ không thực · LOCATION lệch vị trí (cùng vật chất nhưng khác kho).
export enum VarianceType {
  SHORTAGE = 'SHORTAGE',
  SURPLUS = 'SURPLUS',
  UNBOOKED = 'UNBOOKED',
  MISSING = 'MISSING',
  LOCATION = 'LOCATION',
}

export enum VarianceStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

// Vòng đời yêu cầu điều chỉnh (SYS-BR-02: duyệt → sinh chứng từ DT-05, KHÔNG sửa số dư trực tiếp).
export enum CountAdjustmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  POSTED = 'POSTED',
}

export const ADJUSTMENT_TRANSITIONS: Record<CountAdjustmentStatus, CountAdjustmentStatus[]> = {
  [CountAdjustmentStatus.DRAFT]: [CountAdjustmentStatus.SUBMITTED],
  [CountAdjustmentStatus.SUBMITTED]: [CountAdjustmentStatus.APPROVED, CountAdjustmentStatus.REJECTED],
  [CountAdjustmentStatus.APPROVED]: [CountAdjustmentStatus.POSTED],
  [CountAdjustmentStatus.REJECTED]: [],
  [CountAdjustmentStatus.POSTED]: [],
};

// Mã biểu kiểm kê hợp lệ cho report_dataset (BR-DT10-025 — cấp cho DT-11).
export const KK_FORM_CODES = [
  '01/KK',
  '02/KK',
  '03/KK',
  '01/KKDT',
  '02/KKDT',
  '03/KKDT',
  '04/KKDT',
  '05/KKDT',
  '06/KKDT',
] as const;
export type KkFormCode = (typeof KK_FORM_CODES)[number];
