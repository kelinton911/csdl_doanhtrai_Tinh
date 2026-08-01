// Seed M18/M19 — Địa điểm sơ tán/phân tán/dự bị + nhiệm vụ khắc phục trên nền địa bàn THẬT (Thanh Hóa).
import 'reflect-metadata';
import dataSource from '../data-source';
import { DeploymentSite } from '../../modules/readiness/entities/deployment-site.entity';
import { RecoveryTask } from '../../modules/readiness/entities/recovery-task.entity';

let s = 20260841;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const TH = { lng: 105.7772, lat: 19.8069 };

async function run() {
  await dataSource.initialize();
  const sites = dataSource.getRepository(DeploymentSite);
  const rec = dataSource.getRepository(RecoveryTask);

  const areas: Array<{ id: string; name: string }> = await dataSource.query(`SELECT id, name FROM administrative_areas WHERE level='COMMUNE' ORDER BY code LIMIT 10`);
  const barracks: Array<{ id: string; name: string; area_id: string | null; loc: string | null }> = await dataSource.query(`SELECT id, name, area_id, ST_AsGeoJSON(location) AS loc FROM barracks ORDER BY code LIMIT 8`);

  const SITE_DEFS = [
    { type: 'EVACUATION', name: 'Khu sơ tán', cap: [200, 600] },
    { type: 'DISPERSAL', name: 'Khu phân tán lực lượng', cap: [100, 300] },
    { type: 'RESERVE', name: 'Địa điểm dự bị', cap: [150, 400] },
    { type: 'DEPLOYMENT', name: 'Vị trí bố trí lực lượng', cap: [100, 500] },
    { type: 'FIELD_MEDICAL', name: 'Trạm quân y dã chiến', cap: [50, 150] },
    { type: 'COMMAND_POST', name: 'Sở chỉ huy dự bị', cap: [30, 80] },
  ];
  let cs = 0, cr = 0, skipped = 0;
  for (let i = 0; i < 12; i++) {
    const code = `ST-${String(i + 1).padStart(3, '0')}`;
    if (await sites.findOne({ where: { code } })) { skipped++; continue; }
    const def = SITE_DEFS[i % SITE_DEFS.length];
    const area = areas.length ? pick(areas) : null;
    const center = { lng: TH.lng + (rnd() - 0.5) * 0.4, lat: TH.lat + (rnd() - 0.5) * 0.4 };
    await sites.save(sites.create({
      code, name: `${def.name} ${area ? area.name : 'Thanh Hóa'}`, siteType: def.type, areaId: area?.id ?? null,
      address: `Địa bàn ${area ? area.name : 'tỉnh Thanh Hóa'}`, location: point(center.lng, center.lat),
      capacity: Math.round(def.cap[0] + rnd() * (def.cap[1] - def.cap[0])),
      concealment: pick(['GOOD', 'GOOD', 'FAIR', 'POOR']), accessRoad: pick(['Đường mòn', 'Đường cấp phối', 'Đường bê tông']),
      hasPower: rnd() > 0.5, hasWater: rnd() > 0.4, tentCapability: Math.round(5 + rnd() * 40),
      deployTimeHours: (2 + Math.floor(rnd() * 24)).toString(),
      readiness: pick(['READY', 'READY', 'PARTIAL', 'NOT_READY']), role: pick(['PRIMARY', 'PRIMARY', 'BACKUP', 'ALTERNATE']),
      defenseState: pick(['SSCD', 'EVACUATION', 'COMBAT']), notes: 'Dữ liệu mẫu (seed) — cần đối chiếu phương án tác chiến.',
      status: 'ACTIVE', createdBy: null, updatedBy: null,
    }));
    cs++;
  }

  const REC_DEFS = [
    { title: 'Khắc phục nhà kho tốc mái do bão', sev: 'MODERATE', danger: false, scen: false, status: 'IN_PROGRESS' },
    { title: 'Sập tường rào doanh trại sau lũ', sev: 'HEAVY', danger: true, scen: false, status: 'COORDINATING' },
    { title: 'Hư hỏng hệ thống điện toàn khu', sev: 'HEAVY', danger: false, scen: false, status: 'ASSESSING' },
    { title: 'Khắc phục hư hỏng nhẹ nhà ăn', sev: 'LIGHT', danger: false, scen: false, status: 'RECOVERED' },
    { title: '[Mô phỏng] Công trình bị phá hủy do tập kích', sev: 'DESTROYED', danger: true, scen: true, status: 'ASSESSING' },
    { title: '[Mô phỏng] Khu vực nguy hiểm cần rà phá', sev: 'HEAVY', danger: true, scen: true, status: 'COORDINATING' },
  ];
  for (let i = 0; i < REC_DEFS.length; i++) {
    const code = `KP-${String(i + 1).padStart(3, '0')}`;
    if (await rec.findOne({ where: { code } })) { skipped++; continue; }
    const def = REC_DEFS[i];
    const b = barracks[i % Math.max(barracks.length, 1)] ?? null;
    const loc = b?.loc ? JSON.parse(b.loc) : point(TH.lng, TH.lat);
    await rec.save(rec.create({
      code, title: def.title, severity: def.sev, dangerZone: def.danger,
      barracksId: b?.id ?? null, areaId: b?.area_id ?? null, location: loc,
      description: 'Dữ liệu mẫu (seed).',
      neededMaterials: pick(['Tôn, xà gồ, xi măng', 'Dây điện, thiết bị đóng cắt', 'Gạch, cát, sắt thép']),
      neededForces: pick(['1 trung đội công binh', '1 tiểu đội kỹ thuật', 'Lực lượng dân quân tại chỗ']),
      estimatedLoss: Math.round(50_000_000 + rnd() * 900_000_000).toString(),
      status: def.status, scenario: def.scen, occurredAt: new Date(Date.now() - (2 + i) * 86400000),
      resolvedAt: def.status === 'RECOVERED' ? new Date(Date.now() - 86400000) : null,
      createdBy: null, updatedBy: null,
    }));
    cr++;
  }

  console.log(`M18/M19 seed sẵn sàng: +${cs} địa điểm, +${cr} nhiệm vụ khắc phục (bỏ qua ${skipped}).`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
