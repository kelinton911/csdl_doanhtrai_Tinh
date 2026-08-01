// Seed M13 — Dự án XDCB/sửa chữa trên nền doanh trại THẬT (Thanh Hóa): đủ giai đoạn vòng đời,
// nguồn vốn, dự toán, mốc tiến độ & giải ngân; có dự án chậm tiến độ và vượt vốn để test cảnh báo.
import 'reflect-metadata';
import dataSource from '../data-source';
import { Project } from '../../modules/projects/entities/project.entity';
import { ProjectMilestone } from '../../modules/projects/entities/project-milestone.entity';

let s = 20260821;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const dstr = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

const TYPES = ['NEW_BUILD', 'RENOVATION', 'REPAIR', 'UPGRADE', 'INFRASTRUCTURE'];
const FUNDS = ['DEFENSE_BUDGET', 'STATE_BUDGET', 'LOCAL'];
const NAMES = ['Cải tạo nhà làm việc', 'Xây mới nhà ở chiến sĩ', 'Sửa chữa hệ thống điện', 'Nâng cấp nhà ăn - nhà bếp',
  'Xây dựng nhà kho', 'Cải tạo hội trường', 'Nâng cấp đường nội bộ', 'Xây mới nhà xe', 'Sửa chữa mái nhà trực'];
const CONTRACTORS = ['Công ty CP XD Sông Mã', 'Công ty TNHH XD Hồng Đức', 'DN Xây lắp Thành Đô', 'Công ty CP Đầu tư Lam Sơn'];
// Kịch bản theo giai đoạn: [phase, progress, hasContract, delayed?]
const SCENARIOS: Array<{ phase: string; progress: number; contract: boolean; delayed?: boolean; overBudget?: boolean }> = [
  { phase: 'PROPOSAL', progress: 0, contract: false },
  { phase: 'DESIGN', progress: 5, contract: false },
  { phase: 'BIDDING', progress: 10, contract: false },
  { phase: 'CONTRACTED', progress: 15, contract: true },
  { phase: 'IN_PROGRESS', progress: 45, contract: true },
  { phase: 'IN_PROGRESS', progress: 70, contract: true, delayed: true },
  { phase: 'IN_PROGRESS', progress: 60, contract: true, overBudget: true },
  { phase: 'ACCEPTANCE', progress: 95, contract: true },
  { phase: 'HANDED_OVER', progress: 100, contract: true },
  { phase: 'CLOSED', progress: 100, contract: true },
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Project);
  const msRepo = dataSource.getRepository(ProjectMilestone);

  const barracks: Array<{ id: string; area_id: string | null; organization_id: string | null; name: string; loc: string | null }> =
    await dataSource.query(`SELECT id, area_id, organization_id, name, ST_AsGeoJSON(location) AS loc FROM barracks ORDER BY code LIMIT 18`);

  let created = 0, skipped = 0, milestones = 0;
  for (let i = 0; i < 18; i++) {
    const code = `DA-2026-${String(i + 1).padStart(3, '0')}`;
    if (await repo.findOne({ where: { code } })) { skipped++; continue; }
    const b = barracks[i % Math.max(barracks.length, 1)] ?? null;
    const sc = SCENARIOS[i % SCENARIOS.length];
    const estimate = Math.round((0.8 + rnd() * 6) * 1e9); // 0.8–6.8 tỷ
    const approved = sc.overBudget ? Math.round(estimate * 0.6) : Math.round(estimate * (0.9 + rnd() * 0.1));
    const start = daysFromNow(-(120 + Math.floor(rnd() * 240)));
    const plannedEnd = sc.delayed ? daysFromNow(-(10 + Math.floor(rnd() * 60))) : daysFromNow(30 + Math.floor(rnd() * 180));
    const loc = b?.loc ? JSON.parse(b.loc) : null;

    const proj = await repo.save(repo.create({
      code,
      name: `${pick(NAMES)} — ${b ? b.name : 'Bộ CHQS tỉnh'}`,
      projectType: pick(TYPES),
      barracksId: b?.id ?? null,
      areaId: b?.area_id ?? null,
      organizationId: b?.organization_id ?? null,
      fundingSource: pick(FUNDS),
      totalEstimate: estimate.toString(),
      approvedCapital: approved.toString(),
      contractorName: sc.contract ? pick(CONTRACTORS) : null,
      contractNo: sc.contract ? `HĐ-${2025 + (i % 2)}/${100 + i}` : null,
      contractValue: sc.contract ? Math.round(approved * (0.9 + rnd() * 0.08)).toString() : '0',
      contractSignedDate: sc.contract ? dstr(daysFromNow(-(90 + Math.floor(rnd() * 120)))) : null,
      startDate: sc.contract ? dstr(start) : null,
      plannedEndDate: dstr(plannedEnd),
      actualEndDate: sc.phase === 'HANDED_OVER' || sc.phase === 'CLOSED' ? dstr(daysFromNow(-(5 + Math.floor(rnd() * 30)))) : null,
      progressPercent: sc.progress,
      phase: sc.phase,
      description: 'Dữ liệu mẫu (seed) — cần đối chiếu hồ sơ dự án gốc.',
      location: loc,
      createdBy: null,
      updatedBy: null,
    }));
    created++;

    // Mốc tiến độ + giải ngân cho dự án đã thi công.
    if (sc.contract && sc.progress >= 15) {
      const steps = Math.max(1, Math.round(sc.progress / 30));
      for (let k = 1; k <= steps; k++) {
        const pct = Math.min(sc.progress, k * 30);
        await msRepo.save(msRepo.create({ projectId: proj.id, title: `Hoàn thành ~${pct}% khối lượng`, milestoneDate: dstr(daysFromNow(-(80 - k * 20))), kind: 'PROGRESS', progressPercent: pct, amount: null, note: null, createdBy: null }));
        milestones++;
        // Giải ngân theo đợt.
        const pay = sc.overBudget ? Math.round(approved * 0.75) : Math.round((approved / (steps + 1)) * k);
        await msRepo.save(msRepo.create({ projectId: proj.id, title: `Giải ngân đợt ${k}`, milestoneDate: dstr(daysFromNow(-(75 - k * 20))), kind: 'PAYMENT', progressPercent: null, amount: pay.toString(), note: null, createdBy: null }));
        milestones++;
      }
    }
  }

  console.log(`M13 seed dự án XDCB: +${created} dự án (bỏ qua ${skipped}), +${milestones} mốc.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
