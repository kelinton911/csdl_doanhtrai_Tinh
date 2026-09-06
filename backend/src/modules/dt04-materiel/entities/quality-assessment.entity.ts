import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { QualityGrade } from '../../../common/enums';

// Đánh giá chất lượng có lịch sử (Quyển IV §VIII, BR-DT04-006). Σ cấp ≤ HC lô.
@Entity('quality_assessment')
export class QualityAssessment extends AbstractEntity {
  @Index()
  @Column({ name: 'lot_id', type: 'uuid' })
  lotId!: string;

  @Column({ name: 'assessment_time', type: 'timestamptz' })
  assessmentTime!: Date;

  @Column({ type: 'varchar' })
  grade!: QualityGrade;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  @Column({ name: 'basis_document_id', type: 'uuid', nullable: true })
  basisDocumentId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assessor!: string | null;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;
}
