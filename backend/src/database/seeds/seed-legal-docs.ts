// Seed M20 — Văn bản, tiêu chuẩn, định mức liên quan quản lý doanh trại.
// Số/ký hiệu mang tính tham khảo (trừ CV 2837/DT-QLDT vốn dùng xuyên suốt dự án) —
// GHI CHÚ rõ cần đối chiếu văn bản gốc trước khi sử dụng chính thức (nguyên tắc không bịa).
import 'reflect-metadata';
import dataSource from '../data-source';
import { LegalDocument } from '../../modules/legal-docs/entities/legal-document.entity';

const NOTE = 'Dữ liệu mẫu (seed). Số/ký hiệu tham khảo — cần đối chiếu văn bản gốc trước khi sử dụng chính thức.';
const daysStr = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(LegalDocument);

  const docs: Array<Partial<LegalDocument> & { code: string; _supersedesCode?: string }> = [
    { code: 'VB-DD-2024', docNumber: '31/2024/QH15', title: 'Luật Đất đai', docType: 'LAW', issuingBody: 'Quốc hội', issuedDate: '2024-01-18', effectiveDate: '2024-08-01', effectiveStatus: 'EFFECTIVE', field: 'DAT_DAI', confidentiality: 'PUBLIC', summary: 'Quy định về quản lý, sử dụng đất; nền tảng cho quản lý đất quốc phòng.' },
    { code: 'VB-TSC-2017', docNumber: '15/2017/QH14', title: 'Luật Quản lý, sử dụng tài sản công', docType: 'LAW', issuingBody: 'Quốc hội', issuedDate: '2017-06-21', effectiveDate: '2018-01-01', effectiveStatus: 'EFFECTIVE', field: 'TAI_CHINH', confidentiality: 'PUBLIC', summary: 'Quản lý, sử dụng tài sản công gồm tài sản tại đơn vị lực lượng vũ trang.' },
    { code: 'VB-DQP-ND', docNumber: 'Nghị định về đất quốc phòng, an ninh', title: 'Nghị định quy định việc quản lý, sử dụng đất quốc phòng kết hợp lao động sản xuất', docType: 'DECREE', issuingBody: 'Chính phủ', issuedDate: '2021-05-01', effectiveDate: '2021-07-01', effectiveStatus: 'EFFECTIVE', field: 'DAT_DAI', confidentiality: 'INTERNAL', summary: 'Quản lý, sử dụng đất quốc phòng.' },
    { code: 'VB-DT-TT', docNumber: 'Thông tư BQP về công tác doanh trại', title: 'Thông tư quy định công tác quản lý doanh trại trong Quân đội', docType: 'CIRCULAR', issuingBody: 'Bộ Quốc phòng', issuedDate: '2019-03-15', effectiveDate: '2019-05-01', effectiveStatus: 'EFFECTIVE', field: 'DOANH_TRAI', confidentiality: 'INTERNAL', summary: 'Quy định nghiệp vụ quản lý, khai thác, bảo quản doanh trại.' },
    { code: 'VB-2837-DT', docNumber: '2837/DT-QLDT', title: 'Danh mục tài sản ngành doanh trại (Phụ lục kèm CV 2837)', docType: 'REGULATION', issuingBody: 'Cục Doanh trại / TCHC-KT', issuedDate: '2023-10-01', effectiveDate: '2023-10-01', effectiveStatus: 'EFFECTIVE', field: 'VAT_CHAT', confidentiality: 'INTERNAL', summary: 'Tổng danh mục tài sản ngành doanh trại (các chương I–XVII), mã hoá tài sản.', keywords: 'danh mục, tài sản, doanh cụ, mã tài sản' },
    { code: 'VB-2027-BS', docNumber: 'Hướng dẫn bổ sung danh mục trang bị 2027', title: 'Hướng dẫn bổ sung, cập nhật danh mục trang bị doanh trại năm 2027', docType: 'GUIDELINE', issuingBody: 'Cục Doanh trại / TCHC-KT', issuedDate: '2026-12-01', effectiveDate: '2027-01-01', effectiveStatus: 'EFFECTIVE', field: 'VAT_CHAT', confidentiality: 'INTERNAL', summary: 'Bổ sung, điều chỉnh danh mục trang bị; thay thế danh mục kèm CV 2837.', _supersedesCode: 'VB-2837-DT' },
    { code: 'VB-TCVN-DT', docNumber: 'TCVN xây dựng doanh trại', title: 'Tiêu chuẩn thiết kế công trình doanh trại', docType: 'STANDARD', issuingBody: 'Bộ Quốc phòng', issuedDate: '2018-01-01', effectiveDate: '2018-06-01', effectiveStatus: 'EFFECTIVE', field: 'XDCB', confidentiality: 'PUBLIC', summary: 'Tiêu chuẩn thiết kế nhà ở, nhà làm việc, công trình phụ trợ doanh trại.' },
    { code: 'VB-DM-KTKT', docNumber: 'Định mức KT-KT doanh trại', title: 'Định mức kinh tế - kỹ thuật công tác doanh trại', docType: 'NORM', issuingBody: 'Tổng cục HC-KT', issuedDate: '2020-01-01', effectiveDate: '2020-03-01', effectiveStatus: 'EFFECTIVE', field: 'VAT_CHAT', confidentiality: 'INTERNAL', summary: 'Định mức sử dụng vật chất, định mức sửa chữa, bảo trì doanh trại.' },
    { code: 'VB-DM-CU', docNumber: 'Định mức doanh cụ (cũ)', title: 'Định mức trang bị doanh cụ (bản cũ)', docType: 'NORM', issuingBody: 'Cục Doanh trại', issuedDate: '2012-01-01', effectiveDate: '2012-03-01', effectiveStatus: 'EXPIRED', field: 'VAT_CHAT', confidentiality: 'INTERNAL', expiryDate: '2020-02-28', summary: 'Bản định mức cũ, đã hết hiệu lực.' },
    { code: 'VB-KH-TINH-2026', docNumber: 'KH-DT/2026', title: 'Kế hoạch công tác doanh trại năm 2026 (Bộ CHQS tỉnh)', docType: 'PLAN', issuingBody: 'Bộ CHQS tỉnh', issuedDate: '2026-01-05', effectiveDate: '2026-01-05', effectiveStatus: 'EFFECTIVE', field: 'DOANH_TRAI', confidentiality: 'INTERNAL', expiryDate: daysStr(45), summary: 'Kế hoạch công tác doanh trại năm 2026, có hiệu lực trong năm.' },
    { code: 'VB-PA-BD', docNumber: 'Phương án bảo đảm doanh trại (mật)', title: 'Phương án bảo đảm doanh trại khi chuyển trạng thái', docType: 'REGULATION', issuingBody: 'Bộ CHQS tỉnh', issuedDate: '2025-06-01', effectiveDate: '2025-06-01', effectiveStatus: 'EFFECTIVE', field: 'DOANH_TRAI', confidentiality: 'CONFIDENTIAL', summary: 'Phương án bảo đảm doanh trại trong các trạng thái sẵn sàng chiến đấu (độ mật).' },
  ];

  let created = 0, skipped = 0;
  const idByCode = new Map<string, string>();
  // Vòng 1: tạo (chưa gắn supersedes).
  for (const d of docs) {
    const existing = await repo.findOne({ where: { code: d.code } });
    if (existing) { idByCode.set(d.code, existing.id); skipped++; continue; }
    const { _supersedesCode, ...fields } = d;
    void _supersedesCode;
    const saved = await repo.save(repo.create({ ...fields, notes: NOTE, createdBy: null, updatedBy: null } as LegalDocument));
    idByCode.set(d.code, saved.id);
    created++;
  }
  // Vòng 2: gắn liên kết thay thế + đánh dấu văn bản bị thay thế.
  for (const d of docs) {
    if (!d._supersedesCode) continue;
    const selfId = idByCode.get(d.code);
    const targetId = idByCode.get(d._supersedesCode);
    if (!selfId || !targetId) continue;
    await repo.update(selfId, { supersedesId: targetId });
    await repo.update(targetId, { effectiveStatus: 'SUPERSEDED' });
  }

  console.log(`M20 seed văn bản pháp quy: +${created} văn bản (bỏ qua ${skipped}).`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
