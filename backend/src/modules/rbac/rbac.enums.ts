// Danh mục enum cho RBAC theo Chức vụ–Chức năng (Position–Function).
// Dùng chuỗi (varchar) trong DB để dễ mở rộng; DTO kiểm tra bằng class-validator @IsEnum.

// Phạm vi áp dụng của chức vụ.
export enum PositionScope {
  UNIT = 'UNIT', // Chức vụ trong 1 đơn vị (xã/phường/đơn vị con)
  PROVINCE = 'PROVINCE', // Chức vụ cấp tỉnh
  SYSTEM = 'SYSTEM', // Chức vụ hệ thống (quản trị)
}

// Phạm vi dữ liệu mà một (chức vụ × chức năng) được phép tác động.
// Thứ tự độ rộng tăng dần: SELF < UNIT < PROVINCE < ALL. Khi hợp quyền, scope rộng hơn thắng.
export enum FunctionScope {
  SELF = 'SELF', // Chỉ dữ liệu của chính mình
  UNIT = 'UNIT', // Trong phạm vi đơn vị (theo organizationId / dataScopes)
  PROVINCE = 'PROVINCE', // Toàn tỉnh
  ALL = 'ALL', // Toàn hệ thống
}

// Xếp hạng độ rộng scope để hợp quyền (số lớn = rộng hơn).
export const FUNCTION_SCOPE_RANK: Record<FunctionScope, number> = {
  [FunctionScope.SELF]: 1,
  [FunctionScope.UNIT]: 2,
  [FunctionScope.PROVINCE]: 3,
  [FunctionScope.ALL]: 4,
};

// Loại hành động của một chức năng hạt mịn.
export enum ActionType {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

// Mức độ xung đột tách biệt trách nhiệm (SoD).
export enum ConflictSeverity {
  BLOCK = 'BLOCK', // Chặn không cho gán đồng thời
  WARN = 'WARN', // Chỉ cảnh báo
}
