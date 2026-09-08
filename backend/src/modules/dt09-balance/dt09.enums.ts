// Enum cục bộ DT-09 (Quyển IX). Vòng đời nguồn, kế hoạch cân đối, giữ chỗ, thực thi.

// Vòng đời tin cậy của xác minh nguồn (BR-DT09-001/002). VERIFIED ≠ ELIGIBLE.
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
}

export const VERIFICATION_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  [VerificationStatus.UNVERIFIED]: [VerificationStatus.VERIFIED],
  [VerificationStatus.VERIFIED]: [VerificationStatus.EXPIRED, VerificationStatus.UNVERIFIED],
  [VerificationStatus.EXPIRED]: [VerificationStatus.VERIFIED],
};

// Trạng thái kế hoạch cân đối (BR-DT09-020: LOCKED bất biến).
export enum BalancePlanStatus {
  DRAFT = 'DRAFT',
  BALANCED = 'BALANCED',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
}

export const BALANCE_PLAN_TRANSITIONS: Record<BalancePlanStatus, BalancePlanStatus[]> = {
  [BalancePlanStatus.DRAFT]: [BalancePlanStatus.BALANCED],
  [BalancePlanStatus.BALANCED]: [BalancePlanStatus.APPROVED, BalancePlanStatus.DRAFT],
  [BalancePlanStatus.APPROVED]: [BalancePlanStatus.LOCKED],
  [BalancePlanStatus.LOCKED]: [], // bất biến — chỉ revise (clone) mới ra bản mới
};

// Trạng thái giữ chỗ nguồn (BR-DT09-008: chỉ ACTIVE tính vào Σ chống overbooking).
export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

// Trạng thái yêu cầu thực thi → DT-05 (BR-DT09-028).
export enum ExecutionStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
}

// Mức sẵn sàng huy động (đánh giá).
export enum ReadinessLevel {
  IMMEDIATE = 'IMMEDIATE',
  SHORT = 'SHORT',
  MEDIUM = 'MEDIUM',
  LONG = 'LONG',
}

export const SOURCE_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
