// Seed M04 — Hồ sơ khu đất quốc phòng trên nền dữ liệu THẬT của tỉnh (Thanh Hóa):
// mỗi doanh trại đã có sinh 1 khu đất tương ứng (dùng lại area/đơn vị/toạ độ thật), kèm
// một số khu đất độc lập (trống/quy hoạch/tranh chấp/lấn chiếm) để đủ nghiệp vụ + cảnh báo.
// Idempotent theo mã khu đất. Ghi chú rõ "dữ liệu mẫu — cần đối chiếu hồ sơ gốc".
import 'reflect-metadata';
import dataSource from '../data-source';
import { LandParcel } from '../../modules/land-parcels/entities/land-parcel.entity';
import { LandParcelMarker } from '../../modules/land-parcels/entities/land-parcel-marker.entity';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { WorkflowStatus } from '../../common/workflow';

let s = 20260801;
const rnd = () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const SEED_NOTE = 'Dữ liệu mẫu (seed) — cần đối chiếu hồ sơ đất gốc trước khi sử dụng chính thức.';
// Trung tâm TP Thanh Hóa (thật) cho các khu đất độc lập không gắn doanh trại.
const TH_CENTER = { lng: 105.7772, lat: 19.8069 };

async function run() {
  await dataSource.initialize();
  const parcels = dataSource.getRepository(LandParcel);
  const markers = dataSource.getRepository(LandParcelMarker);
  const areaRepo = dataSource.getRepository(AdministrativeArea);
  const orgRepo = dataSource.getRepository(Organization);

  const province = await orgRepo.findOne({ where: { code: 'TINH-GL' } });
  const orgId = province?.id ?? null;

  // 1) Khu đất theo TỪNG DOANH TRẠI thật (dùng lại toạ độ/area/đơn vị).
  const barracks: Array<{
    id: string; code: string; name: string; area_id: string | null;
    organization_id: string | null; address: string | null; land_area: string; loc: string | null;
  }> = await dataSource.query(
    `SELECT id, code, name, area_id, organization_id, address, land_area,
            ST_AsGeoJSON(location) AS loc FROM barracks ORDER BY code`,
  );

  let created = 0;
  let skipped = 0;
  let markerCount = 0;

  const addMarkers = async (parcelId: string, center: { lng: number; lat: number } | null, n: number) => {
    for (let i = 1; i <= n; i++) {
      const code = `M-${String(i).padStart(2, '0')}`;
      const exists = await markers.findOne({ where: { landParcelId: parcelId, code } });
      if (exists) continue;
      const loc = center ? point(center.lng + (rnd() - 0.5) * 0.004, center.lat + (rnd() - 0.5) * 0.004) : null;
      await markers.save(markers.create({ landParcelId: parcelId, code, location: loc, note: `Mốc giới ${code}`, createdBy: null }));
      markerCount++;
    }
  };

  for (const b of barracks) {
    const code = `KD-${b.code}`;
    if (await parcels.findOne({ where: { code } })) { skipped++; continue; }
    const loc = b.loc ? JSON.parse(b.loc) : null;
    const center = loc?.coordinates ? { lng: loc.coordinates[0], lat: loc.coordinates[1] } : null;
    const baseArea = Number(b.land_area) || 0;
    const parcel = await parcels.save(
      parcels.create({
        code,
        name: `Khu đất ${b.name}`,
        organizationId: b.organization_id ?? orgId,
        areaId: b.area_id,
        barracksId: b.id,
        address: b.address,
        landArea: (baseArea > 0 ? baseArea : Math.round(8000 + rnd() * 20000)).toString(),
        landUseType: 'QUOC_PHONG',
        usageStatus: 'IN_USE',
        legalStatus: pick(['CERTIFICATE', 'CERTIFICATE', 'DECISION', 'PENDING']),
        legalOrigin: 'Bàn giao/quản lý theo phân cấp Bộ Quốc phòng',
        certificateNo: `GCNQSDĐ-QP/${1990 + Math.floor(rnd() * 30)}/${100 + Math.floor(rnd() * 800)}`,
        disputeStatus: 'NONE',
        accessRoad: pick(['Đường nhựa nội bộ', 'Đường bê tông liên xã', 'Đường cấp phối']),
        hasElectricity: true,
        hasWater: rnd() > 0.2,
        expansionCapability: pick(['NONE', 'LIMITED', 'GOOD']),
        safetyStatus: 'SAFE',
        location: loc,
        notes: SEED_NOTE,
        workflowStatus: WorkflowStatus.APPROVED,
        createdBy: null,
        updatedBy: null,
      }),
    );
    await addMarkers(parcel.id, center, 4);
    created++;
  }

  // 2) Khu đất ĐỘC LẬP (kho/trạm, dự bị, tranh chấp) quanh trung tâm tỉnh thật.
  const areas = await areaRepo.find({ where: { level: 'COMMUNE' }, take: 6 });
  const areaFor = (i: number) => areas[i % Math.max(areas.length, 1)]?.id ?? null;
  const standalone: Array<Partial<LandParcel> & { markers: number }> = [
    { code: 'KD-DL-01', name: 'Khu đất dự bị Bắc TP Thanh Hóa', usageStatus: 'RESERVE', legalStatus: 'DECISION', disputeStatus: 'NONE', expansionCapability: 'GOOD', workflowStatus: WorkflowStatus.APPROVED, markers: 3 },
    { code: 'KD-DL-02', name: 'Khu đất quy hoạch kho kỹ thuật', usageStatus: 'PLANNED', legalStatus: 'PENDING', disputeStatus: 'NONE', expansionCapability: 'GOOD', workflowStatus: WorkflowStatus.PENDING_REVIEW, markers: 2 },
    { code: 'KD-DL-03', name: 'Khu đất trống ven đô (có tranh chấp ranh giới)', usageStatus: 'VACANT', legalStatus: 'PENDING', disputeStatus: 'DISPUTED', expansionCapability: 'LIMITED', workflowStatus: WorkflowStatus.APPROVED, markers: 2 },
    { code: 'KD-DL-04', name: 'Khu đất bị lấn chiếm phía Nam', usageStatus: 'IN_USE', legalStatus: 'CERTIFICATE', disputeStatus: 'ENCROACHED', expansionCapability: 'NONE', workflowStatus: WorkflowStatus.APPROVED, markers: 3 },
    { code: 'KD-DL-05', name: 'Khu đất trạm nguồn nước dự phòng', usageStatus: 'IN_USE', legalStatus: 'DECISION', disputeStatus: 'NONE', expansionCapability: 'LIMITED', workflowStatus: WorkflowStatus.DRAFT, markers: 0 },
  ];
  for (let i = 0; i < standalone.length; i++) {
    const sp = standalone[i];
    if (await parcels.findOne({ where: { code: sp.code! } })) { skipped++; continue; }
    const center = { lng: TH_CENTER.lng + (rnd() - 0.5) * 0.08, lat: TH_CENTER.lat + (rnd() - 0.5) * 0.08 };
    const parcel = await parcels.save(
      parcels.create({
        code: sp.code!,
        name: sp.name!,
        organizationId: orgId,
        areaId: areaFor(i),
        barracksId: null,
        address: 'Địa bàn TP Thanh Hóa và phụ cận',
        landArea: Math.round(5000 + rnd() * 40000).toString(),
        landUseType: 'QUOC_PHONG',
        usageStatus: sp.usageStatus!,
        legalStatus: sp.legalStatus!,
        legalOrigin: 'Quy hoạch/quản lý theo phân cấp',
        certificateNo: sp.legalStatus === 'CERTIFICATE' ? `GCNQSDĐ-QP/${2005 + i}/${200 + i * 7}` : null,
        disputeStatus: sp.disputeStatus!,
        disputeNote: sp.disputeStatus !== 'NONE' ? 'Phát hiện qua khảo sát; đang lập hồ sơ xử lý theo quy định.' : null,
        accessRoad: 'Đường liên xã',
        hasElectricity: rnd() > 0.4,
        hasWater: rnd() > 0.4,
        expansionCapability: sp.expansionCapability!,
        safetyStatus: sp.disputeStatus === 'ENCROACHED' ? 'RISK' : 'SAFE',
        location: point(center.lng, center.lat),
        notes: SEED_NOTE,
        workflowStatus: sp.workflowStatus!,
        createdBy: null,
        updatedBy: null,
      }),
    );
    await addMarkers(parcel.id, center, sp.markers);
    created++;
  }

  console.log(`M04 seed khu đất QP: +${created} khu đất (bỏ qua ${skipped} đã có), +${markerCount} mốc giới.`);
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
