import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { SubmissionStatus } from '../dt11.enums';

// Tổng hợp nhiều đơn vị (BR-DT11-008/020/021). Mỗi (parent_report, child_org) DUY NHẤT ⇒ chống aggregate trùng
// (rollup 2 lần cùng đơn vị con không cộng đôi). submission_status=MISSING: đơn vị chưa gửi, KHÔNG tính = 0.
@Entity('report_rollup')
@Index('UQ_rollup_parent_child', ['parentReportId', 'childOrgId'], { unique: true })
export class ReportRollup extends AbstractEntity {
  @Index()
  @Column({ name: 'parent_report_id', type: 'uuid' })
  parentReportId!: string;

  @Column({ name: 'child_org_id', type: 'uuid' })
  childOrgId!: string;

  @Column({ name: 'child_org_name', type: 'varchar', nullable: true })
  childOrgName!: string | null;

  // Bản báo cáo con đã gửi (nếu SUBMITTED). NULL khi MISSING.
  @Column({ name: 'child_instance_id', type: 'uuid', nullable: true })
  childInstanceId!: string | null;

  @Column({ name: 'submission_status', type: 'varchar', default: SubmissionStatus.MISSING })
  submissionStatus!: SubmissionStatus;

  // Đã cộng vào tổng của parent (idempotent theo child_org).
  @Column({ type: 'boolean', default: false })
  aggregated!: boolean;

  @Column({ name: 'aggregated_at', type: 'timestamptz', nullable: true })
  aggregatedAt!: Date | null;
}
