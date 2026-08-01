import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Scenario } from './entities/scenario.entity';
import { ScenarioRun } from './entities/scenario-run.entity';
import { Plan } from './entities/plan.entity';
import {
  ComparePlansDto,
  CreatePlanDto,
  CreateScenarioDto,
} from './dto/scenario.dto';
import { ScenarioStatus } from '../../common/workflow';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Định mức tiêu thụ/người/ngày — căn cứ THẬT: docs/Quiuoctinhtoan.pdf (LTTP-gạo tẻ 0,75;
// chất đốt 0,7 kg; nước 5 lít). Dùng để đối chiếu nhanh tồn kho trong tình huống.
// Engine tính toán HC-KT đầy đủ 6 ngành ở module logistics-norms (/logistics-norms/compute).
const NORMS = [
  { code: 'VC-GAO', name: 'Gạo tẻ', unit: 'KG', perDay: 0.75 },
  { code: 'VC-CHATDOT', name: 'Chất đốt', unit: 'KG', perDay: 0.7 },
  { code: 'VC-NUOC', name: 'Nước sinh hoạt', unit: 'LIT', perDay: 5 },
];

// M10 — Scenario & Planning. UC-15 (tính toán), UC-16 (so sánh, chốt phương án).
@Injectable()
export class ScenarioService {
  constructor(
    @InjectRepository(Scenario) private readonly scenarios: Repository<Scenario>,
    @InjectRepository(ScenarioRun) private readonly runs: Repository<ScenarioRun>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    private readonly ds: DataSource,
  ) {}

  // ------- Tình huống -------
  async listScenarios(q: PaginationQuery) {
    const [data, total] = await this.scenarios.findAndCount({ order: { createdAt: 'DESC' }, skip: q.skip, take: q.size });
    return paginated(data, total, q);
  }

  async getScenario(id: string) {
    const s = await this.scenarios.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy tình huống');
    return s;
  }

  async createScenario(dto: CreateScenarioDto, user: AuthUser) {
    const dup = await this.scenarios.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã tình huống ${dto.code}`);
    return this.scenarios.save(
      this.scenarios.create({
        code: dto.code,
        name: dto.name,
        parameters: dto.parameters as unknown as Record<string, unknown>,
        status: ScenarioStatus.DRAFT,
        createdBy: user.sub,
      }),
    );
  }

  // UC-15: chạy engine → tạo ScenarioRun có version + thời điểm; KHÔNG ghi vào tồn thực.
  async run(id: string, user: AuthUser) {
    const s = await this.getScenario(id);
    const params = s.parameters as { troopCount: number; durationDays: number; damageLevel?: number };
    const troopCount = Number(params.troopCount) || 0;
    const durationDays = Number(params.durationDays) || 1;
    const damageLevel = Math.min(Math.max(Number(params.damageLevel) || 0, 0), 1);

    // Chỗ ở: tổng khả năng tiếp nhận sau khi trừ mức hư hỏng.
    const [cap] = await this.ds.query(
      `SELECT COALESCE(SUM(declared_capacity),0)::int AS capacity,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE workflow_status='APPROVED')::int AS approved
       FROM barracks`,
    );
    const effectiveCapacity = Math.round(cap.capacity * (1 - damageLevel));
    const accommodationShortage = Math.max(0, troopCount - effectiveCapacity);

    // Vật chất: đối chiếu nhu cầu với tồn kho hiện có.
    const supplies = [];
    let covered = 0;
    for (const n of NORMS) {
      const [row] = await this.ds.query(
        `SELECT COALESCE(SUM(sb.on_hand),0)::numeric AS available
         FROM stock_balances sb JOIN materials m ON m.id = sb.material_id
         WHERE m.code = $1`,
        [n.code],
      );
      const available = Number(row.available);
      const required = troopCount * n.perDay * durationDays;
      const shortage = Math.max(0, required - available);
      const coverageDays = troopCount * n.perDay > 0 ? available / (troopCount * n.perDay) : 0;
      if (available > 0) covered++;
      supplies.push({
        code: n.code,
        name: n.name,
        unit: n.unit,
        required: Math.round(required),
        available: Math.round(available),
        shortage: Math.round(shortage),
        coverageDays: Math.round(coverageDays),
        meetsDemand: shortage === 0,
      });
    }

    const approvedRatio = cap.total ? cap.approved / cap.total : 0;
    const dataCoverage = covered / NORMS.length;
    const confidence = Math.round(100 * (0.6 * approvedRatio + 0.4 * dataCoverage));

    const last = await this.runs.findOne({ where: { scenarioId: id }, order: { version: 'DESC' } });
    const run = await this.runs.save(
      this.runs.create({
        scenarioId: id,
        version: (last?.version ?? 0) + 1,
        algorithm: 'assurance-v1',
        inputSnapshot: { troopCount, durationDays, damageLevel, totalCapacity: cap.capacity, approvedBarracks: cap.approved, totalBarracks: cap.total },
        metrics: {
          accommodation: { capacity: cap.capacity, effectiveCapacity, required: troopCount, shortage: accommodationShortage, meetsDemand: accommodationShortage === 0 },
          supplies,
          confidence,
          overallMeets: accommodationShortage === 0 && supplies.every((x) => x.meetsDemand),
        },
        runBy: user.sub,
      }),
    );

    if (s.status === ScenarioStatus.DRAFT) {
      s.status = ScenarioStatus.CALCULATED;
      await this.scenarios.save(s);
    }
    return run;
  }

  async getRun(id: string) {
    const r = await this.runs.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy lần chạy');
    return r;
  }

  async listRuns(scenarioId: string) {
    return this.runs.find({ where: { scenarioId }, order: { version: 'DESC' } });
  }

  // ------- Phương án (UC-16) -------
  async listPlans(q: PaginationQuery) {
    const [data, total] = await this.plans.findAndCount({ order: { createdAt: 'DESC' }, skip: q.skip, take: q.size });
    return paginated(data, total, q);
  }

  async createPlan(dto: CreatePlanDto, user: AuthUser) {
    const dup = await this.plans.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã phương án ${dto.code}`);
    const run = await this.runs.findOne({ where: { id: dto.scenarioRunId } });
    if (!run) throw new NotFoundException('DATA-001: Không tìm thấy lần chạy tính toán');
    return this.plans.save(
      this.plans.create({
        code: dto.code,
        name: dto.name,
        scenarioRunId: dto.scenarioRunId,
        allocations: { metricsSnapshot: run.metrics },
        assumptions: dto.assumptions ?? null,
        status: ScenarioStatus.DRAFT,
        createdBy: user.sub,
      }),
    );
  }

  // So sánh nhiều phương án theo cùng một bộ tiêu chí.
  async comparePlans(dto: ComparePlansDto) {
    const plans = await this.plans.find({ where: { id: In(dto.planIds) } });
    return plans.map((p) => {
      const m = (p.allocations as { metricsSnapshot?: Record<string, unknown> })?.metricsSnapshot ?? {};
      return { id: p.id, code: p.code, name: p.name, status: p.status, metrics: m };
    });
  }

  async approvePlan(id: string, user: AuthUser) {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy phương án');
    if (p.status === ScenarioStatus.APPROVED || p.status === ScenarioStatus.LOCKED) {
      throw new ConflictException('WF-001: Phương án đã chốt — tạo bản thay thế nếu cần đổi');
    }
    p.status = ScenarioStatus.APPROVED;
    p.approvedBy = user.sub;
    return this.plans.save(p);
  }
}
