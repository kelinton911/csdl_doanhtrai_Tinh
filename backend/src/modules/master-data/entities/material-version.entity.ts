import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Lịch sử phiên bản vật chất (M03) — snapshot bất biến để đối chiếu/diff giữa các lần thay đổi.
@Entity('material_versions')
export class MaterialVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  // CREATE | UPDATE | PUBLISH
  @Column({ name: 'change_type' })
  changeType!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  snapshot!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
