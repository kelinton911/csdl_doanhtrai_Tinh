import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { WorkflowStatus } from '../../../common/workflow';

// M17 — Tiềm lực Hậu cần - Kỹ thuật của KHU VỰC cấp xã (dân số/nhân lực, lương thực,
// y tế, xăng dầu, vận tải, cơ sở huy động…). Cấp xã tự khai báo theo kỳ; chỉ huy xã
// duyệt (DRAFT → PENDING_REVIEW → APPROVED). Một bản/khu vực/kỳ báo cáo.
@Entity('commune_potentials')
@Index(['areaId'])
@Index(['organizationId'])
export class CommunePotential extends AbstractEntity {
  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  // Khu vực hành chính cấp xã (administrative_areas.id).
  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Đơn vị chủ quản (dùng cho phạm vi dữ liệu — @Scoped('organization')).
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // Kỳ báo cáo (VD: "2026", "Quý I/2026").
  @Column({ name: 'period_label', type: 'varchar', nullable: true })
  periodLabel!: string | null;

  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

  // ---- Dân số & nhân lực ----
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  population!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  households!: string;

  @Column({ name: 'labor_force', type: 'numeric', precision: 18, scale: 2, default: 0 })
  laborForce!: string;

  @Column({ name: 'militia_self_defense', type: 'numeric', precision: 18, scale: 2, default: 0 })
  militiaSelfDefense!: string;

  @Column({ name: 'reserve_force', type: 'numeric', precision: 18, scale: 2, default: 0 })
  reserveForce!: string;

  // ---- Lương thực - thực phẩm ----
  @Column({ name: 'food_reserve_tons', type: 'numeric', precision: 18, scale: 2, default: 0 })
  foodReserveTons!: string;

  @Column({ name: 'annual_food_output_tons', type: 'numeric', precision: 18, scale: 2, default: 0 })
  annualFoodOutputTons!: string;

  @Column({ name: 'livestock_heads', type: 'numeric', precision: 18, scale: 2, default: 0 })
  livestockHeads!: string;

  // ---- Y tế ----
  @Column({ name: 'medical_stations', type: 'numeric', precision: 18, scale: 2, default: 0 })
  medicalStations!: string;

  @Column({ name: 'hospital_beds', type: 'numeric', precision: 18, scale: 2, default: 0 })
  hospitalBeds!: string;

  @Column({ name: 'medical_staff', type: 'numeric', precision: 18, scale: 2, default: 0 })
  medicalStaff!: string;

  // ---- Xăng dầu - nhiên liệu ----
  @Column({ name: 'fuel_stations', type: 'numeric', precision: 18, scale: 2, default: 0 })
  fuelStations!: string;

  @Column({ name: 'fuel_reserve_m3', type: 'numeric', precision: 18, scale: 2, default: 0 })
  fuelReserveM3!: string;

  // ---- Vận tải ----
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  trucks!: string;

  @Column({ name: 'passenger_cars', type: 'numeric', precision: 18, scale: 2, default: 0 })
  passengerCars!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  boats!: string;

  @Column({ name: 'transport_capacity_tons', type: 'numeric', precision: 18, scale: 2, default: 0 })
  transportCapacityTons!: string;

  // ---- Cơ sở vật chất huy động ----
  @Column({ name: 'civil_warehouses', type: 'numeric', precision: 18, scale: 2, default: 0 })
  civilWarehouses!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  schools!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  factories!: string;

  // Đánh giá chung + ghi chú.
  @Column({ type: 'text', nullable: true })
  assessment!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
