import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Mốc giới của khu đất quốc phòng (M04). Quản lý số hiệu mốc + toạ độ.
@Entity('land_parcel_markers')
@Index(['landParcelId', 'code'], { unique: true })
export class LandParcelMarker {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'land_parcel_id', type: 'uuid' })
  landParcelId!: string;

  @Column()
  code!: string;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
