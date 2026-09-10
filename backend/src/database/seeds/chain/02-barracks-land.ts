// [02] DT-02 — Hồ sơ doanh trại + đất (Quyển II) trên xã THẬT Thanh Hóa.
// Mỗi xã đại diện: 1 doanh trại (legacy — cho bản đồ/màn cũ) + 1 công trình + 1 kho +
// address_snapshot (bảo toàn huyện lịch sử) + land_usage_allocation (Σ ≤ diện tích) + land_change_event.
// Idempotent theo code/owner. Kho gắn area_id/organization_id để lọc theo phạm vi như doanh trại.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Barracks } from '../../../modules/barracks/entities/barracks.entity';
import { Facility } from '../../../modules/facilities/entities/facility.entity';
import { FacilityStatus } from '../../../modules/facilities/facility-status';
import { StorageLocation } from '../../../modules/inventory/entities/storage-location.entity';
import { WorkflowStatus } from '../../../common/workflow';
import { AddressSnapshot } from '../../../modules/dt02-land/entities/address-snapshot.entity';
import { LandUsageAllocation } from '../../../modules/dt02-land/entities/land-usage-allocation.entity';
import { LandChangeEvent } from '../../../modules/dt02-land/entities/land-change-event.entity';
import { AddressOwnerType, LandUsageType, LandChangeType, AllocationStatus } from '../../../modules/dt02-land/dt02.enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes } from './_shared/demo-ids';

const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const TH_CENTER = { lng: 105.78, lat: 19.8 };

export async function run(ds: DataSource): Promise<void> {
  const barracksRepo = ds.getRepository(Barracks);
  const facilityRepo = ds.getRepository(Facility);
  const locationRepo = ds.getRepository(StorageLocation);
  const addrRepo = ds.getRepository(AddressSnapshot);
  const usageRepo = ds.getRepository(LandUsageAllocation);
  const changeRepo = ds.getRepository(LandChangeEvent);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nBarracks = 0;
  let nLand = 0;

  for (let i = 0; i < communes.length; i++) {
    const c = communes[i];
    // Toạ độ tâm xã (nếu có ranh giới), fallback tâm tỉnh + jitter tất định.
    const cen = await ds.query(
      `SELECT ST_X(ST_PointOnSurface(geometry)) AS lng, ST_Y(ST_PointOnSurface(geometry)) AS lat
         FROM administrative_areas WHERE id = $1 AND geometry IS NOT NULL`,
      [c.areaId],
    );
    const lng = cen?.[0]?.lng != null ? Number(cen[0].lng) : TH_CENTER.lng + (i - 2) * 0.08;
    const lat = cen?.[0]?.lat != null ? Number(cen[0].lat) : TH_CENTER.lat + (i - 2) * 0.06;

    const barracksCode = `DT-38-${String(i + 1).padStart(2, '0')}`;
    const landArea = 18000 + i * 4000;
    let b = await barracksRepo.findOne({ where: { code: barracksCode } });
    if (!b) {
      b = await barracksRepo.save(
        barracksRepo.create({
          code: barracksCode,
          name: `Doanh trại Ban CHQS ${c.areaName}`,
          areaId: c.areaId,
          organizationId: c.orgId,
          declaredCapacity: 300 + i * 40,
          landArea: landArea.toFixed(2),
          address: `Khu trung tâm ${c.areaName}`,
          function: 'Cơ quan chỉ huy',
          workflowStatus: WorkflowStatus.APPROVED,
          location: point(lng, lat),
        }),
      );
      nBarracks++;
    }

    // Công trình (1) — chủ thể của address_snapshot.
    let fac = await facilityRepo.findOne({ where: { barracksId: b.id, code: 'CT-01' } });
    if (!fac) {
      fac = await facilityRepo.save(
        facilityRepo.create({
          barracksId: b.id,
          code: 'CT-01',
          name: 'Nhà làm việc chỉ huy',
          type: 'Nhà làm việc',
          area: (landArea * 0.05).toFixed(2),
          declaredCapacity: 60,
          buildYear: 2010 + i,
          condition: i % 3 === 0 ? 'FAIR' : 'GOOD',
          status: FacilityStatus.IN_USE,
          houseClass: 'II',
          floors: 2,
          location: point(lng + 0.002, lat + 0.002),
        }),
      );
    }

    // Kho (1) — ký hiệu ngành DT / cấp XA.
    const khoCode = `KHO-38-${String(i + 1).padStart(2, '0')}`;
    if (!(await locationRepo.findOne({ where: { code: khoCode } }))) {
      await locationRepo.save(
        locationRepo.create({
          code: khoCode,
          name: `Kho vật chất doanh trại ${c.areaName}`,
          type: 'KHO-TONG',
          nganh: 'DT',
          cap: 'XA',
          capacityTons: (200 + i * 50).toFixed(2),
          barracksId: b.id,
          areaId: c.areaId,
          organizationId: c.orgId,
          workflowStatus: WorkflowStatus.APPROVED,
          location: point(lng - 0.002, lat - 0.002),
          status: 'ACTIVE',
        }),
      );
    }

    // address_snapshot (bảo toàn huyện lịch sử — BR-DT02-001).
    if (!(await addrRepo.findOne({ where: { ownerId: fac.id, ownerType: AddressOwnerType.FACILITY } }))) {
      await addrRepo.save(
        addrRepo.create({
          ownerType: AddressOwnerType.FACILITY,
          ownerId: fac.id,
          provinceText: 'Tỉnh Thanh Hoá',
          districtTextLegacy: 'Nguyên thuộc cấp huyện (lịch sử)',
          communeText: c.areaName,
          detailText: `Doanh trại ${barracksCode}`,
          effectiveAt: '2026-01-01',
        }),
      );
    }

    // land_usage_allocation: dùng doanh trại làm "điểm đất"; Σ ≤ landArea (BR-DT02-004).
    const usages: Array<{ usageType: LandUsageType; areaM2: number }> = [
      { usageType: LandUsageType.BUILDING_LAND, areaM2: Math.round(landArea * 0.6) },
      { usageType: LandUsageType.TRAINING_GROUND, areaM2: Math.round(landArea * 0.25) },
    ];
    for (const u of usages) {
      const exists = await usageRepo.findOne({ where: { landPointId: b.id, usageType: u.usageType } });
      if (!exists) {
        await usageRepo.save(
          usageRepo.create({
            landPointId: b.id,
            usageType: u.usageType,
            areaM2: u.areaM2.toFixed(2),
            effectiveFrom: '2026-01-01',
            status: AllocationStatus.ACTIVE,
          }),
        );
        nLand++;
      }
    }

    // land_change_event: 1 biến động tăng (append-only).
    if (!(await changeRepo.findOne({ where: { landPointId: b.id, changeType: LandChangeType.INCREASE } }))) {
      await changeRepo.save(
        changeRepo.create({
          landPointId: b.id,
          changeType: LandChangeType.INCREASE,
          pointDelta: 0,
          areaDeltaM2: (landArea * 0.1).toFixed(2),
          effectiveDate: '2026-02-15',
          reason: 'Bàn giao bổ sung diện tích huấn luyện',
        }),
      );
    }
  }

  console.log(`  [02] DT-02: doanh trại +${nBarracks} · kho/công trình theo ${communes.length} xã · phân bổ đất +${nLand}.`);
}

if (require.main === module) standalone(run);
