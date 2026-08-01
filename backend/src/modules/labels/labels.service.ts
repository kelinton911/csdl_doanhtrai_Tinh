import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { existsSync } from 'fs';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { Barracks } from '../barracks/entities/barracks.entity';
import { StorageLocation } from '../inventory/entities/storage-location.entity';
import { AssetCatalogItem } from '../asset-catalog/entities/asset-catalog-item.entity';

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

// Loại đối tượng gắn tem QR: doanh trại, kho/trạm, loại tài sản (danh mục).
export type ScanType = 'barracks' | 'storage' | 'asset';
const SCAN_TYPES: ScanType[] = ['barracks', 'storage', 'asset'];

export interface Resolved {
  type: ScanType;
  code: string;
  found: boolean;
  id: string | null;
  name: string | null;
  route: string | null; // đường dẫn webapp để điều hướng sau khi quét
}

// M10 — Tem QR & tra cứu khi quét. Mã QR mã hoá deep-link `/scan/<type>/<code>` để quét
// trong PWA (hoặc camera thường) điều hướng đúng; tra cứu resolve về thực thể nghiệp vụ.
@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Barracks) private readonly barracks: Repository<Barracks>,
    @InjectRepository(StorageLocation) private readonly storage: Repository<StorageLocation>,
    @InjectRepository(AssetCatalogItem) private readonly assets: Repository<AssetCatalogItem>,
  ) {}

  private assertType(type: string): ScanType {
    if (!SCAN_TYPES.includes(type as ScanType)) {
      throw new BadRequestException('VAL-001: type hỗ trợ: barracks | storage | asset');
    }
    return type as ScanType;
  }

  // Nội dung mã QR: deep-link. Nếu không cấu hình WEBAPP_URL → đường dẫn tương đối.
  payload(type: ScanType, code: string): string {
    const base = (process.env.WEBAPP_URL ?? '').replace(/\/$/, '');
    return `${base}/scan/${type}/${encodeURIComponent(code)}`;
  }

  private routeFor(type: ScanType, code: string, id: string): string {
    if (type === 'barracks') return `/barracks/${id}`;
    if (type === 'storage') return '/storage';
    return `/asset-catalog?code=${encodeURIComponent(code)}`;
  }

  private async findOne(type: ScanType, code: string) {
    if (type === 'barracks') return this.barracks.findOne({ where: { code } });
    if (type === 'storage') return this.storage.findOne({ where: { code } });
    return this.assets.findOne({ where: { code } });
  }

  async resolve(typeRaw: string, code: string): Promise<Resolved> {
    const type = this.assertType(typeRaw);
    const e = (await this.findOne(type, code)) as { id: string; name: string } | null;
    return {
      type,
      code,
      found: !!e,
      id: e?.id ?? null,
      name: e?.name ?? null,
      route: e ? this.routeFor(type, code, e.id) : null,
    };
  }

  async qrPng(typeRaw: string, code: string, size = 320): Promise<Buffer> {
    const type = this.assertType(typeRaw);
    return QRCode.toBuffer(this.payload(type, code), {
      type: 'png',
      width: Math.min(Math.max(size, 96), 1024),
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  // Tờ tem QR (PDF, A4) cho nhiều mã cùng loại — in dán tại kho/trạm/công trình/doanh trại.
  async labelSheet(typeRaw: string, codes: string[]): Promise<Buffer> {
    const type = this.assertType(typeRaw);
    const list = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
    if (!list.length) throw new BadRequestException('VAL-001: Thiếu danh sách mã');
    if (list.length > 200) throw new BadRequestException('VAL-001: Tối đa 200 tem mỗi tờ');

    const repo =
      type === 'barracks' ? this.barracks : type === 'storage' ? this.storage : this.assets;
    const rows = (await (repo as Repository<{ code: string; name: string }>).find({
      where: { code: In(list) },
      select: { code: true, name: true },
    })) as Array<{ code: string; name: string }>;
    const nameByCode = new Map(rows.map((r) => [r.code, r.name]));

    const useFont = existsSync(FONT_PATH);
    const doc = new PDFDocument({ size: 'A4', margin: 28 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    if (useFont) {
      doc.registerFont('vn', FONT_PATH);
      if (existsSync(FONT_BOLD)) doc.registerFont('vn-bold', FONT_BOLD);
    }
    const font = (bold = false) =>
      doc.font(useFont ? (bold && existsSync(FONT_BOLD) ? 'vn-bold' : 'vn') : bold ? 'Helvetica-Bold' : 'Helvetica');

    // Lưới 3 cột × 5 hàng mỗi trang.
    const cols = 3;
    const rowsPerPage = 5;
    const cellW = (doc.page.width - 56) / cols;
    const cellH = (doc.page.height - 56) / rowsPerPage;
    const qrSize = Math.min(cellW, cellH) - 44;

    for (let i = 0; i < list.length; i++) {
      const posInPage = i % (cols * rowsPerPage);
      if (i > 0 && posInPage === 0) doc.addPage();
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      const x = 28 + col * cellW;
      const y = 28 + row * cellH;
      const code = list[i];
      const png = await this.qrPng(type, code, 512);
      doc.image(png, x + (cellW - qrSize) / 2, y + 6, { width: qrSize, height: qrSize });
      font(true).fontSize(10).fillColor('#000000')
        .text(code, x + 4, y + qrSize + 12, { width: cellW - 8, align: 'center' });
      const nm = nameByCode.get(code);
      if (nm) {
        font(false).fontSize(7).fillColor('#334155')
          .text(nm, x + 4, y + qrSize + 26, { width: cellW - 8, align: 'center', height: 20, ellipsis: true });
      }
    }
    doc.end();
    return done;
  }
}
