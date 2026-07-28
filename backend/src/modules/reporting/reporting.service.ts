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
};

// M12 — Reporting & Analytics. UC-19 (tìm kiếm), UC-20 (xuất báo cáo).
@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
    private readonly storage: StorageService,
    private readonly ds: DataSource,
  ) {}

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
    if (!['pdf', 'excel'].includes(format)) throw new BadRequestException('VAL-001: format phải là pdf|excel');

    const snapshotAt = new Date();
    const rows: Record<string, unknown>[] = await this.ds.query(def.query);

    const buffer = format === 'excel'
      ? await this.buildExcel(def, rows, snapshotAt)
      : await this.buildPdf(def, rows, snapshotAt);

    const contentType = format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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

  private async buildExcel(def: TemplateDef, rows: Record<string, unknown>[], at: Date): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BaoCao');
    ws.addRow([def.title]);
    ws.addRow([`Thời điểm chốt: ${at.toLocaleString('vi-VN')} · Nguồn: CSDL Vật chất Doanh trại (giả lập)`]);
    ws.addRow([]);
    ws.addRow(def.columns.map((c) => c.header));
    const headerRow = ws.getRow(4);
    headerRow.font = { bold: true };
    for (const r of rows) ws.addRow(def.columns.map((c) => r[c.key] ?? ''));
    ws.columns.forEach((col) => { col.width = 22; });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  private buildPdf(def: TemplateDef, rows: Record<string, unknown>[], at: Date): Promise<Buffer> {
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
