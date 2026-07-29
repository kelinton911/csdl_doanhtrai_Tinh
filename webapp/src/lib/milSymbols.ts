// Bộ KÝ HIỆU QUÂN SỰ TÙY BIẾN (VN) cho bản đồ — không dùng chuẩn NATO APP-6.
// Mỗi loại đối tượng có hình dạng + màu riêng, render bằng L.divIcon (SVG nội tuyến).
// Dùng cho lớp điểm: doanh trại, công trình, kho, và POI (sở chỉ huy/trạm/địa danh/cổng...).
import L from 'leaflet';

export interface SymbolStyle {
  key: string;
  label: string;
  color: string;
  svg: string; // nội dung bên trong <svg viewBox="0 0 24 24">
}

// Hình học ký hiệu (24x24). Viền trắng để nổi trên nền bản đồ.
const STROKE = 'stroke="#fff" stroke-width="1.5"';

const STYLES: Record<string, SymbolStyle> = {
  // Doanh trại — khối nhà có cột cờ (đồn trú).
  barracks: {
    key: 'barracks',
    label: 'Doanh trại',
    color: '#10609e',
    svg: `<rect x="5" y="9" width="14" height="10" rx="1.5" fill="{c}" ${STROKE}/>
          <path d="M12 3v6M12 3l5 1.5-5 1.5" fill="{c}" ${STROKE}/>`,
  },
  // Công trình — ô vuông đặc.
  facility: {
    key: 'facility',
    label: 'Công trình',
    color: '#178f8b',
    svg: `<rect x="6" y="6" width="12" height="12" rx="1" fill="{c}" ${STROKE}/>`,
  },
  // Kho — mái nhà kho (tam giác + thân).
  KHO: {
    key: 'KHO',
    label: 'Kho',
    color: '#a8571f',
    svg: `<path d="M4 11 12 5l8 6v8H4z" fill="{c}" ${STROKE}/>
          <rect x="10" y="13" width="4" height="6" fill="#fff"/>`,
  },
  // Sở chỉ huy — khối có cờ đuôi nheo (chỉ huy).
  SO_CHI_HUY: {
    key: 'SO_CHI_HUY',
    label: 'Sở chỉ huy',
    color: '#b3261e',
    svg: `<rect x="6" y="10" width="12" height="9" rx="1" fill="{c}" ${STROKE}/>
          <path d="M9 10V4h8l-2.5 2L17 8H9" fill="{c}" ${STROKE}/>`,
  },
  // Trạm — tam giác hướng lên.
  TRAM: {
    key: 'TRAM',
    label: 'Trạm',
    color: '#178f5a',
    svg: `<path d="M12 4 21 20H3z" fill="{c}" ${STROKE}/>`,
  },
  // Địa danh — hình thoi.
  DIA_DANH: {
    key: 'DIA_DANH',
    label: 'Địa danh',
    color: '#627d98',
    svg: `<path d="M12 3 21 12 12 21 3 12z" fill="{c}" ${STROKE}/>`,
  },
  // Cổng — hai trụ + xà ngang.
  CONG: {
    key: 'CONG',
    label: 'Cổng',
    color: '#7a5195',
    svg: `<path d="M5 20V7h14v13M5 7h14M8 20v-9h8v9" fill="none" stroke="{c}" stroke-width="2.5"/>`,
  },
  default: {
    key: 'default',
    label: 'Điểm',
    color: '#334e68',
    svg: `<circle cx="12" cy="12" r="6" fill="{c}" ${STROKE}/>`,
  },
};

// Quy loại đối tượng của một lớp/feature về "kind" của bộ ký hiệu.
export function kindFor(layer: string, props: Record<string, unknown>): string {
  if (layer === 'barracks') return 'barracks';
  if (layer === 'facilities') return 'facility';
  if (layer === 'storage-locations') return 'KHO';
  if (layer === 'pois') {
    const c = String(props.category ?? '').toUpperCase();
    return STYLES[c] ? c : 'DIA_DANH';
  }
  return 'default';
}

export function styleForKind(kind: string): SymbolStyle {
  return STYLES[kind] ?? STYLES.default;
}

// Tạo L.divIcon cho một điểm theo lớp + thuộc tính.
export function symbolIcon(layer: string, props: Record<string, unknown>): L.DivIcon {
  const st = styleForKind(kindFor(layer, props));
  const inner = st.svg.replace(/\{c\}/g, st.color);
  return L.divIcon({
    className: 'mil-symbol',
    html: `<svg width="26" height="26" viewBox="0 0 24 24" aria-label="${st.label}">${inner}</svg>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });
}

// Chú giải: các loại ký hiệu để hiển thị legend trên bản đồ.
export const LEGEND: SymbolStyle[] = [
  STYLES.barracks,
  STYLES.facility,
  STYLES.KHO,
  STYLES.SO_CHI_HUY,
  STYLES.TRAM,
  STYLES.DIA_DANH,
];

// Ký hiệu nhỏ (chuỗi SVG) để vẽ trong legend.
export function legendSvg(st: SymbolStyle): string {
  const inner = st.svg.replace(/\{c\}/g, st.color);
  return `<svg width="20" height="20" viewBox="0 0 24 24">${inner}</svg>`;
}
