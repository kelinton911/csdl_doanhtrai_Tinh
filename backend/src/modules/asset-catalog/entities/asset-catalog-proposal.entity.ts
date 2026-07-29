import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Một mục ĐỀ XUẤT BỔ SUNG vào danh mục tài sản ngành Doanh trại,
// đáp ứng CV 2837/DT-QLDT ngày 16/7/2026 (hạn gửi Cục Doanh trại: 30/8/2026).
//
// Mã đề xuất KHÔNG BAO GIỜ được ghi vào asset_catalog_items: ranh giới giữa
// "BQP đã ban hành" và "đơn vị đề xuất" phải luôn rõ. Mã chỉ trở thành chính thức
// khi Cục Doanh trại ban hành phụ lục mới và ta nạp lại qua seed:asset-catalog.
@Entity('asset_catalog_proposals')
export class AssetCatalogProposal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId!: string | null;

  // Mã nút cha trong danh mục chính thức — mục mới sẽ nằm dưới nút này.
  @Index()
  @Column({ name: 'parent_code', type: 'varchar', length: 22 })
  parentCode!: string;

  // Mã do bộ cấp mã sinh ra (chưa lưu cho tới khi người dùng xác nhận).
  @Column({ name: 'proposed_code', type: 'varchar', length: 22, nullable: true })
  proposedCode!: string | null;

  @Column()
  name!: string;

  @Column({ name: 'unit_code', type: 'varchar', nullable: true })
  unitCode!: string | null;

  // ĐVT dạng chữ — ĐÂY là giá trị được ghi vào cột ĐVT của file nộp BQP.
  @Column({ name: 'unit_raw', type: 'varchar', nullable: true })
  unitRaw!: string | null;

  @Column({ type: 'text', nullable: true })
  justification!: string | null;

  // MATERIAL | FACILITY | MANUAL — nguồn gốc của đề xuất.
  @Column({ name: 'source_kind', default: 'MANUAL' })
  sourceKind!: string;

  // Dòng cục bộ (materials.id / facilities.id) đã làm phát sinh đề xuất này.
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId!: string | null;

  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  // True khi nút cha đang là nút lá: thêm con sẽ biến nó thành nhóm —
  // đó là quyết định của Cục Doanh trại, phải nêu rõ trong văn bản đề xuất.
  @Column({ name: 'requires_parent_promotion', default: false })
  requiresParentPromotion!: boolean;

  // DRAFT | SUBMITTED | APPROVED | REJECTED | EXPORTED
  @Index()
  @Column({ default: 'DRAFT' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
