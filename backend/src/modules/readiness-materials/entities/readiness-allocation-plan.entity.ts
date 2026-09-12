import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { WorkflowStatus } from '../../../common/workflow';

// Feature 03 — Phương án PHÂN CẤP LƯỢNG vật chất SSCĐ do Cơ quan HC-KT Tỉnh xây dựng (top-down),
// theo quy định Quân khu. Mỗi trạng thái SSCĐ (Tăng cường/Cao/Toàn bộ) là MỘT BẢNG riêng.
// Workflow chuẩn DRAFT→PENDING_REVIEW→APPROVED (tái dùng transitionWithRevision).
@Entity('readiness_allocation_plans')
@Index(['readinessState', 'periodLabel'], { unique: true })
export class ReadinessAllocationPlan extends AbstractEntity {
  // TANG_CUONG | CAO | TOAN_BO (SSCD_ALLOCATION_STATES).
  @Index()
  @Column({ name: 'readiness_state', type: 'varchar' })
  readinessState!: string;

  @Column({ type: 'varchar' })
  title!: string;

  // Căn cứ pháp lý / chỉ lệnh cấp trên (Quân khu) — văn bản quy định lượng phân cấp.
  @Column({ name: 'regulation_ref', type: 'text', nullable: true })
  regulationRef!: string | null;

  // Kỳ/năm hiệu lực (VD "2026"). Kết hợp readiness_state để tạo bảng riêng theo kỳ.
  @Column({ name: 'period_label', type: 'varchar', nullable: true })
  periodLabel!: string | null;

  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
