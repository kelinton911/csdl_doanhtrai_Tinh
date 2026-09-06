import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressSnapshot } from './entities/address-snapshot.entity';
import { LandUsageAllocation } from './entities/land-usage-allocation.entity';
import { LandChangeEvent } from './entities/land-change-event.entity';
import { LandParcel } from '../land-parcels/entities/land-parcel.entity';
import { AllocationStatus } from './dt02.enums';
import { areaAtSnapshot, assertAllocationWithinArea } from './land-rules';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateAddressSnapshotDto, CreateAllocationDto, CreateChangeDto } from './dt02.dto';

@Injectable()
export class LandRegistryService {
  constructor(
    @InjectRepository(AddressSnapshot) private readonly addresses: Repository<AddressSnapshot>,
    @InjectRepository(LandUsageAllocation) private readonly allocations: Repository<LandUsageAllocation>,
    @InjectRepository(LandChangeEvent) private readonly changes: Repository<LandChangeEvent>,
    @InjectRepository(LandParcel) private readonly parcels: Repository<LandParcel>,
  ) {}

  // ---- Address snapshots (bảo toàn địa chỉ lịch sử có huyện) ----
  async createAddressSnapshot(dto: CreateAddressSnapshotDto, user: AuthUser): Promise<AddressSnapshot> {
    return this.addresses.save(this.addresses.create({ ...dto, createdBy: user?.sub ?? null }));
  }

  async listAddressSnapshots(ownerType: string, ownerId: string): Promise<AddressSnapshot[]> {
    return this.addresses.find({
      where: { ownerType: ownerType as AddressSnapshot['ownerType'], ownerId },
      order: { effectiveAt: 'DESC' },
    });
  }

  // ---- Usage allocations (BR-DT02-004: Σ ≤ diện tích điểm đất) ----
  async createAllocation(dto: CreateAllocationDto, user: AuthUser): Promise<LandUsageAllocation> {
    const parcel = await this.parcels.findOne({ where: { id: dto.landPointId } });
    if (!parcel) throw new NotFoundException(`DATA-001: Không có điểm đất ${dto.landPointId}`);
    const landArea = Number(parcel.landArea) || 0;
    const existing = await this.allocations.find({
      where: { landPointId: dto.landPointId, status: AllocationStatus.ACTIVE },
    });
    assertAllocationWithinArea(existing.map((a) => Number(a.areaM2)), dto.areaM2, landArea);

    return this.allocations.save(
      this.allocations.create({
        landPointId: dto.landPointId,
        usageType: dto.usageType,
        areaM2: String(dto.areaM2),
        effectiveFrom: dto.effectiveFrom ?? null,
        basisDocId: dto.basisDocId ?? null,
        status: AllocationStatus.ACTIVE,
        createdBy: user?.sub ?? null,
        updatedBy: user?.sub ?? null,
      }),
    );
  }

  async listAllocations(landPointId: string): Promise<LandUsageAllocation[]> {
    return this.allocations.find({ where: { landPointId }, order: { createdAt: 'DESC' } });
  }

  // ---- Change events + diện tích tại snapshot (BR-DT02-005/007) ----
  async createChange(dto: CreateChangeDto, user: AuthUser): Promise<LandChangeEvent> {
    const parcel = await this.parcels.findOne({ where: { id: dto.landPointId } });
    if (!parcel) throw new NotFoundException(`DATA-001: Không có điểm đất ${dto.landPointId}`);
    return this.changes.save(
      this.changes.create({
        landPointId: dto.landPointId,
        changeType: dto.changeType,
        pointDelta: dto.pointDelta ?? 0,
        areaDeltaM2: String(dto.areaDeltaM2),
        effectiveDate: dto.effectiveDate,
        reason: dto.reason ?? null,
        docId: dto.docId ?? null,
        createdBy: user?.sub ?? null,
      }),
    );
  }

  async listChanges(landPointId: string): Promise<LandChangeEvent[]> {
    return this.changes.find({ where: { landPointId }, order: { effectiveDate: 'DESC' } });
  }

  // Diện tích điểm đất tại thời điểm kiểm kê = diện tích gốc (land_parcels) + Σ biến động ≤ as_of.
  async areaAtSnapshot(landPointId: string, asOf: string) {
    const parcel = await this.parcels.findOne({ where: { id: landPointId } });
    if (!parcel) throw new NotFoundException(`DATA-001: Không có điểm đất ${landPointId}`);
    const changes = await this.changes.find({ where: { landPointId } });
    const base = Number(parcel.landArea) || 0;
    const area = areaAtSnapshot(
      base,
      changes.map((c) => ({ areaDeltaM2: Number(c.areaDeltaM2), effectiveDate: c.effectiveDate })),
      asOf,
    );
    return { landPointId, asOf, baseAreaM2: base, areaAtSnapshotM2: area, source: 'land_change_event' };
  }

  // ---- Data quality (DT-02 §XVI, DQ-DT02) ----
  async dataQuality() {
    // DQ1: điểm đất bị phân bổ hiện trạng vượt diện tích (BR-DT02-004).
    const overAllocated = await this.allocations
      .createQueryBuilder('a')
      .select('a.land_point_id', 'landPointId')
      .addSelect('SUM(a.area_m2)', 'allocated')
      .where("a.status = 'ACTIVE'")
      .groupBy('a.land_point_id')
      .getRawMany<{ landPointId: string; allocated: string }>();

    const issues: Array<{ code: string; landPointId: string; detail: string }> = [];
    for (const row of overAllocated) {
      const parcel = await this.parcels.findOne({ where: { id: row.landPointId } });
      if (!parcel) continue;
      const allocated = Number(row.allocated) || 0;
      const landArea = Number(parcel.landArea) || 0;
      if (allocated > landArea + 0.01) {
        issues.push({
          code: 'DQ-DT02-04',
          landPointId: row.landPointId,
          detail: `Σ phân bổ ${allocated.toFixed(2)} m² > diện tích ${landArea.toFixed(2)} m²`,
        });
      }
    }
    return { checkedAt: new Date().toISOString(), issueCount: issues.length, issues };
  }
}
