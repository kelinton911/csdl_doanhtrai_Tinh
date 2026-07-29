// Bộ KÝ HIỆU QUÂN SỰ TÙY BIẾN (VN) cho bản đồ — không dùng chuẩn NATO APP-6.
// Mỗi loại đối tượng có hình dạng + màu riêng, render bằng L.divIcon (SVG nội tuyến).
// Dùng cho lớp điểm: doanh trại, công trình, kho, và POI (sở chỉ huy/trạm/địa danh/cổng...).
import L from 'leaflet';

export interface SymbolStyle {
  key: string;
  label: string;
  group: 'CH_DT' | 'KH_HC' | 'HT_KT' | 'POI_KS'; // Phân nhóm ký hiệu
  groupName: string;
  color: string;
  svg: string; // nội dung bên trong <svg viewBox="0 0 24 24">
}

const STROKE = 'stroke="#fff" stroke-width="1.5"';

export const STYLES: Record<string, SymbolStyle> = {
  // --- NHÓM 1: CHỈ HUY & DOANH TRẠI ---
  barracks: {
    key: 'barracks',
    label: 'Doanh trại đồn trú',
    group: 'CH_DT',
    groupName: 'Chỉ huy & Doanh trại',
    color: '#10609e',
    svg: `<rect x="5" y="9" width="14" height="10" rx="1.5" fill="{c}" ${STROKE}/>
          <path d="M12 3v6M12 3l5 1.5-5 1.5" fill="{c}" ${STROKE}/>`,
  },
  SO_CHI_HUY: {
    key: 'SO_CHI_HUY',
    label: 'Sở chỉ huy',
    group: 'CH_DT',
    groupName: 'Chỉ huy & Doanh trại',
    color: '#b3261e',
    svg: `<rect x="6" y="10" width="12" height="9" rx="1" fill="{c}" ${STROKE}/>
          <path d="M9 10V4h8l-2.5 2L17 8H9" fill="{c}" ${STROKE}/>`,
  },
  facility: {
    key: 'facility',
    label: 'Khối nhà / Công trình',
    group: 'CH_DT',
    groupName: 'Chỉ huy & Doanh trại',
    color: '#178f8b',
    svg: `<rect x="6" y="6" width="12" height="12" rx="1" fill="{c}" ${STROKE}/>`,
  },

  // --- NHÓM 2: KHO TÀNG & HẬU CẦN ---
  KHO: {
    key: 'KHO',
    label: 'Kho vật chất chung',
    group: 'KH_HC',
    groupName: 'Kho tàng & Hậu cần',
    color: '#a8571f',
    svg: `<path d="M4 11 12 5l8 6v8H4z" fill="{c}" ${STROKE}/>
          <rect x="10" y="13" width="4" height="6" fill="#fff"/>`,
  },
  KHO_DAN: {
    key: 'KHO_DAN',
    label: 'Kho đạn / Vũ khí',
    group: 'KH_HC',
    groupName: 'Kho tàng & Hậu cần',
    color: '#991b1b',
    svg: `<path d="M4 11 12 5l8 6v8H4z" fill="{c}" ${STROKE}/>
          <circle cx="12" cy="13" r="3" fill="#fff"/>`,
  },
  KHO_XANG: {
    key: 'KHO_XANG',
    label: 'Kho xăng dầu / Nhiên liệu',
    group: 'KH_HC',
    groupName: 'Kho tàng & Hậu cần',
    color: '#d97706',
    svg: `<path d="M4 11 12 5l8 6v8H4z" fill="{c}" ${STROKE}/>
          <path d="M12 11v6M10 13h4" stroke="#fff" stroke-width="2"/>`,
  },

  // --- NHÓM 3: HẠ TẦNG & KỸ THUẬT ---
  TRAM_BIEN_AP: {
    key: 'TRAM_BIEN_AP',
    label: 'Trạm điện / Máy phát',
    group: 'HT_KT',
    groupName: 'Hạ tầng & Kỹ thuật',
    color: '#ca8a04',
    svg: `<path d="M12 4 21 20H3z" fill="{c}" ${STROKE}/>
          <path d="M13 7l-3 5h4l-2 5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  BE_PCCC: {
    key: 'BE_PCCC',
    label: 'Bể nước PCCC',
    group: 'HT_KT',
    groupName: 'Hạ tầng & Kỹ thuật',
    color: '#0284c7',
    svg: `<circle cx="12" cy="12" r="8" fill="{c}" ${STROKE}/>
          <path d="M12 7c-2 2-3 4-3 5.5a3 3 0 0 0 6 0C15 11 14 9 12 7z" fill="#fff"/>`,
  },
  TRAM_THONG_TIN: {
    key: 'TRAM_THONG_TIN',
    label: 'Trạm thông tin liên lạc',
    group: 'HT_KT',
    groupName: 'Hạ tầng & Kỹ thuật',
    color: '#166534',
    svg: `<path d="M12 4 21 20H3z" fill="{c}" ${STROKE}/>
          <path d="M12 9v7M9 13h6" stroke="#fff" stroke-width="2"/>`,
  },
  TRAM: {
    key: 'TRAM',
    label: 'Trạm / Kỹ thuật chung',
    group: 'HT_KT',
    groupName: 'Hạ tầng & Kỹ thuật',
    color: '#178f5a',
    svg: `<path d="M12 4 21 20H3z" fill="{c}" ${STROKE}/>`,
  },

  // --- NHÓM 4: KIỂM SOÁT & ĐỊA DANH ---
  CONG: {
    key: 'CONG',
    label: 'Cổng / Trạm kiểm soát',
    group: 'POI_KS',
    groupName: 'Kiểm soát & Địa danh',
    color: '#7a5195',
    svg: `<path d="M5 20V7h14v13M5 7h14M8 20v-9h8v9" fill="none" stroke="{c}" stroke-width="2.5"/>`,
  },
  MOC_GIOI: {
    key: 'MOC_GIOI',
    label: 'Mốc ranh giới đất QP',
    group: 'POI_KS',
    groupName: 'Kiểm soát & Địa danh',
    color: '#475569',
    svg: `<path d="M12 3 21 12 12 21 3 12z" fill="{c}" ${STROKE}/>
          <circle cx="12" cy="12" r="3" fill="#fff"/>`,
  },
  DIA_DANH: {
    key: 'DIA_DANH',
    label: 'Địa danh / POI',
    group: 'POI_KS',
    groupName: 'Kiểm soát & Địa danh',
    color: '#627d98',
    svg: `<path d="M12 3 21 12 12 21 3 12z" fill="{c}" ${STROKE}/>`,
  },
  default: {
    key: 'default',
    label: 'Điểm chung',
    group: 'POI_KS',
    groupName: 'Kiểm soát & Địa danh',
    color: '#334e68',
    svg: `<circle cx="12" cy="12" r="6" fill="{c}" ${STROKE}/>`,
  },
};

// Quy loại đối tượng của một lớp/feature về "kind" của bộ ký hiệu.
export function kindFor(layer: string, props: Record<string, unknown>): string {
  if (layer === 'barracks') return 'barracks';
  if (layer === 'facilities') return 'facility';
  if (layer === 'storage-locations') {
    const c = String(props.type ?? props.category ?? '').toUpperCase();
    return STYLES[c] ? c : 'KHO';
  }
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

export const LEGEND: SymbolStyle[] = [
  STYLES.barracks,
  STYLES.SO_CHI_HUY,
  STYLES.facility,
  STYLES.KHO,
  STYLES.KHO_DAN,
  STYLES.TRAM_BIEN_AP,
  STYLES.CONG,
  STYLES.MOC_GIOI,
];

export function legendSvg(st: SymbolStyle): string {
  const inner = st.svg.replace(/\{c\}/g, st.color);
  return `<svg width="20" height="20" viewBox="0 0 24 24">${inner}</svg>`;
}
