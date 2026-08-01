// Seed M21 — Kế hoạch công tác & nhiệm vụ trên nền tổ chức/địa bàn THẬT (Thanh Hóa):
// kế hoạch cha + nhiệm vụ con giao xuống xã/đơn vị, đủ trạng thái, có nhiệm vụ quá hạn (cảnh báo).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Task } from '../../modules/tasks/entities/task.entity';

let s = 20260831;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const dstr = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

const SUB_TITLES = [
  'Rà soát, cập nhật hồ sơ doanh trại',
  'Kiểm kê vật chất doanh trại quý',
  'Báo cáo hiện trạng điện - nước',
  'Khảo sát nguồn lực huy động trên địa bàn',
  'Lập dự toán sửa chữa nhỏ',
  'Cập nhật mốc giới khu đất quốc phòng',
  'Chụp ảnh hiện trạng công trình xuống cấp',
  'Đối chiếu số liệu tồn kho với sổ sách',
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Task);

  const orgId = (await dataSource.query(`SELECT id FROM organizations WHERE code='TINH-GL' LIMIT 1`))?.[0]?.id ?? null;
  const communes: Array<{ id: string; name: string }> = await dataSource.query(`SELECT id, name FROM administrative_areas WHERE level='COMMUNE' ORDER BY code LIMIT 12`);
  const hckt = (await dataSource.query(`SELECT id FROM users WHERE username='hckt' LIMIT 1`))?.[0]?.id ?? null;

  let created = 0, skipped = 0;
  const mk = async (t: Partial<Task> & { code: string }) => {
    if (await repo.findOne({ where: { code: t.code } })) { skipped++; return null; }
    const saved = await repo.save(repo.create({
      title: '', category: 'OTHER', priority: 'NORMAL', status: 'ASSIGNED', progressPercent: 0,
      assignerOrgId: orgId, createdBy: null, updatedBy: null, ...t,
    }));
    created++;
    return saved;
  };

  // Kế hoạch công tác cấp Tỉnh (nhiệm vụ cha) + nhiệm vụ con giao xuống xã.
  const plans = [
    { code: 'KH-2026-Q3', title: 'Kế hoạch công tác doanh trại Quý III/2026', cat: 'PLAN' },
    { code: 'KH-2026-KK', title: 'Kế hoạch kiểm kê vật chất doanh trại toàn tỉnh 2026', cat: 'PLAN' },
  ];
  for (const pl of plans) {
    const parent = await mk({ code: pl.code, title: pl.title, category: pl.cat, priority: 'HIGH', status: 'IN_PROGRESS', progressPercent: 40, assigneeOrgId: orgId, dueDate: dstr(daysFromNow(60)) });
    const pid = parent?.id ?? (await repo.findOne({ where: { code: pl.code } }))?.id ?? null;
    // 5 nhiệm vụ con giao xuống các xã.
    for (let i = 0; i < 5; i++) {
      const commune = communes[i % Math.max(communes.length, 1)] ?? null;
      const roll = rnd();
      const status = roll < 0.25 ? 'ASSIGNED' : roll < 0.55 ? 'IN_PROGRESS' : roll < 0.75 ? 'SUBMITTED' : 'COMPLETED';
      const overdue = rnd() < 0.3 && status !== 'COMPLETED';
      const progress = status === 'COMPLETED' ? 100 : status === 'SUBMITTED' ? 90 : status === 'IN_PROGRESS' ? 40 + Math.floor(rnd() * 40) : 0;
      await mk({
        code: `${pl.code}-${String(i + 1).padStart(2, '0')}`,
        title: `${pick(SUB_TITLES)} — ${commune ? commune.name : 'đơn vị'}`,
        description: 'Dữ liệu mẫu (seed).',
        category: pick(['DECLARATION', 'INSPECTION_TASK', 'REPORT']),
        priority: pick(['NORMAL', 'NORMAL', 'HIGH']),
        status, progressPercent: progress,
        assigneeAreaId: commune?.id ?? null,
        parentTaskId: pid,
        dueDate: dstr(daysFromNow(overdue ? -(3 + Math.floor(rnd() * 30)) : 10 + Math.floor(rnd() * 40))),
        completedAt: status === 'COMPLETED' ? daysFromNow(-(1 + Math.floor(rnd() * 10))) : null,
      });
    }
  }

  // Vài nhiệm vụ độc lập giao cho cán bộ ngành doanh trại (có quá hạn).
  for (let i = 0; i < 4; i++) {
    const overdue = i < 2;
    await mk({
      code: `NV-2026-${String(i + 1).padStart(3, '0')}`,
      title: `${pick(SUB_TITLES)} (giao cán bộ ngành)`,
      category: pick(['MAINTENANCE', 'CONSTRUCTION', 'REPORT']),
      priority: overdue ? 'URGENT' : 'NORMAL',
      status: overdue ? 'IN_PROGRESS' : 'ASSIGNED',
      progressPercent: overdue ? 55 : 0,
      assigneeUserId: hckt,
      dueDate: dstr(daysFromNow(overdue ? -(2 + i * 5) : 20)),
    });
  }

  console.log(`M21 seed nhiệm vụ: +${created} nhiệm vụ (bỏ qua ${skipped}).`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
