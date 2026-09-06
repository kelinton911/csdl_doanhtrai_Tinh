// Enum cục bộ DT-01 (Quyển I). Trạng thái phiên bản dùng CatalogVersionStatus chung (§3).

export enum AliasType {
  COMMON = 'COMMON', // tên gọi thông dụng
  LEGACY = 'LEGACY', // tên/mã cũ
  ABBREVIATION = 'ABBREVIATION', // viết tắt
  TRADE = 'TRADE', // tên thương mại
}

export enum UnitType {
  COUNT = 'COUNT', // đếm (cái, bộ)
  LENGTH = 'LENGTH',
  AREA = 'AREA',
  VOLUME = 'VOLUME',
  WEIGHT = 'WEIGHT',
  TIME = 'TIME',
  OTHER = 'OTHER',
}

export enum ActiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ChangeRequestType {
  NEW_MATERIAL = 'NEW_MATERIAL', // đề nghị mã mới
  UPDATE = 'UPDATE', // đề nghị sửa
  MERGE = 'MERGE', // đề nghị gộp
  RETIRE = 'RETIRE', // đề nghị ngừng
}

export enum ChangeRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MAPPED = 'MAPPED', // đã ánh xạ sang mã hiện có
}

export enum TemporaryMaterialStatus {
  PENDING_MAPPING = 'PENDING_MAPPING',
  MAPPED = 'MAPPED', // đã gán mã chính thức
  REJECTED = 'REJECTED',
}

export enum ImportBatchStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
}
