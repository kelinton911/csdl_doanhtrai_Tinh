// Đăng ký Chart.js một lần (giới hạn loại biểu đồ, tooltip thống nhất — Frontend §17).
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

ChartJS.defaults.font.family = 'Archivo, system-ui, sans-serif';
ChartJS.defaults.plugins.legend.position = 'bottom';

// Nhãn tiếng Việt cho mã chất lượng/trạng thái dùng trong biểu đồ.
export const CONDITION_LABEL: Record<string, string> = {
  TOT: 'Tốt',
  KHA: 'Khá',
  TRUNG_BINH: 'Trung bình',
  KEM: 'Kém',
  CHUA_DANH_GIA: 'Chưa đánh giá',
};

export const CONDITION_COLOR: Record<string, string> = {
  TOT: '#16a34a',
  KHA: '#178f8b',
  TRUNG_BINH: '#f59e0b',
  KEM: '#dc2626',
  CHUA_DANH_GIA: '#9fb3c8',
};

export const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Đã duyệt',
  PENDING_REVIEW: 'Chờ duyệt',
  DRAFT: 'Nháp',
  CHANGES_REQUESTED: 'Yêu cầu bổ sung',
  LOCKED: 'Đã khóa',
  ARCHIVED: 'Lưu trữ',
};

export const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#16a34a',
  PENDING_REVIEW: '#f59e0b',
  DRAFT: '#829ab1',
  CHANGES_REQUESTED: '#a8571f',
  LOCKED: '#2563eb',
  ARCHIVED: '#9fb3c8',
};
