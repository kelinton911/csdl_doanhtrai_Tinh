// [06] DT-06 — Dự trữ & phân bổ (Quyển VI). Lớp phủ ngữ nghĩa trên HC (KHÔNG tự trừ tồn).
// Mỗi xã: 1 phân bổ APPROVED + hold EXCLUSIVE (SSCĐ + REGULAR) ≤ HC + reserve_requirement_link↔DT-07.
// Idempotent theo allocation_no; hold tạo cùng lúc khi phân bổ mới.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AllocationType } from '../../../modules/dt06-allocation/entities/allocation-type.entity';
import { InventoryAllocation } from '../../../modules/dt06-allocation/entities/inventory-allocation.entity';
import { AllocationLine } from '../../../modules/dt06-allocation/entities/allocation-line.entity';
import { AllocationHold } from '../../../modules/dt06-allocation/entities/allocation-hold.entity';
import { ReserveRequirementLink } from '../../../modules/dt06-allocation/entities/reserve-requirement-link.entity';
import { AllocationCategory, AllocationSemantics, AllocationStatus, HoldStatus, reserveGap } from '../../../modules/dt06-allocation/alloc-rules';
import { ActiveStatus } from '../../../modules/catalog/catalog.enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, MATERIALS, CORE_MATERIAL_CODES, CHAIN } from './_shared/demo-ids';

const CORE = MATERIALS.filter((m) => CORE_MATERIAL_CODES.includes(m.code));

export async function run(ds: DataSource): Promise<void> {
  const typeRepo = ds.getRepository(AllocationType);
  const allocRepo = ds.getRepository(InventoryAllocation);
  const lineRepo = ds.getRepository(AllocationLine);
  const holdRepo = ds.getRepository(AllocationHold);
  const linkRepo = ds.getRepository(ReserveRequirementLink);

  // Loại phân bổ (cấu hình).
  const ensureType = async (code: string, name: string, category: AllocationCategory, requiresApproval: boolean) => {
    let t = await typeRepo.findOne({ where: { code } });
    if (!t) {
      t = await typeRepo.save(
        typeRepo.create({ code, name, semantics: AllocationSemantics.EXCLUSIVE, category, requiresApproval, status: ActiveStatus.ACTIVE }),
      );
    }
    return t;
  };
  const sscdType = await ensureType(CHAIN.allocationTypeCode, 'Phân bổ dự trữ SSCĐ', AllocationCategory.SSCD, true);
  await ensureType('ALLOC-REG', 'Phân bổ thường xuyên', AllocationCategory.REGULAR, false);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nAlloc = 0;
  let nHold = 0;

  for (const c of communes) {
    const allocNo = CHAIN.allocationNo(c.orgCode);
    if (await allocRepo.findOne({ where: { allocationNo: allocNo } })) continue;

    const alloc = await allocRepo.save(
      allocRepo.create({
        allocationNo: allocNo,
        allocationTypeId: sscdType.id,
        organizationId: c.orgId,
        effectiveFrom: '2026-07-01',
        status: AllocationStatus.APPROVED,
      }),
    );
    nAlloc++;

    // 2 dòng: SSCĐ (core[0], 25) + REGULAR (core[1], 15).
    const specs: Array<{ mat: (typeof CORE)[number]; qty: number; category: AllocationCategory }> = [
      { mat: CORE[0], qty: 25, category: AllocationCategory.SSCD },
      { mat: CORE[1], qty: 15, category: AllocationCategory.REGULAR },
    ];
    for (const s of specs) {
      const line = await lineRepo.save(
        lineRepo.create({ allocationId: alloc.id, materialCatalogId: s.mat.id, quantity: String(s.qty), priority: 100 }),
      );
      await holdRepo.save(
        holdRepo.create({
          allocationId: alloc.id,
          allocationLineId: line.id,
          category: s.category,
          materialCatalogId: s.mat.id,
          organizationId: c.orgId,
          quantityReserved: String(s.qty),
          semantics: AllocationSemantics.EXCLUSIVE,
          priority: 100,
          effectiveFrom: '2026-07-01',
          status: HoldStatus.ACTIVE,
        }),
      );
      nHold++;
    }

    // reserve_requirement_link: đối chiếu định mức DT-07 (required 30 vs allocated 25 → SHORTAGE).
    const required = 30;
    const allocated = 25;
    const gap = reserveGap(required, allocated);
    await linkRepo.save(
      linkRepo.create({
        allocationId: alloc.id,
        materialCatalogId: CORE[0].id,
        normReference: CHAIN.normSetCode,
        requiredQty: String(required),
        allocatedQty: String(allocated),
        gapQty: String(gap.gapQty),
        gapStatus: gap.status,
      }),
    );
  }

  console.log(`  [06] DT-06: phân bổ APPROVED +${nAlloc} · hold EXCLUSIVE (SSCĐ+REGULAR) +${nHold}.`);
}

if (require.main === module) standalone(run);
