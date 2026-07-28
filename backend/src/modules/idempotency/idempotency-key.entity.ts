import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Lưu kết quả POST theo Idempotency-Key (Tài liệu Backend §8) — gửi lại không tạo trùng.
@Entity('idempotency_keys')
export class IdempotencyKey {
  // Khóa = header Idempotency-Key + method + path để tránh đụng giữa endpoint.
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number;

  @Column({ type: 'jsonb', nullable: true })
  response!: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
