import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Danh mục C3 (Sprint 0 §1 GAP-9): mã C3 theo quyển gốc (DT-xx.yy.zz) gắn phân hệ,
// use case, business rule, screen, api, test — phục vụ MA TRẬN TRUY VẾT vận hành
// (C3 → UC → Entity → API → Screen → Test). Là hợp đồng truy vết, không phải dữ liệu nghiệp vụ.
@Entity('c3_catalog')
export class C3Catalog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Mã C3 duy nhất (ví dụ 'DT-04.02.01', hoặc mã hệ thống 'SYS-BR-08').
  @Index({ unique: true })
  @Column({ name: 'c3_code', type: 'varchar' })
  c3Code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  // Phân hệ: DT-01..DT-12 hoặc 'SYS' (nền tảng).
  @Index()
  @Column({ type: 'varchar' })
  subsystem!: string;

  @Column({ name: 'use_case', type: 'varchar', nullable: true })
  useCase!: string | null;

  @Column({ name: 'business_rule', type: 'varchar', nullable: true })
  businessRule!: string | null;

  @Column({ type: 'varchar', nullable: true })
  screen!: string | null;

  @Column({ type: 'varchar', nullable: true })
  api!: string | null;

  @Column({ type: 'varchar', nullable: true })
  test!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
