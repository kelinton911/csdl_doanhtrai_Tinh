// Bộ KÝ HIỆU QUÂN SỰ TÙY BIẾN (VN) cho bản đồ — không dùng chuẩn NATO APP-6.
// Mỗi loại đối tượng có hình dạng + màu riêng, render bằng L.divIcon (SVG nội tuyến).
// Dùng cho lớp điểm: doanh trại, công trình, kho, và POI (sở chỉ huy/trạm/địa danh/cổng...).
import L from 'leaflet';

export interface SymbolStyle {
  key: string;
  label: string;
  group: 'CH_DT' | 'KH_HC' | 'HAU_CAN' | 'HT_KT' | 'POI_KS'; // Phân nhóm ký hiệu
  groupName: string;
  color: string;
  svg: string; // nội dung bên trong <svg viewBox="0 0 24 24">
}

const STROKE = 'stroke="#fff" stroke-width="1.5"';

// ─────────────────────────────────────────────────────────────────────────────
// MÀU CHUẨN ĐIỀU LỆ "Ký hiệu quân sự 09-2011" (xem .claude/knowledge/ky-hieu-quan-su-qdnd.md,
// REF-2026-003, Phần 2.1). Hậu cần – kỹ thuật của TA = ĐỎ.
export const MIL_COLORS = {
  RED: '#cc1e1e', // quân ta / hậu cần – kỹ thuật
  BLUE: '#10609e', // quân địch
  BLACK: '#1f2937', // pháo binh, tên lửa, thông tin, công binh, hoá học
  BROWN: '#8a5a2b', // đường xá, vũ khí sinh học
  GREEN: '#166534', // đệm phụ biên phòng, tàu dân sự nước ngoài
  YELLOW: '#eab308', // chất độc hoá học
} as const;
const RED = MIL_COLORS.RED;

// ── Bộ SINH KÝ HIỆU KHO theo điều lệ (Mục S) ────────────────────────────────
// Cấp quản lý → HÌNH NỀN; ngành → CHỮ trong ký hiệu; trạng thái → nét liền/đứt.
type KhoShape = 'nha' | 'chong' | 'chuNhat' | 'chuNhatNho' | 'tron' | 'tamGiac' | 'chuV';

// Ánh xạ cấp quản lý → hình nền (điều lệ Phần 4.1).
const CAP_SHAPE: Record<string, KhoShape> = {
  TINH: 'nha', // tỉnh/thành, tổng cục = ngôi nhà kho
  HUYEN: 'chuNhat', // huyện/quận, quân đoàn/binh chủng = chữ nhật
  XA: 'chuV', // xã/phường, đại đội = chữ V
  DOANH_TRAI: 'tamGiac', // thuộc doanh trại ≈ cấp tiểu đoàn = tam giác
  QK: 'chong', // quân khu/tổng kho = nhà xếp chồng
  QD: 'chuNhat', // quân đoàn/binh chủng = chữ nhật
  F: 'tron', // sư đoàn = tròn
  E: 'chuNhatNho', // trung/lữ đoàn = chữ nhật nhỏ
  D: 'tamGiac', // tiểu đoàn = tam giác
  C: 'chuV', // đại đội = chữ V
};

// Hình nền: trả body SVG + tâm đặt chữ (tx,ty). fill/stroke/dash lái theo trạng thái.
function khoShapeGeom(
  shape: KhoShape,
  fill: string,
  stroke: string,
  dash: string,
): { body: string; tx: number; ty: number } {
  const sw = `stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" ${dash}`;
  switch (shape) {
    case 'nha':
      return { body: `<path d="M4 11 12 5l8 6v8H4z" fill="${fill}" ${sw}/>`, tx: 12, ty: 15.5 };
    case 'chong': // nhà xếp chồng (tổng/cụm kho, quân khu)
      return {
        body: `<path d="M3 13 9 8" fill="none" ${sw}/><path d="M6 12 12.5 7l6.5 5v7H6z" fill="${fill}" ${sw}/>`,
        tx: 12.5,
        ty: 15.5,
      };
    case 'chuNhat':
      return { body: `<rect x="4" y="8" width="16" height="11" rx="1" fill="${fill}" ${sw}/>`, tx: 12, ty: 14 };
    case 'chuNhatNho':
      return { body: `<rect x="6" y="9" width="12" height="9" rx="1" fill="${fill}" ${sw}/>`, tx: 12, ty: 14 };
    case 'tron':
      return { body: `<circle cx="12" cy="12" r="8" fill="${fill}" ${sw}/>`, tx: 12, ty: 13 };
    case 'tamGiac': // tam giác đỉnh trên (tiểu đoàn / thuộc doanh trại)
      return { body: `<path d="M12 4 21 20H3z" fill="${fill}" ${sw}/>`, tx: 12, ty: 16.5 };
    case 'chuV': // tam giác đỉnh dưới ≈ chữ V (đại đội / xã)
      return { body: `<path d="M3 6H21L12 20z" fill="${fill}" ${sw}/>`, tx: 12, ty: 11 };
  }
}

// Chữ ngành trong ký hiệu (điều lệ Phần 4.2). Quân y = chữ thập; đạn = Đ.
function khoGlyph(nganh: string, tons: number | null, color: string, tx: number, ty: number): string {
  if (nganh === 'QY') {
    return `<path d="M${tx} ${ty - 3.2}v6.4M${tx - 3.2} ${ty}h6.4" stroke="${color}" stroke-width="2.1" stroke-linecap="round"/>`;
  }
  const label = nganh === 'DAN' ? 'Đ' : nganh || 'TH';
  const fs = label.length > 2 ? 5.5 : 7;
  let s = `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${color}">${label}</text>`;
  if (tons != null && tons > 0) {
    s += `<text x="${tx}" y="${ty + 5.4}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="4.2" fill="${color}">${Math.round(tons)}T</text>`;
  }
  return s;
}

// Sinh nội dung SVG (viewBox 24×24) cho một KÝ HIỆU KHO đúng điều lệ.
//  - nganh: LT/XD/QN/QY/VT/DAN/TH/KT (chữ trong ký hiệu)
//  - cap:   TINH/HUYEN/XA/DOANH_TRAI/QK/QD/F/E/D/C (hình nền)
//  - tons:  khối lượng (tấn), ghi dưới chữ ngành
//  - planned: true = dự kiến (chưa duyệt) → NÉT ĐỨT, không tô; false = thực → tô đỏ đặc
export function buildKhoSymbol(opts: {
  nganh?: string | null;
  cap?: string | null;
  tons?: number | null;
  planned?: boolean;
}): string {
  const shape = CAP_SHAPE[String(opts.cap ?? '').toUpperCase()] ?? 'nha';
  const planned = !!opts.planned;
  const fill = planned ? '#ffffff' : RED;
  const dash = planned ? 'stroke-dasharray="2.4 1.7"' : '';
  const glyphColor = planned ? RED : '#ffffff';
  const g = khoShapeGeom(shape, fill, RED, dash);
  const nganh = String(opts.nganh ?? 'TH').toUpperCase();
  return g.body + khoGlyph(nganh, opts.tons ?? null, glyphColor, g.tx, g.ty);
}

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

  // --- NHÓM HẬU CẦN (điều lệ Mục S) — POI hậu cần phi-kho, màu ĐỎ ---
  TRAM_QUAN_Y: {
    key: 'TRAM_QUAN_Y',
    label: 'Trạm quân y',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<circle cx="12" cy="12" r="8.5" fill="{c}" ${STROKE}/>
          <path d="M12 7.4v9.2M7.4 12h9.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  XE_CUU_THUONG: {
    key: 'XE_CUU_THUONG',
    label: 'Xe cứu thương',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<path d="M3 9h9l5 4v4H3z" fill="{c}" ${STROKE}/>
          <circle cx="7" cy="18" r="1.5" fill="{c}" ${STROKE}/><circle cx="15" cy="18" r="1.5" fill="{c}" ${STROKE}/>
          <path d="M7.5 11v3.2M5.9 12.6h3.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
  },
  CAN_CU_HC: {
    key: 'CAN_CU_HC',
    label: 'Căn cứ hậu cần',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<rect x="3" y="7" width="18" height="11" rx="5.5" fill="{c}" ${STROKE}/>
          <text x="12" y="12.7" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="6.5" fill="#fff">HC</text>`,
  },
  BEP_HOANG_CAM: {
    key: 'BEP_HOANG_CAM',
    label: 'Bếp Hoàng Cầm',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<path d="M5 17 8 9h8l3 8z" fill="{c}" ${STROKE}/>
          <path d="M11.5 8.6c0-2 2-2 2-3.8" fill="none" stroke="{c}" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  TRAM_GIAO_NHAN: {
    key: 'TRAM_GIAO_NHAN',
    label: 'Trạm giao nhận',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<path d="M4 8H15L19 12 15 16H4Z" fill="{c}" ${STROKE}/>
          <path d="M8 12h6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
  },
  KHO_XANG_DC: {
    key: 'KHO_XANG_DC',
    label: 'Kho xăng dầu dã chiến (nổi)',
    group: 'HAU_CAN',
    groupName: 'Hậu cần (điều lệ Mục S)',
    color: RED,
    svg: `<circle cx="12" cy="12" r="8" fill="#fff" stroke="{c}" stroke-width="1.8"/>
          <path d="M4 12a8 8 0 0 1 16 0z" fill="{c}"/>
          <text x="12" y="15.8" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="4.6" fill="{c}">XD</text>`,
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

const PLANNED_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED'];

// Tạo L.divIcon cho một điểm theo lớp + thuộc tính.
// Kho hậu cần có phân loại (nganh/cap) → sinh ký hiệu đúng điều lệ (hình theo cấp + chữ ngành +
// nét liền/đứt theo trạng thái duyệt). Các lớp khác dùng preset tĩnh trong STYLES.
export function symbolIcon(layer: string, props: Record<string, unknown>): L.DivIcon {
  let inner: string;
  let label: string;
  if (layer === 'storage-locations' && props.nganh) {
    const wf = String(props.workflow_status ?? props.workflowStatus ?? '').toUpperCase();
    const tonsRaw = props.capacity_tons ?? props.capacityTons;
    inner = buildKhoSymbol({
      nganh: String(props.nganh),
      cap: props.cap != null ? String(props.cap) : null,
      tons: tonsRaw != null && tonsRaw !== '' ? Number(tonsRaw) : null,
      planned: PLANNED_STATUSES.includes(wf),
    });
    label = `Kho ${String(props.nganh)}${props.cap ? ' — ' + String(props.cap) : ''}`;
  } else {
    const st = styleForKind(kindFor(layer, props));
    inner = st.svg.replace(/\{c\}/g, st.color);
    label = st.label;
  }
  return L.divIcon({
    className: 'mil-symbol',
    html: `<svg width="28" height="28" viewBox="0 0 24 24" aria-label="${label}">${inner}</svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -13],
  });
}

// Mục chú giải cho một ký hiệu KHO sinh theo điều lệ (đã tô màu sẵn — không còn {c}).
function khoLegend(key: string, label: string, cap: string, nganh: string): SymbolStyle {
  return {
    key,
    label,
    group: 'HAU_CAN',
    groupName: 'Kho hậu cần theo cấp (điều lệ Mục S)',
    color: RED,
    svg: buildKhoSymbol({ nganh, cap, planned: false }),
  };
}

export const LEGEND: SymbolStyle[] = [
  STYLES.barracks,
  STYLES.SO_CHI_HUY,
  STYLES.facility,
  // Kho hậu cần — hình nền theo CẤP + chữ NGÀNH (điều lệ Mục S)
  khoLegend('KHO_TINH', 'Kho cấp tỉnh (nhà)', 'TINH', 'LT'),
  khoLegend('KHO_HUYEN', 'Kho cấp huyện (chữ nhật)', 'HUYEN', 'XD'),
  khoLegend('KHO_XA', 'Kho cấp xã (chữ V)', 'XA', 'QN'),
  khoLegend('KHO_DOANHTRAI', 'Kho thuộc doanh trại (tam giác)', 'DOANH_TRAI', 'VT'),
  khoLegend('KHO_QY', 'Kho/trạm quân y (chữ thập)', 'HUYEN', 'QY'),
  buildKhoLegendPlanned(),
  // Ký hiệu hậu cần phi-kho
  STYLES.CAN_CU_HC,
  STYLES.TRAM_QUAN_Y,
  STYLES.KHO_XANG_DC,
  STYLES.BEP_HOANG_CAM,
  STYLES.TRAM_GIAO_NHAN,
  // Kiểm soát & địa danh
  STYLES.CONG,
  STYLES.MOC_GIOI,
];

// Ví dụ nét đứt = kho DỰ KIẾN (chưa duyệt) — điều lệ Phần 2.4.
function buildKhoLegendPlanned(): SymbolStyle {
  return {
    key: 'KHO_DU_KIEN',
    label: 'Kho dự kiến (nét đứt)',
    group: 'HAU_CAN',
    groupName: 'Kho hậu cần theo cấp (điều lệ Mục S)',
    color: RED,
    svg: buildKhoSymbol({ nganh: 'LT', cap: 'TINH', planned: true }),
  };
}

export function legendSvg(st: SymbolStyle): string {
  const inner = st.svg.replace(/\{c\}/g, st.color);
  return `<svg width="20" height="20" viewBox="0 0 24 24">${inner}</svg>`;
}
