// Seed Khâu 4 — Định mức/quy ước tính toán HC-KT theo 6 ngành.
// Căn cứ TRUNG THỰC: docs/Quiuoctinhtoan.pdf ("Thống nhất quy ước tính toán làm văn kiện
// hậu cần chiến đấu trong diễn tập"). calcRole cho engine biết cách dùng khi tính bảo đảm.
import 'reflect-metadata';
import dataSource from '../data-source';
import { LogisticsCalcNorm } from '../../modules/logistics-norms/entities/logistics-calc-norm.entity';

const SRC = 'Quiuoctinhtoan.pdf';
type N = Partial<LogisticsCalcNorm>;

const NORMS: N[] = [
  // ───────── I. QUÂN NHU (QN) ─────────
  { branch: 'QN', code: 'QN-LTTP', name: 'Lương thực - thực phẩm', unit: 'kg', value: '1.2', basis: 'kg/người/ngày', calcRole: 'PERSON_DAY', sortOrder: 1,
    attributes: { khauPhan: { gao_te: 0.75, thit_ca_hop: 0.02, thit_xo_mo: 0.08, ca_tuoi: 0.04, dau_lac_vung: 0.08, muoi: 0.03, mi_chinh: 0.001, rau_xanh: 0.2 } } },
  { branch: 'QN', code: 'QN-CHATDOT', name: 'Chất đốt', unit: 'kg', value: '0.7', basis: 'kg/người/ngày', calcRole: 'PERSON_DAY', sortOrder: 2 },
  { branch: 'QN', code: 'QN-LUONGKHO', name: 'Lương khô', unit: 'kg', value: '0.75', basis: 'kg/người/ngày', calcRole: 'REFERENCE', sortOrder: 3,
    notes: 'Dùng thay khẩu phần nấu khi cơ động; KHÔNG cộng gộp tự động với LTTP.' },
  { branch: 'QN', code: 'QN-QT-CD', name: 'Suất quân trang chiến đấu', unit: 'kg', value: '3', basis: 'kg/suất (mũ sắt, tăng, võng)', calcRole: 'PERSON_ONCE', sortOrder: 4 },
  { branch: 'QN', code: 'QN-QLCD', name: 'Suất QLCĐ', unit: 'kg', value: '2', basis: 'kg/suất (bi đông, ga men, túi cơm)', calcRole: 'PERSON_ONCE', sortOrder: 5 },
  { branch: 'QN', code: 'QN-QT-TB', name: 'Suất quân trang thương binh', unit: 'kg', value: '2.5', basis: 'kg/suất', calcRole: 'CASUALTY_SUAT', sortOrder: 6 },
  { branch: 'QN', code: 'QN-QT-TT', name: 'Suất quân trang bổ sung tổn thất', unit: 'kg', value: '7.5', basis: 'kg/suất', calcRole: 'REFERENCE', sortOrder: 7,
    notes: 'Số suất theo mức tổn thất (người lập nhập).' },
  { branch: 'QN', code: 'QN-QT-TS', name: 'Suất quân trang tử sỹ', unit: 'kg', value: '1', basis: 'kg/suất (tấm liệm, túi tử sỹ)', calcRole: 'REFERENCE', sortOrder: 8 },
  { branch: 'QN', code: 'QN-QT-DV', name: 'Suất quân trang động viên (bình quân SQ/CS)', unit: 'kg', value: '13', basis: 'kg/suất', calcRole: 'REFERENCE', sortOrder: 9 },
  { branch: 'QN', code: 'QN-DUONGSUA-TB', name: 'Suất đường sữa thương binh', unit: 'kg', value: '1.8', basis: 'kg / 7 người TB (đường 1kg, sữa 2 hộp)', calcRole: 'REFERENCE', sortOrder: 10, attributes: { per: 7 } },
  { branch: 'QN', code: 'QN-DCCD-C', name: 'Bộ dụng cụ cấp dưỡng cấp đại đội (100 người)', unit: 'kg', value: '140', basis: 'kg/bộ/đại đội bộ binh', calcRole: 'REFERENCE', sortOrder: 11, attributes: { quanSoDaiDoi: 100 } },

  // ───────── II. QUÂN Y (QY) ─────────
  { branch: 'QY', code: 'QY-TL-TIENCONG', name: 'Tỷ lệ thương binh - dBB tiến công', unit: '%/ngày đêm', value: '15', basis: '10–20% (mặc định 15%)', calcRole: 'REFERENCE', sortOrder: 1, attributes: { min: 10, max: 20, default: 15 } },
  { branch: 'QY', code: 'QY-TL-PHONGNGU', name: 'Tỷ lệ thương binh - dBB phòng ngự', unit: '%/ngày đêm', value: '9', basis: '8–10% (mặc định 9%)', calcRole: 'REFERENCE', sortOrder: 2, attributes: { min: 8, max: 10, default: 9 } },
  { branch: 'QY', code: 'QY-TL-BENHBINH', name: 'Tỷ lệ bệnh binh', unit: '%/ngày đêm', value: '0.1', basis: '0,1%', calcRole: 'REFERENCE', sortOrder: 3 },
  { branch: 'QY', code: 'QY-COSO-K', name: 'Cơ số K (XC) - cứu chữa cơ bản', unit: 'kg', value: '100', basis: 'kg/cơ số (50 TB, 10–12 ngày)', calcRole: 'CASUALTY_COSO', sortOrder: 4, attributes: { tbPer: 50 } },
  { branch: 'QY', code: 'QY-COSO-Y', name: 'Cơ số Y (XB) - cứu chữa bước đầu', unit: 'kg', value: '50', basis: 'kg/cơ số (25 TB, 7–10 ngày)', calcRole: 'CASUALTY_COSO', sortOrder: 5, attributes: { tbPer: 25 } },
  { branch: 'QY', code: 'QY-COSO-BV', name: 'Cơ số bệnh viện (BV)', unit: 'kg', value: '150', basis: 'kg/cơ số (35 TB, 12–15 ngày)', calcRole: 'CASUALTY_COSO', sortOrder: 6, attributes: { tbPer: 35 } },
  { branch: 'QY', code: 'QY-HQ50', name: '1 cơ số HQ-50', unit: 'kg', value: '100', basis: 'kg (điều trị 50 TB)', calcRole: 'REFERENCE', sortOrder: 7 },
  { branch: 'QY', code: 'QY-HQ15', name: '1 cơ số HQ-15', unit: 'kg', value: '60', basis: 'kg (điều trị 15 TB)', calcRole: 'REFERENCE', sortOrder: 8 },
  { branch: 'QY', code: 'QY-TUI-CT', name: 'Túi cứu thương', unit: 'kg', value: '2', basis: 'kg (cấp cứu 7–10 TB)', calcRole: 'REFERENCE', sortOrder: 9 },
  { branch: 'QY', code: 'QY-TUI-YTA', name: 'Túi y tá', unit: 'kg', value: '4', basis: 'kg (cấp cứu 10–15 TB)', calcRole: 'REFERENCE', sortOrder: 10 },
  { branch: 'QY', code: 'QY-TUI-YSY', name: 'Túi y sỹ', unit: 'kg', value: '6', basis: 'kg (bổ sung 20–30 TB)', calcRole: 'REFERENCE', sortOrder: 11 },
  { branch: 'QY', code: 'QY-DAIPHAU', name: 'Bộ đại phẫu thuật', unit: 'kg', value: '40', basis: 'kg/bộ', calcRole: 'REFERENCE', sortOrder: 12 },
  { branch: 'QY', code: 'QY-GIUONG-BV', name: 'Số giường - Bệnh viện khu vực', unit: 'giường', value: '250', basis: 'giường', calcRole: 'REFERENCE', sortOrder: 13 },
  { branch: 'QY', code: 'QY-GIUONG-DC', name: 'Số giường - Bệnh viện dã chiến', unit: 'giường', value: '150', basis: 'giường', calcRole: 'REFERENCE', sortOrder: 14 },
  { branch: 'QY', code: 'QY-GIUONG-DDT', name: 'Số giường - Đội điều trị', unit: 'giường', value: '100', basis: 'giường', calcRole: 'REFERENCE', sortOrder: 15 },

  // ───────── V. DOANH TRẠI (DT) ─────────
  { branch: 'DT', code: 'DT-NUOC', name: 'Nước sinh hoạt', unit: 'lít', value: '5', basis: 'lít/người/ngày (can 20L: 4 người/cái)', calcRole: 'PERSON_DAY', sortOrder: 1, attributes: { nguoiPerCan20: 4 } },
  { branch: 'DT', code: 'DT-DAUTHAP', name: 'Dầu thắp', unit: 'lít', value: '0.5', basis: 'lít/người/tháng (1 lít = 0,8 kg)', calcRole: 'PERSON_MONTH', sortOrder: 2, attributes: { kgPerLit: 0.8 } },
  { branch: 'DT', code: 'DT-NILONG', name: 'Ni lông dày (khổ 1,4m)', unit: 'kg', value: '2.5', basis: 'kg/m', calcRole: 'REFERENCE', sortOrder: 3 },
  { branch: 'DT', code: 'DT-CAN20', name: 'Can nhựa 20 lít', unit: 'kg', value: '2', basis: 'kg/cái (4 người/cái)', calcRole: 'REFERENCE', sortOrder: 4 },
  { branch: 'DT', code: 'DT-HOMTS', name: 'Hòm tử sỹ', unit: 'kg', value: '70', basis: 'kg/hòm', calcRole: 'REFERENCE', sortOrder: 5 },
  { branch: 'DT', code: 'DT-NHABAT-CH', name: 'Nhà bạt chỉ huy', unit: 'kg', value: '70', basis: 'kg/bộ (BCHQS tỉnh 8 bộ; mỗi e/lữ 6 bộ)', calcRole: 'REFERENCE', sortOrder: 6, attributes: { bchqs_tinh: 8, e_lu: 6 } },
  { branch: 'DT', code: 'DT-NHABAT-QY', name: 'Nhà bạt quân y', unit: 'kg', value: '200', basis: 'kg/bộ (1 S16A + 2 S16B); dQY 2 bộ, cQY/e 1 bộ', calcRole: 'REFERENCE', sortOrder: 7 },
  { branch: 'DT', code: 'DT-DENBAO', name: 'Đèn bão', unit: 'kg', value: '0.2', basis: 'kg/cái', calcRole: 'REFERENCE', sortOrder: 8 },
  { branch: 'DT', code: 'DT-BANGHE', name: 'Bàn ghế gấp xếp', unit: 'kg', value: '40', basis: 'kg/bộ', calcRole: 'REFERENCE', sortOrder: 9 },
  { branch: 'DT', code: 'DT-MAYPHAT-5', name: 'Máy phát điện 3-5 KW', unit: 'kg', value: '40', basis: 'kg/cái', calcRole: 'REFERENCE', sortOrder: 10 },
  { branch: 'DT', code: 'DT-MAYPHAT-10', name: 'Máy phát điện 10 KVA', unit: 'kg', value: '75', basis: 'kg/cái', calcRole: 'REFERENCE', sortOrder: 11 },

  // ───────── III. XĂNG DẦU (XD) ─────────
  { branch: 'XD', code: 'XD-TT-XANG', name: 'Tỷ trọng xăng', unit: 'kg/lít', value: '0.725', basis: 'kg/lít', calcRole: 'REFERENCE', sortOrder: 1 },
  { branch: 'XD', code: 'XD-TT-DIESEL', name: 'Tỷ trọng Diesel (Điêzel)', unit: 'kg/lít', value: '0.84', basis: 'kg/lít', calcRole: 'REFERENCE', sortOrder: 2 },
  { branch: 'XD', code: 'XD-TT-DAUNHON', name: 'Tỷ trọng dầu nhờn', unit: 'kg/lít', value: '0.92', basis: 'kg/lít', calcRole: 'REFERENCE', sortOrder: 3 },
  { branch: 'XD', code: 'XD-TT-DAUHOA', name: 'Tỷ trọng dầu hỏa', unit: 'kg/lít', value: '0.75', basis: 'kg/lít', calcRole: 'REFERENCE', sortOrder: 4 },
  { branch: 'XD', code: 'XD-DAUNHON-PCT', name: 'Dầu nhờn tính theo % nhiên liệu chính', unit: '%', value: '7', basis: '% nhiên liệu', calcRole: 'REFERENCE', sortOrder: 5 },
  { branch: 'XD', code: 'XD-TIEUTHU-100KM', name: 'Định mức tiêu thụ nhiên liệu/100km theo xe', unit: 'lít/100km', value: null, basis: 'lít/100km', calcRole: 'REFERENCE', sortOrder: 6,
    attributes: { table: { xe_con_chi_huy: 18, zil157: 52, zil130_131: 38, gat66: 32.5, gat53: 28.5, uaz: 19, zil157_diesel: 38, zil130_diesel: 20, gat66_diesel: 20, xe_tai_nhe: 20, xe_ca_hai_au: 40, huyndai_county_29: 22 }, may_phat: { '3-5KVA': '3 lít/giờ', '10KVA': '5 lít/giờ' } } },

  // ───────── IV. VẬN TẢI (VT) ─────────
  { branch: 'VT', code: 'VT-BO-CN-TB', name: 'Vận tải bộ chuyên nghiệp (mang trang bị)', unit: 'kg/người', value: '25', basis: 'kg/người', calcRole: 'REFERENCE', sortOrder: 1 },
  { branch: 'VT', code: 'VT-BO-CN-KHONG', name: 'Vận tải bộ chuyên nghiệp (không mang trang bị)', unit: 'kg/người', value: '30', basis: 'kg/người', calcRole: 'REFERENCE', sortOrder: 2 },
  { branch: 'VT', code: 'VT-BO-KHONGCN', name: 'Vận tải bộ không chuyên nghiệp', unit: 'kg/người', value: '25', basis: 'kg/người (bộ đội, dân công)', calcRole: 'REFERENCE', sortOrder: 3 },
  { branch: 'VT', code: 'VT-HESO-TT', name: 'Hệ số lợi dụng trọng tải trung bình', unit: 'hệ số', value: '0.8', basis: 'đạn/VLXD/gạo 1; quân lương-trang 0,7; quân y 0,5', calcRole: 'REFERENCE', sortOrder: 4, attributes: { dan_vlxd_gao: 1, quan_luong_trang: 0.7, hang_quan_y: 0.5 } },
  { branch: 'VT', code: 'VT-HESO-KT', name: 'Hệ số kỹ thuật xe ô tô vận tải', unit: 'hệ số', value: '0.85', basis: 'hệ số', calcRole: 'REFERENCE', sortOrder: 5 },
  { branch: 'VT', code: 'VT-QUANSO-KHOE', name: 'Chỉ tiêu quân số khỏe vận tải chuyên nghiệp', unit: '%', value: '98', basis: '%', calcRole: 'REFERENCE', sortOrder: 6 },
  { branch: 'VT', code: 'VT-TRONGTAI', name: 'Khả năng trọng tải các loại xe', unit: 'tấn', value: null, basis: 'tấn (đường tốt)', calcRole: 'REFERENCE', sortOrder: 7,
    attributes: { table: { zil130: 5, zil131: 4, gat66: 2, gat53: 4, xe_dap_tho: 0.2, xe_suc_vat_keo: 0.5, stec_zil130_m3: 5, stec_maz_kamaz_m3: 10 } } },

  // ───────── VI. QUÂN SỐ (QS) ─────────
  { branch: 'QS', code: 'QS-fBB', name: 'Biên chế thời chiến Sư đoàn BB (fBB)', unit: 'người', value: '9050', basis: 'người', calcRole: 'REFERENCE', sortOrder: 1 },
  { branch: 'QS', code: 'QS-eBB', name: 'Biên chế thời chiến Trung đoàn BB (eBB)', unit: 'người', value: '2331', basis: 'người', calcRole: 'REFERENCE', sortOrder: 2 },
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(LogisticsCalcNorm);
  let ins = 0, skip = 0;
  for (const n of NORMS) {
    if (await repo.findOne({ where: { branch: n.branch, code: n.code } })) { skip++; continue; }
    await repo.save(repo.create({ ...n, source: SRC, attributes: n.attributes ?? {} }));
    ins++;
  }
  console.log(`Định mức HC-KT (Quiuoctinhtoan.pdf): +${ins} định mức (bỏ qua ${skip}). Tổng dòng nguồn: ${NORMS.length}.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
