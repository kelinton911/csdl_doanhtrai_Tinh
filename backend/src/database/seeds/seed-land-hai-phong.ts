// Seed dữ liệu THAM CHIẾU đất quốc phòng Hải Phòng 2026 (bộ 5 biểu BCQK nộp QK3).
// Nguồn: land-hai-phong-2026.data.ts (sinh bởi scripts/extract-hai-phong-land.py).
// Idempotent theo mã. Đánh cờ dataSource=REFERENCE_HAIPHONG_2026 — KHÔNG phải số liệu production.
// Dựng cây khối: Bộ CHQS TP Hải Phòng (PROVINCE) → 5 Khối A–E (UNIT) → thửa (organizationId=khối).
// Chốt snapshot kỳ trước (2025-01-01) để biểu 01/02/03 dựng cột "kỳ trước → tăng/giảm → kỳ này".
import 'reflect-metadata';
import dataSource from '../data-source';
import { LandParcel } from '../../modules/land-parcels/entities/land-parcel.entity';
import { LandEconomicUse } from '../../modules/land-parcels/entities/land-economic-use.entity';
import { LandPeriodSnapshot } from '../../modules/land-parcels/entities/land-period-snapshot.entity';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { WorkflowStatus } from '../../common/workflow';
import {
  HP_BLOCKS,
  HP_DATA_SOURCE,
  HP_ECONOMIC,
  HP_PARCELS,
  HP_PERIOD_PREVIOUS,
  HpParcel,
} from './land-hai-phong-2026.data';

const PROVINCE_CODE = 'HP-BCHQS';
const blockOrgCode = (b: string) => `HP-KHOI-${b}`;

// Từ khóa mạnh để đối chiếu khoản cho thuê (biểu 04) với thửa (biểu 02) theo tên.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const parcelRepo = dataSource.getRepository(LandParcel);
  const snapRepo = dataSource.getRepository(LandPeriodSnapshot);
  const econRepo = dataSource.getRepository(LandEconomicUse);

  // 1) Cây tổ chức: tỉnh + 5 khối.
  const upsertOrg = async (code: string, name: string, type: string, parentId: string | null) => {
    let o = await orgRepo.findOne({ where: { code } });
    if (!o) o = orgRepo.create({ code, name, type, parentId, status: 'ACTIVE' });
    else { o.name = name; o.type = type; o.parentId = parentId; }
    return orgRepo.save(o);
  };
  const province = await upsertOrg(PROVINCE_CODE, 'BỘ CHỈ HUY QUÂN SỰ THÀNH PHỐ HẢI PHÒNG', 'PROVINCE', null);
  const blockId: Record<string, string> = {};
  for (const b of HP_BLOCKS) {
    const org = await upsertOrg(blockOrgCode(b.code), b.name, 'UNIT', province.id);
    blockId[b.code] = org.id;
  }

  // 2) Thửa đất (991) — idempotent theo mã HP26-xxxx.
  let created = 0;
  let updated = 0;
  const codeToParcel: Record<string, string> = {}; // parcel code → id
  for (const p of HP_PARCELS as HpParcel[]) {
    const address = [p.commune, p.province].filter(Boolean).join(', ') || null;
    const legalStatus = p.certPoint > 0 ? 'CERTIFICATE' : 'PENDING';
    const fields = {
      name: p.name,
      organizationId: blockId[p.block] ?? province.id,
      areaId: null as string | null,
      barracksId: null as string | null,
      address,
      landArea: p.area.toFixed(2),
      pointCount: p.point,
      landUseType: 'QUOC_PHONG',
      usageStatus: p.point > 0 ? 'IN_USE' : 'VACANT',
      legalStatus,
      legalOrigin: 'Kiểm kê đất QP 0h 01/01/2026 (Hải Phòng, QK3)',
      certificateNo: null as string | null,
      certificateSerie: p.certSerie,
      certificateIssuedAt: null as string | null,
      legalDocs: p.legalDocs,
      // Hiện trạng: toàn bộ là đất QP (biểu 01 tỉnh: kinh tế=0, khu GĐ=0).
      areaDefense: p.area.toFixed(2),
      areaEconomic: '0',
      areaFamily: '0',
      familyHasBqpApproval: false,
      disputeStatus: 'NONE',
      notes: p.note,
      dataSource: HP_DATA_SOURCE,
      workflowStatus: WorkflowStatus.APPROVED,
    };
    let parcel = await parcelRepo.findOne({ where: { code: p.code } });
    if (!parcel) {
      parcel = parcelRepo.create({ code: p.code, ...fields, createdBy: null, updatedBy: null });
      created++;
    } else {
      Object.assign(parcel, fields);
      updated++;
    }
    parcel = await parcelRepo.save(parcel);
    codeToParcel[p.code] = parcel.id;

    // 3) Snapshot kỳ trước (2025-01-01): số điểm/diện tích kỳ trước để dựng cột đối chiếu.
    let snap = await snapRepo.findOne({ where: { periodDate: HP_PERIOD_PREVIOUS, parcelCode: p.code } });
    const snapFields = {
      landParcelId: parcel.id,
      organizationId: blockId[p.block] ?? province.id,
      pointCount: p.pointPrev,
      area: p.areaPrev.toFixed(2),
      areaDefense: p.areaPrev.toFixed(2),
      areaEconomic: '0',
      areaFamily: '0',
      certCount: p.certPoint,
      certArea: p.certArea.toFixed(2),
      note: null as string | null,
    };
    if (!snap) snap = snapRepo.create({ periodDate: HP_PERIOD_PREVIOUS, parcelCode: p.code, ...snapFields });
    else Object.assign(snap, snapFields);
    await snapRepo.save(snap);
  }

  // 4) Cho thuê/mượn kinh tế (biểu 04) — gắn vào thửa khớp tên; fallback: thửa đầu tiên.
  const allParcels = await parcelRepo.find({ where: { dataSource: HP_DATA_SOURCE } });
  const normIndex = allParcels.map((x) => ({ id: x.id, norm: normalize(x.name) }));
  const fallbackId = allParcels[0]?.id;
  let econCreated = 0;
  // Reseed sạch các khoản cho thuê thuộc thửa tham chiếu HP (idempotent, không đụng dữ liệu khác).
  const hpIds = allParcels.map((x) => x.id);
  if (hpIds.length) {
    await econRepo
      .createQueryBuilder()
      .delete()
      .where('land_parcel_id IN (:...ids)', { ids: hpIds })
      .execute();
  }
  for (const e of HP_ECONOMIC) {
    const en = normalize(e.name);
    const token = en.split(' ').filter((w) => w.length >= 4)[0] ?? en;
    const match = normIndex.find((x) => x.norm.includes(token) || en.includes(x.norm.split(' ')[0]));
    const parcelId = match?.id ?? fallbackId;
    if (!parcelId) continue;
    await econRepo.save(
      econRepo.create({
        landParcelId: parcelId,
        area: e.area.toFixed(2),
        legalBasis: e.legalBasis,
        bqpStatus: e.bqpStatus,
        contractNo: null,
        certificateSerie: null,
        note: `[${e.category === 'LIQUIDATED' ? 'Đã thanh lý chưa thu hồi' : 'Hợp đồng còn hạn'}] ${e.name} — ${[e.commune, e.province].filter(Boolean).join(', ')}`,
        createdBy: null,
      }),
    );
    econCreated++;
  }

  console.log(
    `Seed HP đất QP: +${created} thửa mới, ${updated} cập nhật; ` +
      `${econCreated} khoản cho thuê KT; snapshot kỳ trước ${HP_PERIOD_PREVIOUS}.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
