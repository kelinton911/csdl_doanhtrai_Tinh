// Seed M16 — Nguồn lực huy động tại địa phương quanh địa bàn THẬT (Thanh Hóa): rải toạ độ
// gần các doanh trại đã có để tính năng "tìm nguồn gần" hoạt động; kèm hiệp đồng (một số
// sắp/đã hết hiệu lực để kích hoạt cảnh báo). Idempotent theo mã.
import 'reflect-metadata';
import dataSource from '../data-source';
import { LocalResource } from '../../modules/local-resources/entities/local-resource.entity';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';
import { RESOURCE_TYPE_CATEGORY } from '../../modules/local-resources/dto/local-resource.dto';

let s = 20260816;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const dateStr = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
const TH_CENTER = { lng: 105.7772, lat: 19.8069 };

// Bộ mẫu nguồn lực (type + tên gợi ý + đơn vị năng lực).
const TEMPLATES: Array<{ type: string; names: string[]; unit: string; qty: [number, number] }> = [
  { type: 'LODGING', names: ['Nhà khách', 'Khách sạn', 'Nhà nghỉ CĐ'], unit: 'chỗ', qty: [50, 300] },
  { type: 'WAREHOUSE', names: ['Nhà kho', 'Kho hàng'], unit: 'm2', qty: [300, 2000] },
  { type: 'WORKSHOP', names: ['Nhà xưởng cơ khí', 'Xưởng gỗ'], unit: 'm2', qty: [200, 1500] },
  { type: 'SCHOOL_HALL', names: ['Trường THPT', 'Hội trường xã', 'Nhà văn hóa'], unit: 'chỗ', qty: [200, 800] },
  { type: 'OPEN_LAND', names: ['Khu đất trống', 'Sân vận động'], unit: 'm2', qty: [2000, 20000] },
  { type: 'GENERATOR', names: ['Máy phát điện (DN)', 'Tổ máy phát'], unit: 'kW', qty: [50, 500] },
  { type: 'PUMP', names: ['Trạm bơm', 'Máy bơm công suất lớn'], unit: 'm3/h', qty: [20, 200] },
  { type: 'WATER_SOURCE', names: ['Nhà máy nước', 'Giếng công nghiệp'], unit: 'm3/ngày', qty: [500, 5000] },
  { type: 'BUILDING_MATERIAL', names: ['Cửa hàng VLXD', 'Đại lý xi măng - sắt thép'], unit: 'tấn', qty: [50, 1000] },
  { type: 'MATERIAL_FACTORY', names: ['Nhà máy gạch', 'Cơ sở sản xuất bê tông'], unit: 'tấn/ngày', qty: [20, 300] },
  { type: 'CONSTRUCTION_EQUIP', names: ['Đội máy xúc - ủi', 'Cẩu - xe tải ben'], unit: 'phương tiện', qty: [3, 30] },
  { type: 'TECH_TEAM', names: ['Đội kỹ thuật điện nước', 'Tổ thợ xây lành nghề'], unit: 'người', qty: [5, 40] },
  { type: 'CONSTRUCTION_FIRM', names: ['Công ty xây dựng', 'DN xây lắp'], unit: 'công trình/năm', qty: [5, 40] },
  { type: 'REPAIR_SHOP', names: ['Gara ô tô', 'Cơ sở sửa máy phát - bơm'], unit: 'lượt/tháng', qty: [10, 100] },
  { type: 'SUPPLY_FURNITURE', names: ['Xưởng mộc bàn ghế giường tủ', 'Cơ sở cung ứng bạt - lều'], unit: 'bộ', qty: [50, 500] },
];
const OWNERS = ['ENTERPRISE', 'PRIVATE', 'STATE', 'INDIVIDUAL'];
const MOB = ['IMMEDIATE', 'SHORT', 'MEDIUM', 'LONG'];
const REL = ['HIGH', 'HIGH', 'MEDIUM', 'LOW'];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(LocalResource);
  const areaRepo = dataSource.getRepository(AdministrativeArea);

  const barracks: Array<{ loc: string | null }> = await dataSource.query(
    `SELECT ST_AsGeoJSON(location) AS loc FROM barracks WHERE location IS NOT NULL`,
  );
  const centers = barracks
    .map((b) => (b.loc ? JSON.parse(b.loc).coordinates : null))
    .filter(Boolean)
    .map((c: number[]) => ({ lng: c[0], lat: c[1] }));
  const communes = await areaRepo.find({ where: { level: 'COMMUNE' }, take: 12 });

  let created = 0, skipped = 0;
  const TOTAL = 40;
  for (let i = 0; i < TOTAL; i++) {
    const code = `NL-${String(i + 1).padStart(3, '0')}`;
    if (await repo.findOne({ where: { code } })) { skipped++; continue; }
    const tpl = TEMPLATES[i % TEMPLATES.length];
    const base = centers.length ? pick(centers) : TH_CENTER;
    const loc = point(base.lng + (rnd() - 0.5) * 0.12, base.lat + (rnd() - 0.5) * 0.12);
    const area = communes.length ? pick(communes) : null;
    const qty = Math.round(tpl.qty[0] + rnd() * (tpl.qty[1] - tpl.qty[0]));
    // Hiệp đồng: ~35% đã ký; trong số đó rải hạn (đã hết / sắp hết / còn hạn dài).
    const signed = rnd() < 0.35;
    let agreementStatus = 'NONE';
    let agreementNo: string | null = null;
    let validUntil: string | null = null;
    if (signed) {
      agreementStatus = 'SIGNED';
      agreementNo = `HĐ-${2024 + Math.floor(rnd() * 2)}/${100 + i}`;
      const roll = rnd();
      const offset = roll < 0.2 ? -(20 + Math.floor(rnd() * 200)) : roll < 0.4 ? 10 + Math.floor(rnd() * 15) : 200 + Math.floor(rnd() * 500);
      validUntil = dateStr(daysFromNow(offset));
    }
    await repo.save(repo.create({
      code,
      name: `${pick(tpl.names)} ${area ? area.name : 'TP Thanh Hóa'}`,
      category: RESOURCE_TYPE_CATEGORY[tpl.type],
      resourceType: tpl.type,
      ownerName: pick(['Công ty TNHH Thành Đạt', 'DN tư nhân Hồng Phúc', 'HTX Dịch vụ Đông Sơn', 'Cơ sở Minh Quang', 'Công ty CP Sông Mã']),
      ownerType: pick(OWNERS),
      contactName: pick(['Ô. Hải', 'Ô. Tuấn', 'B. Lan', 'Ô. Sơn']),
      contactPhone: `09${Math.floor(10000000 + rnd() * 89999999)}`,
      areaId: area?.id ?? null,
      address: `Địa bàn ${area ? area.name : 'TP Thanh Hóa'}`,
      location: loc,
      capacityDesc: `Khả năng cung ứng ~${qty} ${tpl.unit}`,
      capacityQty: qty.toString(),
      capacityUnit: tpl.unit,
      mobilizationTime: pick(MOB),
      reliability: pick(REL),
      agreementNo,
      agreementValidUntil: validUntil,
      agreementStatus,
      surveyedAt: dateStr(daysFromNow(-(30 + Math.floor(rnd() * 300)))),
      surveyNote: 'Khảo sát sơ bộ; dữ liệu mẫu — cần đối chiếu hiệp đồng thực tế.',
      status: 'ACTIVE',
      notes: null,
      createdBy: null,
      updatedBy: null,
    }));
    created++;
  }

  console.log(`M16 seed nguồn lực huy động: +${created} nguồn lực (bỏ qua ${skipped}).`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
