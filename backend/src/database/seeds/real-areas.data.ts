// DỮ LIỆU ĐỊA BÀN THẬT (Tỉnh + Xã/Phường/Đặc khu) — nạp cho môi trường thật.
// ⚠️ TRẠNG THÁI: DỰ THẢO — CHỜ DỮ LIỆU CHÍNH THỨC.
// Theo hiến pháp dự án: KHÔNG bịa danh sách. Điền từ nguồn hành chính công khai sau sáp nhập 2025
// của ĐÚNG tỉnh mục tiêu, và để người phụ trách rà soát trước khi chạy `npm run seed:real`.
//
// Cách điền:
//   1) Đặt REAL_PROVINCE = { code, name } của tỉnh (vd { code: 'TINH-XX', name: 'Tỉnh ...' }).
//   2) Liệt kê toàn bộ cấp xã trong REAL_AREAS: mỗi mục { code, name, type }.
//      type: 'COMMUNE' = Xã · 'WARD' = Phường · 'SPECIAL_ZONE' = Đặc khu.
//   3) (Tùy chọn) createUnitPerArea=true để tạo kèm đơn vị "Ban CHQS <địa bàn>" trực thuộc tỉnh.

export type RealAreaType = 'COMMUNE' | 'WARD' | 'SPECIAL_ZONE';

export interface RealArea {
  code: string;
  name: string;
  type: RealAreaType;
}

// TODO(dữ-liệu): điền mã + tên tỉnh mục tiêu.
export const REAL_PROVINCE: { code: string; name: string } = {
  code: '',
  name: '',
};

// TODO(dữ-liệu): điền danh sách xã/phường/đặc khu chính thức của tỉnh.
export const REAL_AREAS: RealArea[] = [
  // { code: 'XA-...', name: 'Xã ...', type: 'COMMUNE' },
  // { code: 'PHUONG-...', name: 'Phường ...', type: 'WARD' },
  // { code: 'DACKHU-...', name: 'Đặc khu ...', type: 'SPECIAL_ZONE' },
];

// Có tạo kèm đơn vị "Ban CHQS <địa bàn>" (type=COMMUNE) trực thuộc tỉnh cho mỗi địa bàn không.
export const createUnitPerArea = true;
