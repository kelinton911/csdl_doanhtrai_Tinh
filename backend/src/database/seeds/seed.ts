// Seed dữ liệu GIẢ LẬP đầy đủ để mọi màn hình có nội dung (KHÔNG dùng ở PROD).
// Theo Frontend §12: 1 tỉnh, 12 xã/phường, 30 doanh trại, ~180 công trình, danh mục,
// vật chất. Toạ độ là giả lập (dịch chuyển), không phải vị trí thật.
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/roles';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';
import { Catalog } from '../../modules/master-data/entities/catalog.entity';
import { Material } from '../../modules/master-data/entities/material.entity';
import { Barracks } from '../../modules/barracks/entities/barracks.entity';
import { Facility } from '../../modules/facilities/entities/facility.entity';
import { StorageLocation } from '../../modules/inventory/entities/storage-location.entity';
import { StockBalance } from '../../modules/inventory/entities/stock-balance.entity';
import { WorkflowStatus } from '../../common/workflow';
import { FacilityStatus } from '../../modules/facilities/facility-status';

// PRNG tất định để seed tái lập được.
let seed = 20260728;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);

// Tâm giả lập (KHÔNG phải toạ độ thật) + jitter.
const BASE = { lng: 108.2, lat: 15.9 };
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });

async function run() {
  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);
  const areaRepo = dataSource.getRepository(AdministrativeArea);
  const catalogRepo = dataSource.getRepository(Catalog);
  const materialRepo = dataSource.getRepository(Material);
  const barracksRepo = dataSource.getRepository(Barracks);
  const facilityRepo = dataSource.getRepository(Facility);

  // 1) Đơn vị cấp tỉnh
  let province = await orgRepo.findOne({ where: { code: 'TINH-GL' } });
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({ code: 'TINH-GL', name: 'Bộ CHQS tỉnh (giả lập)', type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log('  + Đơn vị cấp tỉnh:', province.code);
  }

  // 2) Tài khoản demo
  const demoUsers: Array<{ username: string; fullName: string; roles: Role[] }> = [
    { username: 'admin', fullName: 'Quản trị hệ thống', roles: [Role.SYS_ADMIN] },
    { username: 'chihuy', fullName: 'Chỉ huy tỉnh', roles: [Role.PROVINCIAL_COMMAND] },
    { username: 'hckt', fullName: 'Cán bộ ngành doanh trại', roles: [Role.BARRACKS_OFFICER] },
    { username: 'xa01', fullName: 'Cán bộ Ban CHQS xã A01', roles: [Role.COMMUNE_USER] },
    { username: 'kiemduyet', fullName: 'Kiểm duyệt viên', roles: [Role.REVIEWER] },
  ];
  const passwordHash = await bcrypt.hash('admin@123', 10);
  for (const u of demoUsers) {
    if (await userRepo.findOne({ where: { username: u.username } })) continue;
    await userRepo.save(
      userRepo.create({ username: u.username, passwordHash, fullName: u.fullName, roles: u.roles, organizationId: province.id, status: 'ACTIVE' }),
    );
    console.log(`  + Tài khoản: ${u.username}`);
  }
  const officer = await userRepo.findOne({ where: { username: 'hckt' } });
  const authorId = officer?.id ?? null;

  // 3) 12 xã/phường + đơn vị Ban CHQS xã
  const areaDefs = [
    ...Array.from({ length: 9 }, (_, i) => ({ code: `XA-A${String(i + 1).padStart(2, '0')}`, name: `Xã A${String(i + 1).padStart(2, '0')} (giả lập)`, type: 'COMMUNE' })),
    ...Array.from({ length: 3 }, (_, i) => ({ code: `PHUONG-P${String(i + 1).padStart(2, '0')}`, name: `Phường P${String(i + 1).padStart(2, '0')} (giả lập)`, type: 'WARD' })),
  ];
  const areas: AdministrativeArea[] = [];
  for (const a of areaDefs) {
    let area = await areaRepo.findOne({ where: { code: a.code } });
    if (!area) {
      area = await areaRepo.save(areaRepo.create({ ...a, status: 'ACTIVE' }));
    }
    areas.push(area);
    const orgCode = `DV-${a.code}`;
    if (!(await orgRepo.findOne({ where: { code: orgCode } }))) {
      await orgRepo.save(orgRepo.create({ code: orgCode, name: `Ban CHQS ${a.name}`, type: 'COMMUNE', parentId: province.id, status: 'ACTIVE' }));
    }
  }
  console.log(`  + Xã/phường: ${areas.length}`);

  // 4) Danh mục dùng chung (phát hành sẵn)
  if ((await catalogRepo.count()) === 0) {
    const cats: Array<Partial<Catalog>> = [];
    const add = (type: string, code: string, name: string, extra: Partial<Catalog> = {}) =>
      cats.push({ type, code, name, status: 'PUBLISHED', effectiveFrom: new Date(), createdBy: authorId, updatedBy: authorId, ...extra });
    // Đơn vị tính
    [['KG', 'Ki-lô-gam'], ['TAN', 'Tấn'], ['CAI', 'Cái'], ['BO', 'Bộ'], ['LIT', 'Lít'], ['M', 'Mét'], ['M2', 'Mét vuông'], ['M3', 'Mét khối'], ['THUNG', 'Thùng'], ['VIEN', 'Viên']].forEach(([c, n], i) => add('unit-of-measure', c, n, { sortOrder: i }));
    // Nhóm vật chất
    [['LUONG-THUC', 'Lương thực - thực phẩm'], ['NHIEN-LIEU', 'Nhiên liệu - chất đốt'], ['QUAN-TRANG', 'Quân trang'], ['VAT-LIEU-XD', 'Vật liệu xây dựng'], ['Y-TE', 'Vật tư y tế'], ['DUNG-CU', 'Dụng cụ - trang bị'], ['DIEN-NUOC', 'Vật tư điện nước']].forEach(([c, n], i) => add('material-category', c, n, { sortOrder: i }));
    // Loại công trình
    [['NHA-O', 'Nhà ở'], ['NHA-AN', 'Nhà ăn - bếp'], ['KHO', 'Kho vật chất'], ['NHA-LV', 'Nhà làm việc'], ['SAN', 'Sân - đường nội bộ'], ['HANG-RAO', 'Hàng rào - cổng'], ['CONG-TRINH-NGAM', 'Công trình ngầm'], ['HA-TANG-KT', 'Hạ tầng kỹ thuật']].forEach(([c, n], i) => add('facility-type', c, n, { sortOrder: i }));
    // Cấp chất lượng
    [['TOT', 'Tốt'], ['KHA', 'Khá'], ['TRUNG_BINH', 'Trung bình'], ['KEM', 'Kém']].forEach(([c, n], i) => add('quality-grade', c, n, { sortOrder: i }));
    // Nguyên nhân hư hỏng
    [['THIEN-TAI', 'Thiên tai'], ['XUONG-CAP', 'Xuống cấp tự nhiên'], ['SU-CO', 'Sự cố kỹ thuật'], ['TAC-DONG', 'Tác động bên ngoài']].forEach(([c, n], i) => add('damage-cause', c, n, { sortOrder: i }));
    // Loại kho
    [['KHO-TONG', 'Kho tổng hợp'], ['KHO-LUONG', 'Kho lương thực'], ['KHO-NHIEN', 'Kho nhiên liệu'], ['KHO-KT', 'Kho kỹ thuật']].forEach(([c, n], i) => add('storage-location-type', c, n, { sortOrder: i }));
    await catalogRepo.save(cats.map((c) => catalogRepo.create(c)));
    console.log(`  + Danh mục: ${cats.length} mục`);
  }

  // 5) Vật chất (danh mục vật chất — phát hành sẵn)
  if ((await materialRepo.count()) === 0) {
    const matDefs: Array<[string, string, string, string]> = [
      ['VC-GAO', 'Gạo tẻ', 'LUONG-THUC', 'KG'], ['VC-MUOI', 'Muối i-ốt', 'LUONG-THUC', 'KG'],
      ['VC-DUONG', 'Đường kính', 'LUONG-THUC', 'KG'], ['VC-DAU-AN', 'Dầu ăn', 'LUONG-THUC', 'LIT'],
      ['VC-DO-HOP', 'Đồ hộp', 'LUONG-THUC', 'CAI'], ['VC-XANG', 'Xăng A95', 'NHIEN-LIEU', 'LIT'],
      ['VC-DAU-DO', 'Dầu diesel', 'NHIEN-LIEU', 'LIT'], ['VC-DAU-NHON', 'Dầu nhờn', 'NHIEN-LIEU', 'LIT'],
      ['VC-QUAN-AO', 'Quân phục dã chiến', 'QUAN-TRANG', 'BO'], ['VC-GIAY', 'Giày vải', 'QUAN-TRANG', 'CAI'],
      ['VC-MU', 'Mũ cứng', 'QUAN-TRANG', 'CAI'], ['VC-CHAN', 'Chăn bông', 'QUAN-TRANG', 'CAI'],
      ['VC-XI-MANG', 'Xi măng PC40', 'VAT-LIEU-XD', 'TAN'], ['VC-THEP', 'Thép xây dựng', 'VAT-LIEU-XD', 'TAN'],
      ['VC-GACH', 'Gạch nung', 'VAT-LIEU-XD', 'VIEN'], ['VC-CAT', 'Cát vàng', 'VAT-LIEU-XD', 'M3'],
      ['VC-BONG', 'Bông băng y tế', 'Y-TE', 'THUNG'], ['VC-THUOC', 'Thuốc thiết yếu', 'Y-TE', 'THUNG'],
      ['VC-MAY-PHAT', 'Máy phát điện', 'DUNG-CU', 'CAI'], ['VC-DAY-DIEN', 'Dây điện', 'DIEN-NUOC', 'M'],
    ];
    await materialRepo.save(
      matDefs.map(([code, name, cat, unit]) =>
        materialRepo.create({ code, name, categoryCode: cat, unitCode: unit, qualityGrade: 'TOT', status: 'PUBLISHED', createdBy: authorId, updatedBy: authorId }),
      ),
    );
    console.log(`  + Vật chất: ${matDefs.length} mã`);
  }

  // 6) 30 doanh trại + ~180 công trình
  if ((await barracksRepo.count()) < 30) {
    const workflowMix: WorkflowStatus[] = [
      ...Array(16).fill(WorkflowStatus.APPROVED),
      ...Array(6).fill(WorkflowStatus.PENDING_REVIEW),
      ...Array(5).fill(WorkflowStatus.DRAFT),
      ...Array(3).fill(WorkflowStatus.CHANGES_REQUESTED),
    ];
    const facTypes = ['NHA-O', 'NHA-AN', 'KHO', 'NHA-LV', 'SAN', 'HANG-RAO', 'HA-TANG-KT'];
    const grades = ['TOT', 'TOT', 'KHA', 'KHA', 'TRUNG_BINH', 'KEM'];
    let facTotal = 0;
    for (let i = 0; i < 30; i++) {
      const code = `DT-${String(i + 1).padStart(3, '0')}`;
      if (await barracksRepo.findOne({ where: { code } })) continue;
      const area = pick(areas);
      const org = await orgRepo.findOne({ where: { code: `DV-${area.code}` } });
      const lng = BASE.lng + between(-0.35, 0.35);
      const lat = BASE.lat + between(-0.3, 0.3);
      const b = await barracksRepo.save(
        barracksRepo.create({
          code,
          name: `Doanh trại ${area.name.split(' ')[1]}-${String(i + 1).padStart(2, '0')} (giả lập)`,
          areaId: area.id,
          organizationId: org?.id ?? province.id,
          declaredCapacity: Math.round(between(80, 600)),
          landArea: between(3000, 40000).toFixed(2),
          address: `Khu vực ${Math.ceil(rnd() * 9)}, ${area.name}`,
          function: pick(['Đơn vị bộ binh', 'Đơn vị kỹ thuật', 'Kho hậu cần', 'Cơ quan chỉ huy']),
          workflowStatus: workflowMix[i % workflowMix.length],
          location: point(lng, lat),
          createdBy: authorId,
          updatedBy: authorId,
        }),
      );
      // 4–8 công trình
      const nFac = Math.round(between(4, 8));
      const facs: Facility[] = [];
      for (let j = 0; j < nFac; j++) {
        facs.push(
          facilityRepo.create({
            barracksId: b.id,
            code: `CT-${String(j + 1).padStart(2, '0')}`,
            name: `${pick(['Nhà', 'Kho', 'Khu', 'Dãy'])} ${String.fromCharCode(65 + j)}`,
            type: pick(facTypes),
            area: between(60, 1200).toFixed(2),
            declaredCapacity: Math.round(between(0, 120)),
            buildYear: Math.round(between(1985, 2022)),
            condition: pick(grades),
            status: rnd() < 0.06 ? FacilityStatus.DECOMMISSIONED : FacilityStatus.IN_USE,
            location: point(lng + between(-0.004, 0.004), lat + between(-0.004, 0.004)),
            createdBy: authorId,
            updatedBy: authorId,
          }),
        );
      }
      await facilityRepo.save(facs);
      facTotal += facs.length;
    }
    console.log(`  + Doanh trại: 30 · Công trình: ${facTotal}`);
  }

  // 7) Kho + số dư tồn (M06) — đủ dòng để màn tồn kho có nội dung, có chênh lệch kiểm kê
  const locationRepo = dataSource.getRepository(StorageLocation);
  const balanceRepo = dataSource.getRepository(StockBalance);
  if ((await locationRepo.count()) === 0) {
    const mats = await materialRepo.find();
    const locTypes = ['KHO-TONG', 'KHO-LUONG', 'KHO-NHIEN', 'KHO-KT'];
    const locs: StorageLocation[] = [];
    for (let i = 0; i < 12; i++) {
      locs.push(
        await locationRepo.save(
          locationRepo.create({
            code: `KHO-${String(i + 1).padStart(3, '0')}`,
            name: `Kho ${pick(['Hậu cần', 'Kỹ thuật', 'Dự trữ', 'Trung tâm'])} ${i + 1} (giả lập)`,
            type: pick(locTypes),
            status: 'ACTIVE',
            createdBy: authorId,
          }),
        ),
      );
    }
    let balCount = 0;
    for (const loc of locs) {
      // mỗi kho giữ 12–18 mã vật chất
      const shuffled = [...mats].sort(() => rnd() - 0.5).slice(0, Math.round(between(12, 18)));
      for (const mat of shuffled) {
        const onHand = between(50, 5000);
        // ~30% có kiểm kê gần nhất tạo chênh lệch
        const counted = rnd() < 0.3 ? onHand + between(-80, 80) : null;
        await balanceRepo.save(
          balanceRepo.create({
            materialId: mat.id,
            storageLocationId: loc.id,
            onHand: onHand.toFixed(3),
            lastCounted: counted !== null ? counted.toFixed(3) : null,
          }),
        );
        balCount++;
      }
    }
    console.log(`  + Kho: ${locs.length} · Dòng tồn kho: ${balCount}`);
  }

  await dataSource.destroy();
  console.log('\n  Seed hoàn tất. Đăng nhập demo: admin / admin@123 (chỉ DEV).');
}

run().catch((err) => {
  console.error('Seed lỗi:', err);
  process.exit(1);
});
