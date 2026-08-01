import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { existsSync } from 'fs';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ReportJob } from './report-job.entity';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

interface TemplateDef {
  title: string;
  columns: Array<{ key: string; header: string }>;
  query: string;
}

const TEMPLATES: Record<string, TemplateDef> = {
  'barracks-summary': {
    title: 'Báo cáo tổng hợp doanh trại',
    columns: [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Tên doanh trại' },
      { key: 'area', header: 'Xã/phường' },
      { key: 'capacity', header: 'Tiếp nhận' },
      { key: 'facilities', header: 'Số công trình' },
      { key: 'status', header: 'Trạng thái' },
    ],
    query: `SELECT b.code, b.name, a.name AS area, b.declared_capacity AS capacity,
                   (SELECT COUNT(*) FROM facilities f WHERE f.barracks_id=b.id) AS facilities,
                   b.workflow_status AS status
            FROM barracks b LEFT JOIN administrative_areas a ON a.id=b.area_id
            ORDER BY b.code`,
  },
  'inventory-summary': {
    title: 'Báo cáo tồn kho vật chất',
    columns: [
      { key: 'material', header: 'Vật chất' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'location', header: 'Kho' },
      { key: 'onhand', header: 'Tồn sổ' },
      { key: 'counted', header: 'Kiểm kê' },
    ],
    query: `SELECT m.name AS material, m.unit_code AS unit, l.name AS location,
                   sb.on_hand AS onhand, sb.last_counted AS counted
            FROM stock_balances sb JOIN materials m ON m.id=sb.material_id
            JOIN storage_locations l ON l.id=sb.storage_location_id
            ORDER BY m.code`,
  },
  'facility-quality': {
    title: 'Báo cáo chất lượng công trình',
    columns: [
      { key: 'condition', header: 'Cấp chất lượng' },
      { key: 'count', header: 'Số lượng' },
    ],
    query: `SELECT COALESCE(condition,'CHUA_DANH_GIA') AS condition, COUNT(*) AS count
            FROM facilities GROUP BY 1 ORDER BY 2 DESC`,
  },
  // ---- Biểu kiểm kê ngành Doanh trại (mô phỏng bộ biểu KK Hải Phòng 2026) ----
  // Biểu 02/KK — Số lượng & giá trị VTHH (đơn vị giá trị: 1000đ).
  'bieu-02kk-so-luong-gia-tri': {
    title: 'Biểu 02/KK — Số lượng và giá trị vật tư hàng hóa',
    columns: [
      { key: 'material', header: 'Danh mục' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'unit_price', header: 'Đơn giá (1000đ)' },
      { key: 'qty', header: 'Số lượng tồn' },
      { key: 'value', header: 'Giá trị (1000đ)' },
    ],
    query: `SELECT m.name AS material, m.unit_code AS unit,
                   m.unit_price AS unit_price,
                   COALESCE(SUM(sb.on_hand),0) AS qty,
                   ROUND(COALESCE(SUM(sb.on_hand),0) * COALESCE(m.unit_price,0), 3) AS value
            FROM materials m
            LEFT JOIN stock_balances sb ON sb.material_id = m.id
            GROUP BY m.id, m.name, m.unit_code, m.unit_price
            HAVING COALESCE(SUM(sb.on_hand),0) > 0
            ORDER BY m.code`,
  },
  // Biểu 03/KK — Chất lượng VTHH: phân cấp Cấp 1–5 (từ stock_quality_details).
  'bieu-03kk-chat-luong': {
    title: 'Biểu 03/KK — Chất lượng vật tư hàng hóa (phân cấp 1–5)',
    columns: [
      { key: 'material', header: 'Danh mục' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'total', header: 'Tổng số' },
      { key: 'c1', header: 'Cấp 1' },
      { key: 'c2', header: 'Cấp 2' },
      { key: 'c3', header: 'Cấp 3' },
      { key: 'c4', header: 'Cấp 4' },
      { key: 'c5', header: 'Cấp 5' },
    ],
    query: `SELECT m.name AS material, m.unit_code AS unit,
                   SUM(q.qty_grade_1+q.qty_grade_2+q.qty_grade_3+q.qty_grade_4+q.qty_grade_5) AS total,
                   SUM(q.qty_grade_1) AS c1, SUM(q.qty_grade_2) AS c2, SUM(q.qty_grade_3) AS c3,
                   SUM(q.qty_grade_4) AS c4, SUM(q.qty_grade_5) AS c5
            FROM stock_quality_details q
            JOIN materials m ON m.id = q.material_id
            GROUP BY m.id, m.name, m.unit_code
            ORDER BY m.code`,
  },
  // Biểu 01/KKDT — Biến động tồn theo kỳ kiểm kê (kỳ trước / tăng / giảm / kỳ này).
  'bieu-01kkdt-bien-dong': {
    title: 'Biểu 01/KKDT — Biến động vật chất theo kỳ kiểm kê',
    columns: [
      { key: 'campaign', header: 'Kỳ kiểm kê' },
      { key: 'material', header: 'Danh mục' },
      { key: 'opening', header: 'Kỳ trước' },
      { key: 'increase', header: 'Tăng' },
      { key: 'decrease', header: 'Giảm' },
      { key: 'closing', header: 'Kỳ này' },
      { key: 'closing_value', header: 'Giá trị kỳ này (1000đ)' },
    ],
    query: `SELECT c.name AS campaign, m.name AS material,
                   s.opening_qty AS opening, s.increase_qty AS increase,
                   s.decrease_qty AS decrease, s.closing_qty AS closing,
                   s.closing_value AS closing_value
            FROM inventory_period_snapshots s
            JOIN materials m ON m.id = s.material_id
            LEFT JOIN inspection_campaigns c ON c.id = s.campaign_id
            ORDER BY c.created_at DESC NULLS LAST, m.code`,
  },
};

// M12 — Reporting & Analytics. UC-19 (tìm kiếm), UC-20 (xuất báo cáo).
@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
    private readonly storage: StorageService,
    private readonly ds: DataSource,
  ) {}

  // Liệt kê mẫu báo cáo khả dụng cho FE (không lộ câu truy vấn nội bộ).
  listTemplates() {
    return Object.entries(TEMPLATES).map(([key, def]) => ({
      key,
      title: def.title,
      columns: def.columns.map((c) => c.header),
    }));
  }

  // UC-19: tìm kiếm toàn cục (chỉ trong phạm vi cho phép — data-scope là lộ trình).
  async search(q: string) {
    if (!q || q.trim().length < 1) return { barracks: [], facilities: [], materials: [] };
    const like = `%${q}%`;
    const [barracks, facilities, materials] = await Promise.all([
      this.ds.query(`SELECT id, code, name FROM barracks WHERE code ILIKE $1 OR name ILIKE $1 LIMIT 8`, [like]),
      this.ds.query(`SELECT id, code, name, barracks_id FROM facilities WHERE code ILIKE $1 OR name ILIKE $1 LIMIT 8`, [like]),
      this.ds.query(`SELECT id, code, name FROM materials WHERE code ILIKE $1 OR name ILIKE $1 LIMIT 8`, [like]),
    ]);
    return { barracks, facilities, materials };
  }

  async listJobs() {
    return this.jobs.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  async getJob(id: string) {
    const j = await this.jobs.findOne({ where: { id } });
    if (!j) throw new NotFoundException('DATA-001: Không tìm thấy tác vụ báo cáo');
    return j;
  }

  // UC-20: tạo báo cáo từ snapshot dữ liệu, sinh tệp, lưu MinIO.
  async createReport(template: string, format: string, user: AuthUser) {
    const def = TEMPLATES[template];
    if (!def) throw new BadRequestException(`VAL-001: Mẫu báo cáo không hợp lệ (${template})`);
    if (!['pdf', 'excel', 'word'].includes(format)) throw new BadRequestException('VAL-001: format phải là pdf|excel|word');

    const snapshotAt = new Date();
    const rows: Record<string, unknown>[] = await this.ds.query(def.query);

    // Watermark động theo người dùng (Frontend §11 / Backend §9 — data masking).
    const watermark = `${user.username} · ${snapshotAt.toLocaleString('vi-VN')}`;
    const buffer = format === 'excel'
      ? await this.buildExcel(def, rows, snapshotAt, watermark)
      : format === 'word'
        ? this.buildRtf(def, rows, snapshotAt, watermark)
        : await this.buildPdf(def, rows, snapshotAt, watermark);

    const contentType = format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : format === 'word'
        ? 'application/rtf'
        : 'application/pdf';
    const stored = await this.storage.putObject(buffer, contentType, 'reports');

    return this.jobs.save(
      this.jobs.create({
        template,
        format,
        filters: {},
        status: 'COMPLETED',
        rowCount: rows.length,
        objectKey: stored.objectKey,
        snapshotAt,
        createdBy: user.sub,
      }),
    );
  }

  async downloadUrl(id: string) {
    const j = await this.getJob(id);
    if (!j.objectKey) throw new NotFoundException('DATA-001: Báo cáo chưa có tệp');
    const url = await this.storage.presignedGetUrl(j.objectKey);
    return { url, template: j.template, format: j.format };
  }

  private async buildExcel(def: TemplateDef, rows: Record<string, unknown>[], at: Date, watermark: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BaoCao');
    ws.addRow([def.title]);
    ws.addRow([`Thời điểm chốt: ${at.toLocaleString('vi-VN')} · Nguồn: CSDL Vật chất Doanh trại (giả lập)`]);
    ws.addRow([`Người tải: ${watermark}`]);
    ws.addRow([]);
    ws.addRow(def.columns.map((c) => c.header));
    const headerRow = ws.getRow(5);
    headerRow.font = { bold: true };
    for (const r of rows) ws.addRow(def.columns.map((c) => r[c.key] ?? ''));
    ws.columns.forEach((col) => { col.width = 22; });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  // Xuất Word bằng RTF (Rich Text Format) — Word mở trực tiếp, không cần thư viện ngoài.
  // Hỗ trợ Unicode tiếng Việt qua escape \uN.
  private buildRtf(def: TemplateDef, rows: Record<string, unknown>[], at: Date, watermark: string): Buffer {
    const esc = (s: string) => {
      let out = '';
      for (const ch of String(s)) {
        const code = ch.codePointAt(0)!;
        if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
        else if (code > 127) out += `\\u${code}?`;
        else out += ch;
      }
      return out;
    };
    const cellW = Math.floor(9000 / def.columns.length);
    const rowRtf = (values: string[], bold = false) => {
      let r = '\\trowd\\trgaph80';
      for (let i = 0; i < values.length; i++) r += `\\cellx${cellW * (i + 1)}`;
      for (const v of values) r += `\\intbl ${bold ? '\\b ' : ''}${esc(v)}${bold ? '\\b0' : ''}\\cell`;
      return r + '\\row\n';
    };
    let body = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs22\n';
    body += `{\\b\\fs28 ${esc(def.title)}}\\par\n`;
    body += `{\\fs18 Thời điểm chốt: ${esc(at.toLocaleString('vi-VN'))} · Nguồn: CSDL Vật chất Doanh trại (dữ liệu giả lập)}\\par\n`;
    body += `{\\fs16\\cf1 Người tải: ${esc(watermark)}}\\par\\par\n`;
    body += rowRtf(def.columns.map((c) => c.header), true);
    for (const r of rows) body += rowRtf(def.columns.map((c) => String(r[c.key] ?? '')));
    body += `\\par{\\fs16 Tổng số dòng: ${rows.length}}\\par\n}`;
    return Buffer.from(body, 'utf8');
  }

  private buildPdf(def: TemplateDef, rows: Record<string, unknown>[], at: Date, watermark: string): Promise<Buffer> {
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

      // Watermark động theo người dùng: chữ chéo mờ, lặp trên mỗi trang (vẽ trước nội dung → nằm dưới).
      const stamp = () => {
        const sx = doc.x;
        const sy = doc.y;
        doc.save();
        doc.rotate(-30, { origin: [300, 420] });
        doc.font(useFont ? 'vn' : 'Helvetica').fontSize(28).fillColor('#000000').opacity(0.06)
          .text(`CSDL DOANH TRẠI · ${watermark}`, 40, 400, { width: 700, align: 'center' });
        doc.restore();
        doc.opacity(1).fillColor('#000000');
        doc.x = sx;
        doc.y = sy;
      };
      stamp();
      doc.on('pageAdded', stamp);

      doc.font(useFont && existsSync(FONT_BOLD) ? 'vn-bold' : 'Helvetica-Bold').fontSize(16).text(def.title);
      doc.moveDown(0.3);
      doc.font(useFont ? 'vn' : 'Helvetica').fontSize(9).fillColor('#627d98')
        .text(`Thời điểm chốt: ${at.toLocaleString('vi-VN')} · Nguồn: CSDL Vật chất Doanh trại (dữ liệu giả lập)`);
      doc.moveDown(0.8).fillColor('#000');

      const startX = 40;
      const colW = 515 / def.columns.length;
      const rowH = 15; // chiều cao dòng cố định — mỗi ô một dòng, cắt bớt nếu dài.
      const drawRow = (values: string[], bold = false) => {
        if (doc.y + rowH > 800) doc.addPage();
        const y = doc.y;
        doc.font(useFont ? (bold && existsSync(FONT_BOLD) ? 'vn-bold' : 'vn') : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        values.forEach((v, i) =>
          doc.text(v, startX + i * colW, y, { width: colW - 6, height: rowH - 3, lineBreak: false, ellipsis: true }),
        );
        doc.y = y + rowH;
      };
      drawRow(def.columns.map((c) => c.header), true);
      doc.moveTo(startX, doc.y - 2).lineTo(startX + 515, doc.y - 2).strokeColor('#d9e2ec').stroke();
      for (const r of rows) {
        drawRow(def.columns.map((c) => String(r[c.key] ?? '')));
      }
      doc.moveDown(1).fontSize(8).fillColor('#829ab1').text(`Tổng số dòng: ${rows.length}`);
      doc.end();
    });
  }
}
