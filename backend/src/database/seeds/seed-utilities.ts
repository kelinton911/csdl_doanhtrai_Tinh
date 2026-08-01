// Seed M11 — Điện/Nước/Năng lượng trên nền doanh trại THẬT của tỉnh (Thanh Hóa):
// mỗi doanh trại có trạm biến áp + máy phát dự phòng + bể nước; kèm chỉ số tiêu thụ 3 kỳ.
// Thêm vài hệ thống hỏng/quá hạn bảo dưỡng để kích hoạt cảnh báo. Idempotent theo mã.
import 'reflect-metadata';
import dataSource from '../data-source';
import { UtilitySystem } from '../../modules/utilities/entities/utility-system.entity';
import { UtilityReading } from '../../modules/utilities/entities/utility-reading.entity';

let s = 20260811;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

async function run() {
  await dataSource.initialize();
  const sys = dataSource.getRepository(UtilitySystem);
  const readRepo = dataSource.getRepository(UtilityReading);

  const barracks: Array<{ id: string; code: string; name: string; area_id: string | null; organization_id: string | null; loc: string | null }> =
    await dataSource.query(`SELECT id, code, name, area_id, organization_id, ST_AsGeoJSON(location) AS loc FROM barracks ORDER BY code`);

  let created = 0, skipped = 0, readings = 0;

  const addReadings = async (systemId: string, startIndex: number, step: number, unitCost: number) => {
    const dates = ['2026-05-01', '2026-06-01', '2026-07-01'];
    let idx = startIndex;
    let prev: number | null = null;
    for (const d of dates) {
      const exists = await readRepo.findOne({ where: { utilitySystemId: systemId, readingDate: d } });
      if (!exists) {
        const consumption = prev == null ? null : idx - prev;
        await readRepo.save(readRepo.create({
          utilitySystemId: systemId,
          readingDate: d,
          indexValue: idx.toString(),
          consumption: consumption != null ? consumption.toString() : null,
          cost: consumption != null ? Math.round(consumption * unitCost).toString() : null,
          note: null,
          createdBy: null,
        }));
        readings++;
      }
      prev = idx;
      idx += step;
    }
  };

  const mk = async (
    code: string, name: string, kind: string, category: string,
    b: { id: string; area_id: string | null; organization_id: string | null; loc: string | null } | null,
    extra: Partial<UtilitySystem>,
  ) => {
    if (await sys.findOne({ where: { code } })) { skipped++; return null; }
    const loc = b?.loc ? JSON.parse(b.loc) : null;
    const created1 = await sys.save(sys.create({
      code, name, kind, category,
      barracksId: b?.id ?? null,
      areaId: b?.area_id ?? null,
      organizationId: b?.organization_id ?? null,
      location: loc,
      status: 'OPERATIONAL',
      ...extra,
    }));
    created++;
    return created1;
  };

  for (const b of barracks) {
    // Trạm biến áp
    const tba = await mk(`HT-TBA-${b.code}`, `Trạm biến áp ${b.name}`, 'TRANSFORMER', 'ELECTRICITY', b, {
      capacity: pick(['180', '250', '320', '400']), capacityUnit: 'kVA', meterNo: `CT-${b.code}-E1`, autonomyHours: '0',
    });
    if (tba) await addReadings(tba.id, 12000 + Math.floor(rnd() * 4000), 280 + Math.floor(rnd() * 300), 3200);

    // Máy phát điện dự phòng (có lịch bảo dưỡng + nhiên liệu)
    await mk(`HT-MPD-${b.code}`, `Máy phát điện dự phòng ${b.name}`, 'GENERATOR', 'ELECTRICITY', b, {
      capacity: pick(['100', '150', '200']), capacityUnit: 'kW',
      fuelType: 'DIESEL', fuelLevel: (400 + Math.floor(rnd() * 600)).toString(),
      autonomyHours: (24 + Math.floor(rnd() * 48)).toString(),
      status: pick(['OPERATIONAL', 'STANDBY', 'STANDBY']),
      lastMaintenanceAt: daysFromNow(-(30 + Math.floor(rnd() * 120))),
      nextMaintenanceAt: daysFromNow(15 + Math.floor(rnd() * 120)),
    });

    // Bể/nguồn nước
    const nuoc = await mk(`HT-NUOC-${b.code}`, `Bể chứa & cấp nước ${b.name}`, 'WATER_TANK', 'WATER', b, {
      capacity: pick(['200', '350', '500']), capacityUnit: 'm3',
      reserveVolume: pick(['150', '300', '450']), reserveUnit: 'm3',
      meterNo: `DH-${b.code}-W1`, autonomyHours: (48 + Math.floor(rnd() * 72)).toString(),
    });
    if (nuoc) await addReadings(nuoc.id, 3000 + Math.floor(rnd() * 1500), 90 + Math.floor(rnd() * 120), 11000);
  }

  // Vài hệ thống độc lập: hỏng + quá hạn bảo dưỡng (kích hoạt cảnh báo M11).
  const first = barracks[0] ?? null;
  await mk('HT-MPD-FAULT', 'Máy phát điện trạm chỉ huy (đang hỏng)', 'GENERATOR', 'ELECTRICITY', first, {
    capacity: '150', capacityUnit: 'kW', fuelType: 'DIESEL', fuelLevel: '120', autonomyHours: '0',
    status: 'FAULT', notes: 'Hỏng bộ điều tốc — chờ sửa chữa (dữ liệu mẫu).',
  });
  await mk('HT-GIENG-OVERDUE', 'Giếng khoan dự phòng (quá hạn bảo dưỡng)', 'WELL', 'WATER', first, {
    capacity: '20', capacityUnit: 'm3/h', autonomyHours: '0', status: 'OPERATIONAL',
    lastMaintenanceAt: daysFromNow(-400), nextMaintenanceAt: daysFromNow(-30),
    notes: 'Cần súc rửa, kiểm tra bơm (dữ liệu mẫu).',
  });

  console.log(`M11 seed hạ tầng KT: +${created} hệ thống (bỏ qua ${skipped}), +${readings} kỳ chỉ số.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
