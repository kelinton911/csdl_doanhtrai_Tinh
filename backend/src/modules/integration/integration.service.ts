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
import { Facility } from '../facilities/entities/facility.entity';
import { FacilityStatus } from '../facilities/facility-status';
import { StorageLocation } from '../inventory/entities/storage-location.entity';
import { MapPoi } from '../gis/entities/map-poi.entity';
import { EDITABLE_STATUSES, WorkflowStatus } from '../../common/workflow';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Một mục trong lô đồng bộ offline (M26).
interface SyncItem {
  localId: string;
  entityType: string;
  targetId: string;
  baseVersion: number;
  payload: Record<string, unknown>;
}

interface UploadedFile { originalname: string; buffer: Buffer }

// Cấu hình đích nhập: cột bắt buộc, cột toạ độ, có hình học hay không.
interface TargetCfg {
  required: string[];
  optional: string[];
  hasGeom: boolean; // nhận cột lat,lng → PostGIS Point
  // keyless: đích không định danh bằng code/name (không kiểm trùng mã) — vd chi tiết kiểm kê.
  keyless?: boolean;
  // numeric: các cột phải là số (validate ở staging).
  numeric?: string[];
}
// Cột phân cấp chất lượng của bộ biểu KKDT/03-KK.
const QUALITY_GRADE_COLS = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5'];
const TARGETS: Record<string, TargetCfg> = {
  materials: { required: ['code', 'name'], optional: ['categoryCode', 'unitCode'], hasGeom: false },
  barracks: { required: ['code', 'name'], optional: ['address', 'function', 'lat', 'lng'], hasGeom: true },
  'storage-locations': { required: ['code', 'name'], optional: ['type', 'lat', 'lng'], hasGeom: true },
  pois: { required: ['code', 'name'], optional: ['category', 'symbol_code', 'province_code', 'lat', 'lng'], hasGeom: true },
  // Chi tiết kiểm kê chất lượng (gap 1+3): materialCode/storageCode → stock_quality_details.
  'stock-quality': {
    required: ['materialCode', 'storageCode'],
    optional: ['reservePurpose', 'locationClass', ...QUALITY_GRADE_COLS, 'unitPrice', 'note'],
    hasGeom: false,
    keyless: true,
    numeric: [...QUALITY_GRADE_COLS, 'unitPrice'],
  },
};

// Khung toạ độ Việt Nam (thô) để bắt lỗi lat/lng nhập nhầm.
const VN_LAT = [8.0, 24.0];
const VN_LNG = [102.0, 110.0];

// Tách CSV đơn giản (không hỗ trợ dấu phẩy trong ô có ngoặc kép — dùng mẫu chuẩn của hệ thống).
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
  return { headers, rows };
}

function geoPoint(lng: number, lat: number) {
  return { type: 'Point' as const, coordinates: [lng, lat] };
}

// M14 — Integration & Sync. UC-21 (nhập hàng loạt), UC-22 (đồng bộ offline).
@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(ImportBatch) private readonly imports: Repository<ImportBatch>,
    @InjectRepository(SyncBatch) private readonly syncs: Repository<SyncBatch>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(Barracks) private readonly barracks: Repository<Barracks>,
    @InjectRepository(Facility) private readonly facilities: Repository<Facility>,
    @InjectRepository(StorageLocation) private readonly storage: Repository<StorageLocation>,
    @InjectRepository(MapPoi) private readonly pois: Repository<MapPoi>,
    private readonly ds: DataSource,
  ) {}

  private repoForCodes(target: string): Repository<{ code: string }> {
    switch (target) {
      case 'barracks':
        return this.barracks as unknown as Repository<{ code: string }>;
      case 'storage-locations':
        return this.storage as unknown as Repository<{ code: string }>;
      case 'pois':
        return this.pois as unknown as Repository<{ code: string }>;
      default:
        return this.materials as unknown as Repository<{ code: string }>;
    }
  }

  // UC-21: tải tệp → parse vào staging → kiểm tra lỗi theo dòng (chưa ghi dữ liệu chính).
  async createImport(target: string, file: UploadedFile | undefined, user: AuthUser) {
    const cfg = TARGETS[target];
    if (!cfg) {
      throw new BadRequestException(
        'VAL-001: target hỗ trợ: materials | barracks | storage-locations | pois | stock-quality',
      );
    }
    if (!file) throw new BadRequestException('VAL-001: Thiếu tệp CSV');
    const { headers, rows } = parseCsv(file.buffer.toString('utf8'));
    for (const r of cfg.required) {
      if (!headers.includes(r)) throw new BadRequestException(`VAL-001: Thiếu cột bắt buộc "${r}"`);
    }
    const idx = (h: string) => headers.indexOf(h);
    const cell = (cells: string[], h: string) => (idx(h) >= 0 ? cells[idx(h)] : undefined);
    // Đích có định danh code (materials/barracks/...): nạp mã đã có để bắt trùng.
    const existingCodes = cfg.keyless
      ? new Set<string>()
      : new Set(
          (await this.repoForCodes(target).find({ select: { code: true } })).map((m) => m.code),
        );
    // Đích stock-quality: nạp mã vật chất/kho hợp lệ để kiểm tra tham chiếu ngay ở staging.
    const materialCodes =
      target === 'stock-quality'
        ? new Set((await this.materials.find({ select: { code: true } })).map((x) => x.code))
        : new Set<string>();
    const storageCodes =
      target === 'stock-quality'
        ? new Set((await this.storage.find({ select: { code: true } })).map((x) => x.code))
        : new Set<string>();
    const seen = new Set<string>();
    const staging: Array<Record<string, unknown>> = [];
    const errors: Array<{ row: number; column?: string; message: string }> = [];

    rows.forEach((cells, i) => {
      const rowNo = i + 2; // dòng 1 là header
      const code = (cell(cells, 'code') ?? '').trim();
      const name = (cell(cells, 'name') ?? '').trim();
      const rec: Record<string, unknown> = { code, name, __valid: true };
      // các cột phụ theo đích
      for (const col of cfg.optional) rec[col] = cell(cells, col) ?? null;

      if (cfg.keyless) {
        // Đích không định danh code/name: kiểm cột bắt buộc + cột số.
        for (const col of cfg.required) {
          const v = (cell(cells, col) ?? '').trim();
          rec[col] = v || null;
          if (!v) { errors.push({ row: rowNo, column: col, message: `Thiếu ${col}` }); rec.__valid = false; }
        }
        for (const col of cfg.numeric ?? []) {
          const raw = (cell(cells, col) ?? '').trim();
          if (raw && Number.isNaN(Number(raw))) {
            errors.push({ row: rowNo, column: col, message: `${col} phải là số` });
            rec.__valid = false;
          }
        }
        if (target === 'stock-quality') {
          const mc = (rec.materialCode as string) ?? '';
          const sc = (rec.storageCode as string) ?? '';
          if (mc && !materialCodes.has(mc)) {
            errors.push({ row: rowNo, column: 'materialCode', message: `Không có mã vật chất ${mc}` });
            rec.__valid = false;
          }
          if (sc && !storageCodes.has(sc)) {
            errors.push({ row: rowNo, column: 'storageCode', message: `Không có mã kho ${sc}` });
            rec.__valid = false;
          }
        }
      } else {
        if (!code) { errors.push({ row: rowNo, column: 'code', message: 'Thiếu mã' }); rec.__valid = false; }
        if (!name) { errors.push({ row: rowNo, column: 'name', message: 'Thiếu tên' }); rec.__valid = false; }
        if (code && (existingCodes.has(code) || seen.has(code))) {
          errors.push({ row: rowNo, column: 'code', message: `Trùng mã ${code}` });
          rec.__valid = false;
        }
        if (code) seen.add(code);
      }

      // Toạ độ (nếu đích có hình học): cả hai lat/lng phải cùng có/không, đúng khung VN.
      if (cfg.hasGeom) {
        const latRaw = (cell(cells, 'lat') ?? '').trim();
        const lngRaw = (cell(cells, 'lng') ?? '').trim();
        if (latRaw || lngRaw) {
          const lat = Number(latRaw);
          const lng = Number(lngRaw);
          if (!latRaw || !lngRaw || Number.isNaN(lat) || Number.isNaN(lng)) {
            errors.push({ row: rowNo, column: 'lat/lng', message: 'lat và lng phải cùng có và là số' });
            rec.__valid = false;
          } else if (lat < VN_LAT[0] || lat > VN_LAT[1] || lng < VN_LNG[0] || lng > VN_LNG[1]) {
            errors.push({ row: rowNo, column: 'lat/lng', message: 'Toạ độ ngoài khung Việt Nam' });
            rec.__valid = false;
          } else {
            rec.lat = lat;
            rec.lng = lng;
          }
        }
      }
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
    const target = b.target;

    // stock-quality: dựng sẵn ánh xạ mã → id (vật chất, kho) để commit nhanh.
    const matIdByCode = new Map<string, string>();
    const locIdByCode = new Map<string, string>();
    if (target === 'stock-quality') {
      for (const x of await this.materials.find({ select: { id: true, code: true } })) matIdByCode.set(x.code, x.id);
      for (const x of await this.storage.find({ select: { id: true, code: true } })) locIdByCode.set(x.code, x.id);
    }

    const committed = await this.ds.transaction(async (m) => {
      let n = 0;
      for (const r of valid) {
        const loc = r.lat != null && r.lng != null ? geoPoint(r.lng as number, r.lat as number) : null;
        if (target === 'stock-quality') {
          const materialId = matIdByCode.get(r.materialCode as string);
          const storageLocationId = locIdByCode.get(r.storageCode as string);
          if (!materialId || !storageLocationId) continue; // đã chặn ở staging; phòng thủ
          const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v)).toFixed(3);
          const price = r.unitPrice == null || r.unitPrice === '' ? null : Number(r.unitPrice).toFixed(3);
          // Upsert theo (vật chất × kho × mục đích × vị trí) — cập nhật nếu đã có.
          await m.query(
            `INSERT INTO stock_quality_details
               (material_id, storage_location_id, reserve_purpose, location_class,
                qty_grade_1, qty_grade_2, qty_grade_3, qty_grade_4, qty_grade_5,
                unit_price, note, created_by, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
             ON CONFLICT (material_id, storage_location_id, reserve_purpose, location_class)
             DO UPDATE SET
               qty_grade_1 = EXCLUDED.qty_grade_1, qty_grade_2 = EXCLUDED.qty_grade_2,
               qty_grade_3 = EXCLUDED.qty_grade_3, qty_grade_4 = EXCLUDED.qty_grade_4,
               qty_grade_5 = EXCLUDED.qty_grade_5, unit_price = EXCLUDED.unit_price,
               note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now(),
               row_version = stock_quality_details.row_version + 1`,
            [
              materialId, storageLocationId,
              (r.reservePurpose as string) || 'THUONG_XUYEN',
              (r.locationClass as string) || 'DANG_SU_DUNG',
              num(r.grade1), num(r.grade2), num(r.grade3), num(r.grade4), num(r.grade5),
              price, (r.note as string) ?? null, user.sub,
            ],
          );
        } else if (target === 'materials') {
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
        } else if (target === 'barracks') {
          await m.getRepository(Barracks).save(
            m.getRepository(Barracks).create({
              code: r.code as string,
              name: r.name as string,
              address: (r.address as string) ?? null,
              function: (r.function as string) ?? null,
              location: loc,
              workflowStatus: WorkflowStatus.DRAFT,
              createdBy: user.sub,
              updatedBy: user.sub,
            }),
          );
        } else if (target === 'storage-locations') {
          await m.getRepository(StorageLocation).save(
            m.getRepository(StorageLocation).create({
              code: r.code as string,
              name: r.name as string,
              type: (r.type as string) ?? null,
              location: loc,
              status: 'ACTIVE',
              createdBy: user.sub,
            }),
          );
        } else if (target === 'pois') {
          await m.getRepository(MapPoi).save(
            m.getRepository(MapPoi).create({
              code: r.code as string,
              name: r.name as string,
              category: (r.category as string) ?? 'DIA_DANH',
              symbolCode: (r.symbol_code as string) ?? null,
              provinceCode: (r.province_code as string) ?? null,
              location: loc,
              source: 'import',
              status: 'ACTIVE',
              createdBy: user.sub,
            }),
          );
        }
        n++;
      }
      return n;
    });
    b.status = 'COMMITTED';
    b.committedCount = committed;
    return this.imports.save(b);
  }

  // UC-22 / M26: nhận lô đồng bộ offline, idempotent theo batchKey; xung đột phiên bản
  // KHÔNG ghi đè (server time là chuẩn) mà trả dữ liệu server để client hòa giải.
  // Hỗ trợ entityType: barracks | facility (đối tượng tổ khảo sát sửa ngoài hiện trường).
  async syncBatch(
    body: { batchKey: string; clientId?: string; items: SyncItem[] },
    user: AuthUser,
  ) {
    if (!body.batchKey) throw new BadRequestException('VAL-001: Thiếu batchKey');
    const existing = await this.syncs.findOne({ where: { batchKey: body.batchKey } });
    if (existing) return existing; // gửi lại không tạo trùng

    const results: Array<Record<string, unknown>> = [];
    for (const it of body.items ?? []) {
      try {
        if (it.entityType === 'barracks') results.push(await this.applyBarracksSync(it, user));
        else if (it.entityType === 'facility') results.push(await this.applyFacilitySync(it, user));
        else results.push({ localId: it.localId, status: 'failed', message: `entityType không hỗ trợ: ${it.entityType}` });
      } catch (e) {
        results.push({ localId: it.localId, status: 'failed', message: (e as Error).message });
      }
    }

    return this.syncs.save(
      this.syncs.create({
        batchKey: body.batchKey,
        clientId: body.clientId ?? null,
        items: (body.items ?? []) as unknown as Array<Record<string, unknown>>,
        results,
        status: 'PROCESSED',
        createdBy: user.sub,
      }),
    );
  }

  private async applyBarracksSync(it: SyncItem, user: AuthUser): Promise<Record<string, unknown>> {
    const b = await this.barracks.findOne({ where: { id: it.targetId } });
    if (!b) return { localId: it.localId, status: 'failed', message: 'Không tìm thấy doanh trại' };
    if (b.rowVersion !== it.baseVersion) {
      return { localId: it.localId, status: 'conflict', serverVersion: b.rowVersion, server: { name: b.name, address: b.address, function: b.function } };
    }
    if (!EDITABLE_STATUSES.includes(b.workflowStatus)) {
      return { localId: it.localId, status: 'failed', message: `Trạng thái ${b.workflowStatus} không cho sửa` };
    }
    const p = it.payload;
    if (typeof p.name === 'string') b.name = p.name;
    if (typeof p.address === 'string') b.address = p.address;
    if (typeof p.function === 'string') b.function = p.function;
    if (typeof p.declaredCapacity === 'number') b.declaredCapacity = p.declaredCapacity;
    if (p.landArea != null && !Number.isNaN(Number(p.landArea))) b.landArea = String(p.landArea);
    b.updatedBy = user.sub;
    const saved = await this.barracks.save(b);
    return { localId: it.localId, status: 'applied', serverVersion: saved.rowVersion };
  }

  private async applyFacilitySync(it: SyncItem, user: AuthUser): Promise<Record<string, unknown>> {
    const f = await this.facilities.findOne({ where: { id: it.targetId } });
    if (!f) return { localId: it.localId, status: 'failed', message: 'Không tìm thấy công trình' };
    if (f.rowVersion !== it.baseVersion) {
      return { localId: it.localId, status: 'conflict', serverVersion: f.rowVersion, server: { name: f.name, condition: f.condition, status: f.status } };
    }
    if (f.status === FacilityStatus.DECOMMISSIONED) {
      return { localId: it.localId, status: 'failed', message: 'Công trình đã thanh lý, không cho sửa' };
    }
    const p = it.payload;
    if (typeof p.name === 'string') f.name = p.name;
    if (typeof p.condition === 'string') f.condition = p.condition;
    if (typeof p.status === 'string' && (Object.values(FacilityStatus) as string[]).includes(p.status)) {
      f.status = p.status as FacilityStatus;
    }
    if (typeof p.declaredCapacity === 'number') f.declaredCapacity = p.declaredCapacity;
    if (typeof p.buildYear === 'number') f.buildYear = p.buildYear;
    if (p.area != null && !Number.isNaN(Number(p.area))) f.area = String(p.area);
    f.updatedBy = user.sub;
    const saved = await this.facilities.save(f);
    return { localId: it.localId, status: 'applied', serverVersion: saved.rowVersion };
  }

  async getSyncBatch(id: string) {
    const b = await this.syncs.findOne({ where: { id } });
    if (!b) throw new NotFoundException('DATA-001: Không tìm thấy lô đồng bộ');
    return b;
  }
}
