import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { SyncBatch } from './entities/sync-batch.entity';
import { Material } from '../master-data/entities/material.entity';
import { Barracks } from '../barracks/entities/barracks.entity';
import { EDITABLE_STATUSES } from '../../common/workflow';
import { AuthUser } from '../../common/decorators/current-user.decorator';

interface UploadedFile { originalname: string; buffer: Buffer }

// Tách CSV đơn giản (không hỗ trợ dấu phẩy trong ô có ngoặc kép — dùng mẫu chuẩn của hệ thống).
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
  return { headers, rows };
}

// M14 — Integration & Sync. UC-21 (nhập hàng loạt), UC-22 (đồng bộ offline).
@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(ImportBatch) private readonly imports: Repository<ImportBatch>,
    @InjectRepository(SyncBatch) private readonly syncs: Repository<SyncBatch>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(Barracks) private readonly barracks: Repository<Barracks>,
    private readonly ds: DataSource,
  ) {}

  // UC-21: tải tệp → parse vào staging → kiểm tra lỗi theo dòng (chưa ghi dữ liệu chính).
  async createImport(target: string, file: UploadedFile | undefined, user: AuthUser) {
    if (target !== 'materials') {
      throw new BadRequestException('VAL-001: Hiện hỗ trợ target=materials');
    }
    if (!file) throw new BadRequestException('VAL-001: Thiếu tệp CSV');
    const { headers, rows } = parseCsv(file.buffer.toString('utf8'));
    const required = ['code', 'name'];
    for (const r of required) {
      if (!headers.includes(r)) throw new BadRequestException(`VAL-001: Thiếu cột bắt buộc "${r}"`);
    }
    const idx = (h: string) => headers.indexOf(h);
    const existingCodes = new Set(
      (await this.materials.find({ select: { code: true } })).map((m) => m.code),
    );
    const seen = new Set<string>();
    const staging: Array<Record<string, unknown>> = [];
    const errors: Array<{ row: number; column?: string; message: string }> = [];

    rows.forEach((cells, i) => {
      const rowNo = i + 2; // dòng 1 là header
      const code = cells[idx('code')] ?? '';
      const name = cells[idx('name')] ?? '';
      const rec: Record<string, unknown> = {
        code,
        name,
        categoryCode: idx('categoryCode') >= 0 ? cells[idx('categoryCode')] : null,
        unitCode: idx('unitCode') >= 0 ? cells[idx('unitCode')] : null,
        __valid: true,
      };
      if (!code) { errors.push({ row: rowNo, column: 'code', message: 'Thiếu mã' }); rec.__valid = false; }
      if (!name) { errors.push({ row: rowNo, column: 'name', message: 'Thiếu tên' }); rec.__valid = false; }
      if (code && (existingCodes.has(code) || seen.has(code))) {
        errors.push({ row: rowNo, column: 'code', message: `Trùng mã ${code}` });
        rec.__valid = false;
      }
      if (code) seen.add(code);
      staging.push(rec);
    });

    const validRows = staging.filter((s) => s.__valid).length;
    return this.imports.save(
      this.imports.create({
        target,
        filename: file.originalname,
        status: 'STAGED',
        totalRows: rows.length,
        validRows,
        errorRows: rows.length - validRows,
        staging,
        errors,
        createdBy: user.sub,
      }),
    );
  }

  async getValidation(id: string) {
    const b = await this.imports.findOne({ where: { id } });
    if (!b) throw new NotFoundException('DATA-001: Không tìm thấy lô nhập');
    return b;
  }

  // UC-21: xác nhận commit các dòng hợp lệ (transaction + rollback nếu lỗi).
  async commitImport(id: string, user: AuthUser) {
    const b = await this.imports.findOne({ where: { id } });
    if (!b) throw new NotFoundException('DATA-001: Không tìm thấy lô nhập');
    if (b.status === 'COMMITTED') throw new ConflictException('WF-001: Lô đã commit');
    const valid = b.staging.filter((s) => s.__valid);
    const committed = await this.ds.transaction(async (m) => {
      let n = 0;
      for (const r of valid) {
        await m.getRepository(Material).save(
          m.getRepository(Material).create({
            code: r.code as string,
            name: r.name as string,
            categoryCode: (r.categoryCode as string) ?? null,
            unitCode: (r.unitCode as string) ?? null,
            status: 'DRAFT',
            createdBy: user.sub,
            updatedBy: user.sub,
          }),
        );
        n++;
      }
      return n;
    });
    b.status = 'COMMITTED';
    b.committedCount = committed;
    return this.imports.save(b);
  }

  // UC-22: nhận lô đồng bộ, idempotent theo batchKey; xung đột phiên bản không ghi đè.
  async syncBatch(
    body: { batchKey: string; clientId?: string; items: Array<{ localId: string; entityType: string; targetId: string; baseVersion: number; payload: Record<string, unknown> }> },
    user: AuthUser,
  ) {
    if (!body.batchKey) throw new BadRequestException('VAL-001: Thiếu batchKey');
    const existing = await this.syncs.findOne({ where: { batchKey: body.batchKey } });
    if (existing) return existing; // gửi lại không tạo trùng

    const results: Array<Record<string, unknown>> = [];
    for (const it of body.items ?? []) {
      if (it.entityType !== 'barracks') {
        results.push({ localId: it.localId, status: 'failed', message: 'Chỉ hỗ trợ entityType=barracks' });
        continue;
      }
      const b = await this.barracks.findOne({ where: { id: it.targetId } });
      if (!b) {
        results.push({ localId: it.localId, status: 'failed', message: 'Không tìm thấy đối tượng' });
        continue;
      }
      if (b.rowVersion !== it.baseVersion) {
        // Server time là chuẩn; xung đột trả dữ liệu server để client hòa giải.
        results.push({ localId: it.localId, status: 'conflict', serverVersion: b.rowVersion, server: { name: b.name, address: b.address } });
        continue;
      }
      if (!EDITABLE_STATUSES.includes(b.workflowStatus)) {
        results.push({ localId: it.localId, status: 'failed', message: `Trạng thái ${b.workflowStatus} không cho sửa` });
        continue;
      }
      if (typeof it.payload.name === 'string') b.name = it.payload.name;
      if (typeof it.payload.address === 'string') b.address = it.payload.address as string;
      b.updatedBy = user.sub;
      const saved = await this.barracks.save(b);
      results.push({ localId: it.localId, status: 'applied', serverVersion: saved.rowVersion });
    }

    return this.syncs.save(
      this.syncs.create({
        batchKey: body.batchKey,
        clientId: body.clientId ?? null,
        items: body.items ?? [],
        results,
        status: 'PROCESSED',
        createdBy: user.sub,
      }),
    );
  }

  async getSyncBatch(id: string) {
    const b = await this.syncs.findOne({ where: { id } });
    if (!b) throw new NotFoundException('DATA-001: Không tìm thấy lô đồng bộ');
    return b;
  }
}
