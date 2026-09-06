import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AllocationStatus, LandUsageType } from '../dt02.enums';

// Phân bổ hiện trạng sử dụng của điểm đất (Quyển II §VIII, BR-DT02-004).
// Σ diện tích phân bổ ACTIVE ≤ diện tích điểm đất (cưỡng chế ở service).
@Entity('land_usage_allocation')
export class LandUsageAllocation extends AbstractEntity {
  @Index()
  @Column({ name: 'land_point_id', type: 'uuid' })
  landPointId!: string;

  @Column({ name: 'usage_type', type: 'varchar', default: LandUsageType.BUILDING_LAND })
  usageType!: LandUsageType;

  @Column({ name: 'area_m2', type: 'numeric', precision: 18, scale: 2 })
  areaM2!: string;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'basis_doc_id', type: 'uuid', nullable: true })
  basisDocId!: string | null;

  @Index()
  @Column({ type: 'varchar', default: AllocationStatus.ACTIVE })
  status!: AllocationStatus;
}
