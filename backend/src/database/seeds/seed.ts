// Seed dữ liệu DEMO để mọi màn hình có nội dung (KHÔNG dùng ở PROD).
// Doanh trại/công trình/kho/POI đặt quanh ĐỊA BÀN THẬT đã nạp (seed:geojson/seed:real) nếu có;
// nếu chưa có địa bàn thật thì tạo bộ DEMO tối thiểu (rõ ràng là demo, source='DEMO').
// Chọn tỉnh nghiệp vụ demo qua env DEMO_PROVINCE_CODE. Dọn sạch các tên "(giả lập)" cũ.
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
import { MapPoi } from '../../modules/gis/entities/map-poi.entity';
import { StorageLocation } from '../../modules/inventory/entities/storage-location.entity';
import { StockBalance } from '../../modules/inventory/entities/stock-balance.entity';
import { InspectionCampaign } from '../../modules/inspection/entities/inspection-campaign.entity';
import { Alert } from '../../modules/alerts/alert.entity';
import { InspectionStatus, AlertStatus } from '../../common/workflow';
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

  // 1) Đơn vị cấp tỉnh — đặt tên theo tỉnh demo nếu có DEMO_PROVINCE_CODE (địa bàn thật đã nạp).
  const demoProvinceCode = process.env.DEMO_PROVINCE_CODE || null;
  const demoProvinceArea = demoProvinceCode
    ? await areaRepo.findOne({ where: { code: demoProvinceCode, level: 'PROVINCE' } })
    : null;
  const provinceOrgName = demoProvinceArea
    ? `Bộ CHQS tỉnh ${demoProvinceArea.name.replace(/^(Tỉnh|Thành phố)\s+/i, '')} (demo)`
    : 'Bộ CHQS tỉnh (giả lập)';
  let province = await orgRepo.findOne({ where: { code: 'TINH-GL' } });
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({ code: 'TINH-GL', name: provinceOrgName, type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log('  + Đơn vị cấp tỉnh:', province.code, '-', provinceOrgName);
  } else if (province.name !== provinceOrgName) {
    province.name = provinceOrgName;
    await orgRepo.save(province);
    console.log('  = Cập nhật tên đơn vị tỉnh →', provinceOrgName);
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

  // 3) Địa bàn dùng cho dữ liệu demo.
  // 3a) DỌN các tên GIẢ LẬP cũ (nếu có) để không còn "tên sai" trên bản đồ/danh sách.
  await dataSource.query(
    `DELETE FROM administrative_areas WHERE name LIKE '%giả lập%' OR code LIKE 'XA-A%' OR code LIKE 'PHUONG-P%' OR code = 'DACKHU-DK01'`,
  );
  await dataSource.query(
    `DELETE FROM organizations WHERE code LIKE 'DV-XA-A%' OR code LIKE 'DV-PHUONG-P%' OR code = 'DV-DACKHU-DK01' OR name LIKE '%giả lập%'`,
  );

  // 3b) Ưu tiên ĐỊA BÀN THẬT đã nạp (seed:geojson/seed:real). Chọn tỉnh demo qua DEMO_PROVINCE_CODE.
  const DEMO_PROVINCE_CODE = process.env.DEMO_PROVINCE_CODE || null;
  let areas: AdministrativeArea[] = await areaRepo.find({
    where: { level: 'COMMUNE', ...(DEMO_PROVINCE_CODE ? { provinceCode: DEMO_PROVINCE_CODE } : {}) },
    take: 24,
  });
  if (areas.length === 0 && DEMO_PROVINCE_CODE) {
    areas = await areaRepo.find({ where: { level: 'COMMUNE' }, take: 24 }); // fallback: bất kỳ xã thật nào
  }

  // 3c) Chưa có địa bàn thật → tạo bộ DEMO tối thiểu (rõ ràng là demo, source='DEMO').
  let demoMode = false;
  if (areas.length === 0) {
    demoMode = true;
    const demoAreaDefs = [
      ...Array.from({ length: 6 }, (_, i) => ({ code: `XA-DEMO-${String(i + 1).padStart(2, '0')}`, name: `Xã Demo ${i + 1}`, type: 'COMMUNE' })),
      ...Array.from({ length: 2 }, (_, i) => ({ code: `PHUONG-DEMO-${String(i + 1).padStart(2, '0')}`, name: `Phường Demo ${i + 1}`, type: 'WARD' })),
    ];
    for (const a of demoAreaDefs) {
      let area = await areaRepo.findOne({ where: { code: a.code } });
      if (!area) {
        area = await areaRepo.save(
          areaRepo.create({ ...a, level: 'COMMUNE', provinceCode: 'TINH-DEMO', parentCode: 'TINH-DEMO', source: 'DEMO', status: 'ACTIVE' }),
        );
      }
      areas.push(area);
    }
  }

  // 3d) Đơn vị Ban CHQS cho mỗi địa bàn demo (idempotent) — để gắn phạm vi dữ liệu người dùng xã.
  for (const area of areas) {
    const orgCode = `DV-${area.code}`;
    if (!(await orgRepo.findOne({ where: { code: orgCode } }))) {
      await orgRepo.save(orgRepo.create({ code: orgCode, name: `Ban CHQS ${area.name}`, type: 'COMMUNE', parentId: province.id, status: 'ACTIVE' }));
    }
  }
  console.log(`  + Địa bàn cho demo: ${areas.length}${demoMode ? ' (bộ DEMO)' : ' (địa bàn thật)'}`);

  // 3e) Toạ độ tâm mỗi địa bàn (từ centroid ranh giới thật nếu có) để đặt doanh trại/kho/POI đúng chỗ.
  const areaCoord = new Map<string, { lng: number; lat: number }>();
  for (const area of areas) {
    // Ưu tiên centroid xã; nếu chưa có ranh giới xã, lùi về centroid tỉnh; cuối cùng mới về tâm giả lập.
    const r = await dataSource.query(
      `SELECT ST_X(COALESCE(a.centroid, ST_PointOnSurface(prov.geometry))) AS lng,
              ST_Y(COALESCE(a.centroid, ST_PointOnSurface(prov.geometry))) AS lat
       FROM administrative_areas a
       LEFT JOIN administrative_areas prov ON prov.code = a.province_code AND prov.level = 'PROVINCE'
       WHERE a.id = $1`,
      [area.id],
    );
    const lng = r[0]?.lng != null ? Number(r[0].lng) : BASE.lng + between(-0.3, 0.3);
    const lat = r[0]?.lat != null ? Number(r[0].lat) : BASE.lat + between(-0.25, 0.25);
    areaCoord.set(area.id, { lng, lat });
  }

  // Gắn phạm vi dữ liệu cho tài khoản cấp xã xa01 → địa bàn đầu tiên.
  const xa01 = await userRepo.findOne({ where: { username: 'xa01' } });
  const firstArea = areas[0];
  const orgFirst = firstArea ? await orgRepo.findOne({ where: { code: `DV-${firstArea.code}` } }) : null;
  if (xa01 && firstArea && orgFirst) {
    xa01.organizationId = orgFirst.id;
    xa01.dataScopes = [{ type: 'AREA', refId: firstArea.id }];
    await userRepo.save(xa01);
    console.log(`  + Phạm vi dữ liệu xa01 → ${firstArea.name}`);
  }

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
      const c = areaCoord.get(area.id) ?? BASE;
      const lng = c.lng + between(-0.02, 0.02);
      const lat = c.lat + between(-0.02, 0.02);
      const b = await barracksRepo.save(
        barracksRepo.create({
          code,
          name: `Doanh trại ${String(i + 1).padStart(2, '0')} - ${area.name}`,
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
      const c = areaCoord.get(pick(areas).id) ?? BASE;
      locs.push(
        await locationRepo.save(
          locationRepo.create({
            code: `KHO-${String(i + 1).padStart(3, '0')}`,
            name: `Kho ${pick(['Hậu cần', 'Kỹ thuật', 'Dự trữ', 'Trung tâm'])} ${i + 1}`,
            type: pick(locTypes),
            location: point(c.lng + between(-0.02, 0.02), c.lat + between(-0.02, 0.02)),
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

  // 7b) Điểm quan tâm (POI): trạm/địa danh/sở chỉ huy — để lớp POI trên bản đồ có nội dung.
  const poiRepo = dataSource.getRepository(MapPoi);
  if ((await poiRepo.count()) === 0 && areas.length) {
    const poiDefs: Array<{ code: string; name: string; category: string }> = [
      { code: 'SCH-TINH', name: 'Sở chỉ huy Bộ CHQS tỉnh', category: 'SO_CHI_HUY' },
      { code: 'TRAM-01', name: 'Trạm kiểm soát quân sự số 1', category: 'TRAM' },
      { code: 'TRAM-02', name: 'Trạm quân y khu vực', category: 'TRAM' },
      { code: 'TRAM-03', name: 'Trạm xăng dầu hậu cần', category: 'TRAM' },
      { code: 'DD-01', name: 'Kho K80', category: 'DIA_DANH' },
      { code: 'DD-02', name: 'Thao trường huấn luyện', category: 'DIA_DANH' },
    ];
    for (const d of poiDefs) {
      const area = pick(areas);
      const c = areaCoord.get(area.id) ?? BASE;
      await poiRepo.save(
        poiRepo.create({
          code: d.code,
          name: d.name,
          category: d.category,
          areaId: area.id,
          provinceCode: area.provinceCode ?? null,
          location: point(c.lng + between(-0.03, 0.03), c.lat + between(-0.03, 0.03)),
          source: 'seed',
          status: 'ACTIVE',
          createdBy: authorId,
        }),
      );
    }
    console.log(`  + POI (trạm/địa danh): ${poiDefs.length}`);
  }

  // 8) Đợt kiểm kê mẫu (đã phát hành OPEN) để dựng phiếu kiểm kê
  const campaignRepo = dataSource.getRepository(InspectionCampaign);
  if ((await campaignRepo.count()) === 0) {
    await campaignRepo.save(
      campaignRepo.create({
        code: 'KK-2026-Q1',
        name: 'Kiểm kê định kỳ Quý I/2026 (giả lập)',
        scope: { note: 'Toàn tỉnh — dữ liệu giả lập' },
        status: InspectionStatus.OPEN,
        plannedFrom: new Date('2026-01-05'),
        plannedTo: new Date('2026-03-31'),
        createdBy: authorId,
        updatedBy: authorId,
      }),
    );
    console.log('  + Đợt kiểm kê: KK-2026-Q1 (OPEN)');
  }

  // 9) Cảnh báo (M13) — sinh từ dữ liệu để trung tâm cảnh báo có nội dung (~25 mục)
  const alertRepo = dataSource.getRepository(Alert);
  if ((await alertRepo.count()) === 0) {
    const alerts: Array<Partial<Alert>> = [];
    const poor = await dataSource.query(
      `SELECT f.id, f.name, b.name AS barracks FROM facilities f JOIN barracks b ON b.id=f.barracks_id
       WHERE f.condition='KEM' AND f.status='IN_USE' LIMIT 12`,
    );
    for (const r of poor) alerts.push({ alertType: 'FACILITY_POOR', severity: 'HIGH', title: `Công trình chất lượng kém: ${r.name}`, description: `Thuộc ${r.barracks}`, entityType: 'facility', entityId: r.id, status: AlertStatus.OPEN });
    const pending = await dataSource.query(`SELECT id, name FROM barracks WHERE workflow_status='PENDING_REVIEW' LIMIT 8`);
    for (const r of pending) alerts.push({ alertType: 'BARRACKS_PENDING', severity: 'MEDIUM', title: `Hồ sơ chờ duyệt: ${r.name}`, entityType: 'barracks', entityId: r.id, status: AlertStatus.OPEN });
    const variance = await dataSource.query(
      `SELECT sb.id, m.name FROM stock_balances sb JOIN materials m ON m.id=sb.material_id
       WHERE sb.last_counted IS NOT NULL AND ABS(sb.last_counted - sb.on_hand) > 40 LIMIT 10`,
    );
    for (const r of variance) alerts.push({ alertType: 'INVENTORY_VARIANCE', severity: 'MEDIUM', title: `Chênh lệch kiểm kê lớn: ${r.name}`, entityType: 'stock_balance', entityId: r.id, status: AlertStatus.OPEN });
    if (alerts.length) {
      await alertRepo.save(alerts.map((a) => alertRepo.create(a)));
      console.log(`  + Cảnh báo: ${alerts.length} mục`);
    }
  }

  await dataSource.destroy();
  console.log('\n  Seed hoàn tất. Đăng nhập demo: admin / admin@123 (chỉ DEV).');
}

run().catch((err) => {
  console.error('Seed lỗi:', err);
  process.exit(1);
});
