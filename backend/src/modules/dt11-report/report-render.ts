import { existsSync } from 'fs';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// DT-11 — Renderer file phát hành. Tái dùng cách dựng PDF (pdfkit + DejaVuSans + watermark) / Excel (exceljs)
// của module reporting (M12), nhưng lấy dữ liệu từ dataset đã cấu hình (layout columns + rows) thay vì SQL hard-code.

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

export interface RenderColumn {
  key: string;
  header: string;
}
export interface RenderInput {
  title: string;
  subtitle: string; // nguồn + thời điểm chốt + dataset_hash
  columns: RenderColumn[];
  rows: Array<Record<string, string>>;
  watermark: string;
}

export async function renderExcel(input: RenderInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BaoCao');
  ws.addRow([input.title]);
  ws.addRow([input.subtitle]);
  ws.addRow([`Người phát hành: ${input.watermark}`]);
  ws.addRow([]);
  ws.addRow(input.columns.map((c) => c.header));
  ws.getRow(5).font = { bold: true };
  for (const r of input.rows) ws.addRow(input.columns.map((c) => r[c.key] ?? ''));
  ws.columns.forEach((col) => {
    col.width = 20;
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function renderPdf(input: RenderInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const useFont = existsSync(FONT_PATH);
    if (useFont) {
      doc.registerFont('vn', FONT_PATH);
      if (existsSync(FONT_BOLD)) doc.registerFont('vn-bold', FONT_BOLD);
      doc.font('vn');
    }
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Watermark động theo người phát hành: chữ chéo mờ, lặp mỗi trang (vẽ trước → nằm dưới nội dung).
    const stamp = () => {
      const sx = doc.x;
      const sy = doc.y;
      doc.save();
      doc.rotate(-30, { origin: [300, 420] });
      doc
        .font(useFont ? 'vn' : 'Helvetica')
        .fontSize(28)
        .fillColor('#000000')
        .opacity(0.06)
        .text(`CSDL DOANH TRẠI · ${input.watermark}`, 40, 400, { width: 700, align: 'center' });
      doc.restore();
      doc.opacity(1).fillColor('#000000');
      doc.x = sx;
      doc.y = sy;
    };
    stamp();
    doc.on('pageAdded', stamp);

    doc.font(useFont && existsSync(FONT_BOLD) ? 'vn-bold' : 'Helvetica-Bold').fontSize(15).text(input.title);
    doc.moveDown(0.3);
    doc.font(useFont ? 'vn' : 'Helvetica').fontSize(8).fillColor('#627d98').text(input.subtitle);
    doc.moveDown(0.8).fillColor('#000');

    const startX = 40;
    const colW = 515 / Math.max(1, input.columns.length);
    const rowH = 15;
    const drawRow = (values: string[], bold = false) => {
      if (doc.y + rowH > 800) doc.addPage();
      const y = doc.y;
      doc.font(useFont ? (bold && existsSync(FONT_BOLD) ? 'vn-bold' : 'vn') : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      values.forEach((v, i) => doc.text(v, startX + i * colW, y, { width: colW - 6, height: rowH - 3, lineBreak: false, ellipsis: true }));
      doc.y = y + rowH;
    };
    drawRow(input.columns.map((c) => c.header), true);
    doc.moveTo(startX, doc.y - 2).lineTo(startX + 515, doc.y - 2).strokeColor('#d9e2ec').stroke();
    for (const r of input.rows) drawRow(input.columns.map((c) => r[c.key] ?? ''));
    doc.moveDown(1).fontSize(8).fillColor('#829ab1').text(`Tổng số dòng: ${input.rows.length}`);
    doc.end();
  });
}
