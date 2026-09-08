import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Kiểm kê chất lượng C1–5 theo dòng kiểm đếm (BR-DT10-009). Σ(grade1..5) = physical_qty khi bắt buộc
// (assertQualityTotal → QUALITY_TOTAL_MISMATCH). Một dòng count_line có tối đa một bản ghi chất lượng.
@Entity('count_quality_grade')
export class CountQualityGrade extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'count_line_id', type: 'uuid' })
  countLineId!: string;

  @Column({ name: 'grade1', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade1!: string;
  @Column({ name: 'grade2', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade2!: string;
  @Column({ name: 'grade3', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade3!: string;
  @Column({ name: 'grade4', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade4!: string;
  @Column({ name: 'grade5', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade5!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
