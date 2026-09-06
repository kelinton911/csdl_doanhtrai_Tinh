#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trình trích xuất MỘT LẦN (offline) bộ 5 biểu BCQK Đất Quốc phòng Hải Phòng 2026
→ sinh file dữ liệu tham chiếu backend/src/database/seeds/land-hai-phong-2026.data.ts.

Đã đối chiếu: 991 thửa, tổng số điểm 974(kỳ trước)/962(kỳ này),
diện tích 8.567.842,8 / 8.447.095,5 m² — KHỚP TUYỆT ĐỐI dòng tổng "THÀNH PHỐ HẢI PHÒNG".

Lưu ý kỹ thuật: openpyxl trả None cho ô merged không phải góc trên-trái; logic gộp
dòng "continuation" (thửa trải nhiều dòng vật lý, ví dụ đường hầm nhiều cửa) dựa vào đó.

Chạy: python3 scripts/extract-hai-phong-land.py
"""
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print('Cần: pip install openpyxl', file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'thu thập CSDL' / 'HẢI PHÒNG - KK TÀI SẢN NGÀNH DOANH TRẠI 2026' \
    / 'HẢI PHÒNG - KK TÀI SẢN NGÀNH DOANH TRẠI 2026' \
    / '1,2,3,4,5. BCQK TỔNG HỢP ĐẤT QUỐC PHÒNG NỘP QK3 NĂM 2026 - chuẩn.xlsx'
OUT = ROOT / 'backend' / 'src' / 'database' / 'seeds' / 'land-hai-phong-2026.data.ts'

DATA_SOURCE = 'REFERENCE_HAIPHONG_2026'


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def isnum(v):
    return v is not None and re.match(r'^[0-9]+$', str(v).strip())


def txt(v):
    if v is None:
        return None
    s = str(v).replace('\r', ' ').replace('\n', ' ').strip()
    return s or None


def extract_parcels(wb):
    """Sheet 2 (BC KIỂM KÊ ĐQP) — nguồn thửa chi tiết nhất (địa chỉ, GCN, hồ sơ)."""
    ws = wb['2. BC KIỂM KÊ ĐQP']
    blocks = {}
    parcels = []
    cur_block = None
    cur = None
    for r in range(10, ws.max_row + 1):
        A = ws.cell(r, 1).value
        B = ws.cell(r, 2).value
        C = ws.cell(r, 3).value   # xã, phường
        D = ws.cell(r, 4).value   # tỉnh, thành phố
        E = ws.cell(r, 5).value   # điểm kỳ trước
        F = num(ws.cell(r, 6).value)   # DT kỳ trước
        K = ws.cell(r, 11).value  # điểm kỳ này
        L = num(ws.cell(r, 12).value)  # DT kỳ này
        M = ws.cell(r, 13).value  # điểm GCN
        N = ws.cell(r, 14).value  # serie/ngày GCN
        O = num(ws.cell(r, 15).value)  # DT GCN
        P = ws.cell(r, 16).value  # hồ sơ pháp lý
        Q = ws.cell(r, 17).value  # ghi chú
        s = str(A).strip() if A is not None else ''

        if s in ('A', 'B', 'C', 'D', 'E'):
            cur_block = s
            cur = None
            blocks[s] = txt(B)
            continue
        if s == '*':
            cur = None
            continue
        if A is None and E is not None:
            # dòng tổng ngành/toàn TP (aggregate) — bỏ qua khỏi tổng thửa lá
            cur = None
            continue
        if isnum(s):
            cur = {
                'block': cur_block,
                'stt': int(s),
                'name': txt(B) or f'Thửa {s}',
                'commune': txt(C),
                'province': txt(D) or 'Hải Phòng',
                'pointPrev': int(num(E)),
                'areaPrev': F,
                'point': int(num(K)),
                'area': L,
                'certPoint': int(num(M)),
                'certSerie': txt(N),
                'certArea': O,
                'legalDocs': txt(P),
                'note': txt(Q),
            }
            parcels.append(cur)
        elif A is None and E is None and (F > 0 or L > 0) and cur is not None:
            # dòng continuation (thửa merged nhiều dòng): gộp diện tích vào thửa hiện tại
            cur['areaPrev'] += F
            cur['area'] += L
            if O:
                cur['certArea'] += O
    return blocks, parcels


def extract_economic(wb):
    """Sheet 4 — đất QP cho thuê/mượn/LDLK. Mọi khoản HP đều 'đơn vị tự ký' (cột M)."""
    ws = wb['4. BC KK ĐQP SD VÀO MỤC ĐÍCH KT']
    rows = []
    category = None
    for r in range(10, ws.max_row + 1):
        A = ws.cell(r, 1).value
        B = ws.cell(r, 2).value
        C = ws.cell(r, 3).value
        D = ws.cell(r, 4).value
        F = num(ws.cell(r, 6).value)   # DT kiểm kê
        s = str(A).strip() if A is not None else ''
        name = txt(B)
        if name and s == '' and F == 0:
            # tiêu đề nhóm hợp đồng (còn hạn / đã thanh lý)
            if 'THANH LÝ' in name.upper():
                category = 'LIQUIDATED'
            elif 'THỜI HẠN' in name.upper() or 'CÒN' in name.upper():
                category = 'ACTIVE'
            elif 'BỘ CHQS' in name.upper():
                category = None
            continue
        if isnum(s) and F > 0:
            rows.append({
                'name': name,
                'commune': txt(C),
                'province': txt(D) or 'Hải Phòng',
                'area': F,
                'category': category or 'ACTIVE',
                'legalBasis': 'TU_KY',
                'bqpStatus': 'KHONG',
            })
    return rows


def extract_family(wb):
    """Sheet 5 — khu gia đình. Hải Phòng không có bản ghi chi tiết (chỉ dòng TỔNG CỘNG)."""
    ws = wb['1. BC CÁC KHU GĐQĐ ĐV ĐANG QL']
    rows = []
    for r in range(9, ws.max_row + 1):
        A = ws.cell(r, 1).value
        B = ws.cell(r, 2).value
        if not isnum(A) or B is None:
            continue
        rows.append({
            'name': txt(B),
            'address': txt(ws.cell(r, 3).value),
            'totalArea': num(ws.cell(r, 4).value),
            'households': int(num(ws.cell(r, 5).value)),
            'legalDoc': txt(ws.cell(r, 6).value),
            'notHandedReason': txt(ws.cell(r, 7).value),
            'plannedHandover': txt(ws.cell(r, 8).value),
        })
    return rows


def ts_literal(v):
    return json.dumps(v, ensure_ascii=False)


def main():
    if not SRC.exists():
        print(f'Không thấy file nguồn: {SRC}', file=sys.stderr)
        sys.exit(1)
    wb = openpyxl.load_workbook(SRC, data_only=True)
    blocks, parcels = extract_parcels(wb)
    economic = extract_economic(wb)
    family = extract_family(wb)

    tp = sum(p['pointPrev'] for p in parcels)
    tn = sum(p['point'] for p in parcels)
    ap = sum(p['areaPrev'] for p in parcels)
    an = sum(p['area'] for p in parcels)
    print(f'Thửa: {len(parcels)} | điểm {tp}/{tn} | DT {ap:.1f}/{an:.1f}')
    print(f'Cho thuê KT: {len(economic)} | Khu GĐ: {len(family)}')
    assert tp == 974 and tn == 962, 'Số điểm không khớp tổng biểu gốc!'
    assert abs(ap - 8567842.8) < 1 and abs(an - 8447095.5) < 1, 'Diện tích không khớp tổng biểu gốc!'

    nl = '\n'
    block_arr = (',' + nl + '  ').join(
        f'{{ code: {ts_literal(c)}, name: {ts_literal(n)} }}' for c, n in blocks.items()
    )
    parcel_lines = []
    for i, p in enumerate(parcels, start=1):
        p['code'] = f'HP26-{i:04d}'
        parcel_lines.append('  ' + ts_literal(p))
    econ_lines = ['  ' + ts_literal(e) for e in economic]
    fam_lines = ['  ' + ts_literal(fm) for fm in family]
    parcels_ts = (',' + nl).join(parcel_lines)
    econ_ts = (',' + nl).join(econ_lines)
    fam_ts = (',' + nl).join(fam_lines)

    header = f'''// TỆP SINH TỰ ĐỘNG — KHÔNG SỬA TAY.
// Nguồn: 1,2,3,4,5. BCQK TỔNG HỢP ĐẤT QUỐC PHÒNG NỘP QK3 NĂM 2026 - chuẩn.xlsx (Hải Phòng).
// Trình sinh: scripts/extract-hai-phong-land.py — chạy lại khi file gốc đổi.
// Dữ liệu THAM CHIẾU (dataSource={DATA_SOURCE}), KHÔNG phải số liệu production.
// Đối chiếu: {len(parcels)} thửa, điểm {tp}/{tn}, diện tích {ap:.1f}/{an:.1f} m² — khớp dòng tổng gốc.

export const HP_DATA_SOURCE = {ts_literal(DATA_SOURCE)};
export const HP_PERIOD_CURRENT = '2026-01-01';
export const HP_PERIOD_PREVIOUS = '2025-01-01';

export interface HpBlock {{ code: string; name: string; }}
export interface HpParcel {{
  code: string; block: string; stt: number; name: string;
  commune: string | null; province: string;
  pointPrev: number; areaPrev: number; point: number; area: number;
  certPoint: number; certSerie: string | null; certArea: number;
  legalDocs: string | null; note: string | null;
}}
export interface HpEconomic {{
  name: string; commune: string | null; province: string;
  area: number; category: string; legalBasis: string; bqpStatus: string;
}}
export interface HpFamily {{
  name: string; address: string | null; totalArea: number;
  households: number; legalDoc: string | null;
  notHandedReason: string | null; plannedHandover: string | null;
}}

export const HP_BLOCKS: HpBlock[] = [
  {block_arr}
];

export const HP_PARCELS: HpParcel[] = [
{parcels_ts}
];

export const HP_ECONOMIC: HpEconomic[] = [
{econ_ts}
];

export const HP_FAMILY: HpFamily[] = [
{fam_ts}
];
'''
    OUT.write_text(header, encoding='utf-8')
    print(f'Đã ghi {OUT} ({len(parcels)} thửa, {len(economic)} cho thuê, {len(family)} khu GĐ).')


if __name__ == '__main__':
    main()
