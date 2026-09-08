import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Vòng kiểm đếm lại (BR-DT10-008). Mỗi recount = 1 bản ghi round MỚI; các dòng vòng trước GIỮ NGUYÊN
// (không ghi đè). round_no khớp count_line.round_no.
@Entity('recount_round')
export class RecountRound extends AbstractEntity {
  @Index()
  @Column({ name: 'count_sheet_id', type: 'uuid' })
  countSheetId!: string;

  @Column({ name: 'round_no', type: 'int' })
  roundNo!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;
}
