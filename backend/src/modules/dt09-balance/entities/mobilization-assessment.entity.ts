import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ReadinessLevel } from '../dt09.enums';

// DT-09 — Đánh giá khả năng huy động một nguồn vật chất (BR-DT09-003).
// mobilizable_qty ≤ verified_qty; lead_time_days để xét ELIGIBLE theo deadline. Bản mới nhất là hiện hành.
@Entity('mobilization_assessment')
export class MobilizationAssessment extends AbstractEntity {
  @Index()
  @Column({ name: 'source_material_id', type: 'uuid' })
  sourceMaterialId!: string;

  @Column({ name: 'mobilizable_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  mobilizableQty!: string;

  @Column({ name: 'lead_time_days', type: 'int', default: 0 })
  leadTimeDays!: number;

  @Column({ name: 'readiness_level', type: 'varchar', default: ReadinessLevel.MEDIUM })
  readinessLevel!: ReadinessLevel;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy!: string | null;

  @Column({ name: 'assessed_at', type: 'timestamptz' })
  assessedAt!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
