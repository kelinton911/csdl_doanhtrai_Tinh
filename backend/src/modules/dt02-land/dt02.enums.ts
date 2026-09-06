// Enum cục bộ DT-02 (Quyển II).

export enum AddressOwnerType {
  FACILITY = 'FACILITY',
  LAND_PARCEL = 'LAND_PARCEL',
  BUILDING = 'BUILDING',
}

export enum LandUsageType {
  BUILDING_LAND = 'BUILDING_LAND', // đất xây dựng doanh trại
  TRAINING_GROUND = 'TRAINING_GROUND', // thao trường/bãi tập
  ECONOMIC = 'ECONOMIC', // kết hợp kinh tế
  RESERVE = 'RESERVE', // dự trữ
  FAMILY = 'FAMILY', // khu gia đình
  OTHER = 'OTHER',
}

export enum AllocationStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

export enum LandChangeType {
  INCREASE = 'INCREASE', // tăng diện tích/điểm
  DECREASE = 'DECREASE', // giảm
  HANDOVER = 'HANDOVER', // bàn giao
  PURPOSE_CHANGE = 'PURPOSE_CHANGE', // chuyển mục đích
  LEGAL_UPDATE = 'LEGAL_UPDATE', // cập nhật pháp lý
}
