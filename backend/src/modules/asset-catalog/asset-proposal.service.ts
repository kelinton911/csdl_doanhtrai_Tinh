import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { AssetCatalogItem } from './entities/asset-catalog-item.entity';
import { AssetCatalogProposal } from './entities/asset-catalog-proposal.entity';
import { AssetCatalogProposalBatch } from './entities/asset-catalog-proposal-batch.entity';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { allocateChildCode } from './asset-code.util';

// Tiêu đề 4 cột PHẢI trùng nguyên văn phụ lục gốc để đầu nhận đọc được ngay.
const SOURCE_HEADERS = ['STT', 'Mã vật tư', 'Tên vật tư', 'ĐVT'];

export interface CreateProposalInput {
  parentCode: string;
  name: string;
  unitRaw?: string | null;
  unitCode?: string | null;
  justification?: string | null;
  sourceKind?: string;
  sourceId?: string | null;
}

@Injectable()
export class AssetProposalService {
  constructor(
    @InjectRepository(AssetCatalogItem)
    private readonly items: Repository<AssetCatalogItem>,
    @InjectRepository(AssetCatalogProposal)
    private readonly proposals: Repository<AssetCatalogProposal>,
    @InjectRepository(AssetCatalogProposalBatch)
    private readonly batches: Repository<AssetCatalogProposalBatch>,
    private readonly storage: StorageService,
  ) {}

  // ---------------- Đề xuất ----------------

  async list(q: { status?: string; batchId?: string; page: number; size: number; skip: number }) {
    const qb = this.proposals
      .createQueryBuilder('p')
      .orderBy('p.created_at', 'DESC')
      .skip(q.skip)
      .take(q.size);
    if (q.status) qb.andWhere('p.status = :s', { s: q.status });
    if (q.batchId) qb.andWhere('p.batch_id = :b', { b: q.batchId });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page: q.page, size: q.size, total } };
  }

  async create(input: CreateProposalInput, user: AuthUser) {
    const parent = await this.items.findOne({ where: { code: input.parentCode } });
    if (!parent) {
      throw new BadRequestException(
        `DATA-001: Mã cha ${input.parentCode} không có trong danh mục chính thức`,
      );
    }
    if (!input.name?.trim()) {
      throw new BadRequestException('VAL-001: Thiếu tên tài sản đề xuất');
    }

    return this.proposals.save(
      this.proposals.create({
        parentCode: parent.code,
        name: input.name.trim(),
        unitRaw: input.unitRaw?.trim() || null,
        unitCode: input.unitCode ?? null,
        justification: input.justification ?? null,
        sourceKind: input.sourceKind ?? 'MANUAL',
        sourceId: input.sourceId ?? null,
        // Thêm con vào một nút lá sẽ biến nút đó thành nhóm — quyết định của BQP.
        requiresParentPromotion: parent.isLeaf,
        status: 'DRAFT',
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  /**
   * Tính mã kế tiếp cho đề xuất. TRẢ VỀ, KHÔNG LƯU — người dùng xác nhận rồi mới gán.
   *
   * Anh em gồm cả mã chính thức lẫn mã đã cấp cho đề xuất khác, để không cấp trùng
   * trong cùng một đợt rà soát.
   */
  async previewCode(id: string) {
    const p = await this.getOne(id);
    const parent = await this.items.findOne({ where: { code: p.parentCode } });
    if (!parent) throw new BadRequestException(`DATA-001: Mã cha ${p.parentCode} không tồn tại`);

    const official = await this.items.find({
      where: { parentCode: p.parentCode },
      select: { code: true },
    });
    const pending = await this.proposals
      .createQueryBuilder('p')
      .select('p.proposed_code', 'code')
      .where('p.parent_code = :pc AND p.proposed_code IS NOT NULL AND p.id <> :id', {
        pc: p.parentCode,
        id,
      })
      .getRawMany();

    const siblings = [
      ...official.map((o) => o.code),
      ...pending.map((r: { code: string }) => r.code),
    ];

    // allocateChildCode ném Error thường khi nhánh hết mã / cha đã ở cấp cuối.
    // Chuyển thành 400 kèm nguyên văn thông điệp — đây là tình huống nghiệp vụ
    // người dùng xử lý được, không phải lỗi hệ thống (nếu để nguyên sẽ ra 500).
    let allocated: ReturnType<typeof allocateChildCode>;
    try {
      allocated = allocateChildCode(p.parentCode, siblings);
    } catch (err) {
      throw new BadRequestException(`CODE-001: ${(err as Error).message}`);
    }
    return {
      ...allocated,
      parentCode: p.parentCode,
      parentName: parent.name,
      parentPathNames: parent.pathNames,
      requiresParentPromotion: parent.isLeaf,
      siblingCount: siblings.length,
    };
  }

  /** Chốt mã cho đề xuất (sau khi người dùng xem trước và xác nhận). */
  async assignCode(id: string, user: AuthUser) {
    const preview = await this.previewCode(id);
    const dup = await this.proposals.findOne({ where: { proposedCode: preview.code } });
    if (dup) {
      throw new ConflictException(`DATA-003: Mã ${preview.code} đã được cấp cho đề xuất khác`);
    }
    const p = await this.getOne(id);
    p.proposedCode = preview.code;
    p.requiresParentPromotion = preview.requiresParentPromotion;
    p.updatedBy = user.sub;
    return this.proposals.save(p);
  }

  async submit(id: string, user: AuthUser) {
    const p = await this.getOne(id);
    if (!p.proposedCode) {
      throw new BadRequestException('VAL-002: Chưa cấp mã cho đề xuất — bấm "Cấp mã" trước');
    }
    p.status = 'SUBMITTED';
    p.updatedBy = user.sub;
    return this.proposals.save(p);
  }

  async remove(id: string) {
    const p = await this.getOne(id);
    if (p.status === 'EXPORTED') {
      throw new ConflictException('WF-001: Đề xuất đã xuất trong lô — không xoá được');
    }
    await this.proposals.delete(id);
    return { deleted: true };
  }

  private async getOne(id: string) {
    const p = await this.proposals.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy đề xuất');
    return p;
  }

  // ---------------- Lô gửi ----------------

  async listBatches() {
    return this.batches.find({ order: { createdAt: 'DESC' } });
  }

  async createBatch(
    input: { code: string; title: string; deadline?: string },
    user: AuthUser,
  ) {
    const dup = await this.batches.findOne({ where: { code: input.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã lô ${input.code}`);
    return this.batches.save(
      this.batches.create({
        code: input.code,
        title: input.title,
        deadline: input.deadline ?? null,
        status: 'DRAFT',
        createdBy: user.sub,
      }),
    );
  }

  /**
   * Gom các đề xuất đã SUBMITTED vào lô rồi xuất Excel đúng định dạng 4 cột của phụ lục.
   */
  async exportBatch(batchId: string, user: AuthUser) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('DATA-001: Không tìm thấy lô đề xuất');

    // Gom mọi đề xuất đã trình mà chưa thuộc lô nào.
    await this.proposals
      .createQueryBuilder()
      .update()
      .set({ batchId })
      .where('status = :s AND batch_id IS NULL', { s: 'SUBMITTED' })
      .execute();

    const rows = await this.proposals.find({
      where: { batchId, status: In(['SUBMITTED', 'EXPORTED']) },
      order: { proposedCode: 'ASC' },
    });
    if (!rows.length) {
      throw new BadRequestException(
        'VAL-003: Lô chưa có đề xuất nào ở trạng thái "Đã trình". Trình đề xuất trước khi xuất.',
      );
    }

    const parents = await this.items.find({
      where: { code: In([...new Set(rows.map((r) => r.parentCode))]) },
    });
    const parentByCode = new Map(parents.map((p) => [p.code, p]));

    const [head] = await this.items.find({ take: 1, order: { code: 'ASC' } });
    const official = await this.items.find({
      where: { status: 'ACTIVE' },
      order: { code: 'ASC' },
    });

    const buffer = await this.buildWorkbook(batch, rows, parentByCode, official, head, user);
    const stored = await this.storage.putObject(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'asset-catalog-proposals',
    );

    batch.objectKey = stored.objectKey;
    batch.rowCount = rows.length;
    batch.exportedAt = new Date();
    batch.status = 'EXPORTED';
    await this.batches.save(batch);

    await this.proposals
      .createQueryBuilder()
      .update()
      .set({ status: 'EXPORTED' })
      .where('batch_id = :b', { b: batchId })
      .execute();

    return { batchId, rowCount: rows.length, objectKey: stored.objectKey };
  }

  async downloadUrl(batchId: string) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('DATA-001: Không tìm thấy lô đề xuất');
    if (!batch.objectKey) {
      throw new NotFoundException('DATA-001: Lô chưa xuất tệp — bấm "Xuất Excel" trước');
    }
    return { url: await this.storage.presignedGetUrl(batch.objectKey), code: batch.code };
  }

  /**
   * Sổ Excel 3 trang:
   *   1. "Bổ sung"      — đúng 4 cột của phụ lục, ĐVT lấy NGUYÊN VĂN từ unit_raw.
   *   2. "Ngữ cảnh"     — vị trí nút cha trong cây, để đầu nhận không phải tự tra.
   *   3. "Đối chiếu gốc"— 1272 dòng nguyên văn, chứng minh đề xuất dựa đúng bản nào.
   */
  private async buildWorkbook(
    batch: AssetCatalogProposalBatch,
    rows: AssetCatalogProposal[],
    parentByCode: Map<string, AssetCatalogItem>,
    official: AssetCatalogItem[],
    head: AssetCatalogItem | undefined,
    user: AuthUser,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'CSDL Vật chất Doanh trại cấp tỉnh';
    wb.created = new Date();

    // ---- Trang 1: Bổ sung (định dạng nộp) ----
    const s1 = wb.addWorksheet('Bổ sung');
    s1.addRow(['PHỤ LỤC ĐỀ XUẤT BỔ SUNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI']);
    s1.getRow(1).font = { bold: true, size: 13 };
    s1.addRow([`Đối chiếu: Công văn số 2837/DT-QLDT ngày 16/7/2026 của Cục Doanh trại/TCHC-KT`]);
    s1.addRow([`Bản danh mục gốc: ${head?.revision ?? '—'} · SHA-256: ${head?.sourceSha ?? '—'}`]);
    s1.addRow([`Lô đề xuất: ${batch.code} — ${batch.title}`]);
    s1.addRow([
      `Người lập: ${user.username ?? user.sub} · Ngày lập: ${new Date().toLocaleDateString('vi-VN')}` +
        (batch.deadline ? ` · Hạn gửi: ${batch.deadline}` : ''),
    ]);
    s1.addRow([]);
    const h1 = s1.addRow(SOURCE_HEADERS);
    h1.font = { bold: true };
    rows.forEach((r, i) => {
      // ĐVT lấy unit_raw NGUYÊN VĂN — không bao giờ dùng mã đã chuẩn hoá,
      // để cột ĐVT trùng khớp cách viết của phụ lục gốc ("m2 SD", "HT"...).
      s1.addRow([i + 1, r.proposedCode ?? '', r.name, r.unitRaw ?? '']);
    });
    s1.columns = [{ width: 8 }, { width: 24 }, { width: 68 }, { width: 12 }];

    // ---- Trang 2: Ngữ cảnh (vị trí trong cây + lý do) ----
    const s2 = wb.addWorksheet('Ngữ cảnh');
    const h2 = s2.addRow([
      'STT', 'Mã đề xuất', 'Tên tài sản', 'ĐVT', 'Mã nhóm cha',
      'Vị trí trong cây danh mục', 'Lý do đề xuất', 'Ghi chú',
    ]);
    h2.font = { bold: true };
    rows.forEach((r, i) => {
      const parent = parentByCode.get(r.parentCode);
      s2.addRow([
        i + 1,
        r.proposedCode ?? '',
        r.name,
        r.unitRaw ?? '',
        r.parentCode,
        parent?.pathNames ?? '',
        r.justification ?? '',
        r.requiresParentPromotion
          ? 'Nút cha hiện là mục cụ thể — bổ sung mục con sẽ chuyển nút cha thành nhóm.'
          : '',
      ]);
    });
    s2.columns = [
      { width: 8 }, { width: 24 }, { width: 46 }, { width: 10 },
      { width: 24 }, { width: 76 }, { width: 42 }, { width: 52 },
    ];

    // ---- Trang 3: Đối chiếu gốc (1272 dòng nguyên văn, ORDER BY code = thứ tự phụ lục) ----
    const s3 = wb.addWorksheet('Đối chiếu gốc');
    s3.addRow([`TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI — bản ${head?.revision ?? '—'}`]);
    s3.getRow(1).font = { bold: true, size: 12 };
    s3.addRow([`Nguồn: ${head?.sourceDoc ?? '—'} · SHA-256: ${head?.sourceSha ?? '—'}`]);
    s3.addRow([`Tổng số mã: ${official.length}`]);
    s3.addRow([]);
    const h3 = s3.addRow(SOURCE_HEADERS);
    h3.font = { bold: true };
    for (const it of official) {
      s3.addRow([it.sourceRow ?? '', it.code, it.name, it.unitRaw ?? '']);
    }
    s3.columns = [{ width: 8 }, { width: 24 }, { width: 68 }, { width: 12 }];

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  /**
   * CSV UTF-8 có BOM của trang "Bổ sung".
   * Công văn chỉ ghi "kèm theo file dữ liệu" mà không nêu định dạng, nên gửi kèm cả CSV.
   */
  async exportCsv(batchId: string): Promise<string> {
    const rows = await this.proposals.find({
      where: { batchId },
      order: { proposedCode: 'ASC' },
    });
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [SOURCE_HEADERS.map(esc).join(',')];
    rows.forEach((r, i) => {
      lines.push([i + 1, r.proposedCode ?? '', r.name, r.unitRaw ?? ''].map(esc).join(','));
    });
    return '﻿' + lines.join('\r\n');
  }
}
