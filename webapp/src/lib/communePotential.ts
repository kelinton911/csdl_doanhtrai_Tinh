// M17 — Tiềm lực Hậu cần - Kỹ thuật khu vực cấp xã. Client gọi /commune-potentials/*.
// Danh mục chỉ số định lượng, nhóm theo lĩnh vực HC-KT (khớp cột entity backend).

export interface PotentialMetric { key: string; label: string; unit?: string }
export interface PotentialGroup { title: string; metrics: PotentialMetric[] }

export const POTENTIAL_GROUPS: PotentialGroup[] = [
  {
    title: 'Dân số & nhân lực',
    metrics: [
      { key: 'population', label: 'Dân số', unit: 'người' },
      { key: 'households', label: 'Số hộ', unit: 'hộ' },
      { key: 'laborForce', label: 'Lực lượng lao động', unit: 'người' },
      { key: 'militiaSelfDefense', label: 'Dân quân tự vệ', unit: 'người' },
      { key: 'reserveForce', label: 'Dự bị động viên', unit: 'người' },
    ],
  },
  {
    title: 'Lương thực - thực phẩm',
    metrics: [
      { key: 'foodReserveTons', label: 'Dự trữ lương thực', unit: 'tấn' },
      { key: 'annualFoodOutputTons', label: 'Sản lượng LTTP/năm', unit: 'tấn' },
      { key: 'livestockHeads', label: 'Đàn gia súc/gia cầm', unit: 'con' },
    ],
  },
  {
    title: 'Y tế',
    metrics: [
      { key: 'medicalStations', label: 'Cơ sở y tế', unit: 'cơ sở' },
      { key: 'hospitalBeds', label: 'Giường bệnh', unit: 'giường' },
      { key: 'medicalStaff', label: 'Cán bộ y tế', unit: 'người' },
    ],
  },
  {
    title: 'Xăng dầu - nhiên liệu',
    metrics: [
      { key: 'fuelStations', label: 'Cửa hàng xăng dầu', unit: 'điểm' },
      { key: 'fuelReserveM3', label: 'Dự trữ nhiên liệu', unit: 'm³' },
    ],
  },
  {
    title: 'Vận tải',
    metrics: [
      { key: 'trucks', label: 'Ô tô tải', unit: 'xe' },
      { key: 'passengerCars', label: 'Ô tô khách', unit: 'xe' },
      { key: 'boats', label: 'Tàu/thuyền', unit: 'chiếc' },
      { key: 'transportCapacityTons', label: 'Năng lực vận chuyển', unit: 'tấn' },
    ],
  },
  {
    title: 'Cơ sở vật chất huy động',
    metrics: [
      { key: 'civilWarehouses', label: 'Kho tàng dân sự', unit: 'kho' },
      { key: 'schools', label: 'Trường học trưng dụng', unit: 'cơ sở' },
      { key: 'factories', label: 'Cơ sở SX-SC cơ khí', unit: 'cơ sở' },
    ],
  },
];

export const POTENTIAL_METRIC_KEYS = POTENTIAL_GROUPS.flatMap((g) => g.metrics.map((m) => m.key));

export interface CommunePotential {
  id: string;
  code: string;
  title: string;
  areaId: string | null;
  areaName?: string | null;
  organizationId: string | null;
  periodLabel: string | null;
  workflowStatus: string;
  assessment: string | null;
  note: string | null;
  createdBy?: string | null;
  updatedAt: string;
  // Các chỉ số định lượng (numeric) — truy cập theo key trong POTENTIAL_METRIC_KEYS.
  [metric: string]: unknown;
}
