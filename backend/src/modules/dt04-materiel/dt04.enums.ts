// Enum cục bộ DT-04 (Quyển IV). MovementType/MovementStatus khai báo ở materiel-rules.ts.

export enum LotStatus {
  ACTIVE = 'ACTIVE',
  SPLIT = 'SPLIT', // đã tách
  MERGED = 'MERGED', // đã gộp
  CLOSED = 'CLOSED',
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  IN_TRANSIT = 'IN_TRANSIT',
  RETIRED = 'RETIRED',
  DISPOSED = 'DISPOSED',
}

export enum AdjustmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  POSTED = 'POSTED',
}

export enum SnapshotSource {
  SNAPSHOT = 'snapshot',
  LEDGER = 'ledger',
}
