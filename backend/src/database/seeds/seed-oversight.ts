// Seed M22 — Kiểm tra/thanh tra + phát hiện/kiến nghị trên nền doanh trại/địa bàn THẬT (Thanh Hóa).
// Đủ trạng thái cuộc kiểm tra + kiến nghị (một số quá hạn khắc phục để test cảnh báo).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Inspection } from '../../modules/oversight/entities/inspection.entity';
import { InspectionFinding } from '../../modules/oversight/entities/inspection-finding.entity';

let s = 20260836;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const dstr = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => new Date(Date.now() + n * 86400000);

const TYPES = ['PERIODIC', 'SURPRISE', 'THEMATIC', 'AUDIT'];
const FINDING_TITLES = [
  'Hồ sơ pháp lý khu đất chưa đầy đủ',
  'Công trình xuống cấp chưa lập kế hoạch sửa chữa',
  'Sổ sách kho chưa khớp thực tế kiểm kê',
  'Chưa cập nhật hồ sơ doanh trại điện tử',
  'Máy phát điện dự phòng quá hạn bảo dưỡng',
  'Chứng từ giải ngân thiếu phê duyệt',
];
const SEV = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

async function run() {
  await dataSource.initialize();
  const insp = dataSource.getRepository(Inspection);
  const fnd = dataSource.getRepository(InspectionFinding);

  const orgId = (await dataSource.query(`SELECT id FROM organizations WHERE code='TINH-GL' LIMIT 1`))?.[0]?.id ?? null;
  const barracks: Array<{ id: string; name: string; area_id: string | null }> = await dataSource.query(`SELECT id, name, area_id FROM barracks ORDER BY code LIMIT 10`);

  const defs = [
    { code: 'KT-2026-001', title: 'Kiểm tra công tác doanh trại định kỳ', status: 'CLOSED' },
    { code: 'KT-2026-002', title: 'Thanh tra quản lý đất quốc phòng', status: 'REPORTED' },
    { code: 'KT-2026-003', title: 'Kiểm tra đột xuất kho vật chất', status: 'IN_PROGRESS' },
    { code: 'KT-2026-004', title: 'Kiểm tra chuyên đề điện - nước', status: 'IN_PROGRESS' },
    { code: 'KT-2026-005', title: 'Kiểm tra công tác doanh trại cấp xã', status: 'PLANNED' },
    { code: 'KT-2026-006', title: 'Kiểm toán ngân sách sửa chữa', status: 'PLANNED' },
  ];

  let ci = 0, cf = 0, skipped = 0;
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (await insp.findOne({ where: { code: def.code } })) { skipped++; continue; }
    const b = barracks[i % Math.max(barracks.length, 1)] ?? null;
    const started = def.status !== 'PLANNED';
    const ended = def.status === 'REPORTED' || def.status === 'CLOSED';
    const rec = await insp.save(insp.create({
      code: def.code, title: `${def.title} — ${b ? b.name : 'Bộ CHQS tỉnh'}`,
      inspectionType: pick(TYPES), scope: 'Nội dung theo kế hoạch kiểm tra (dữ liệu mẫu).',
      targetOrgId: orgId, targetAreaId: b?.area_id ?? null, targetBarracksId: b?.id ?? null,
      leadName: pick(['Đ/c Trưởng đoàn A', 'Đ/c Phó Chỉ huy trưởng', 'Đ/c Trưởng ban HC-KT']),
      teamNote: 'Đoàn kiểm tra gồm 3-5 đồng chí.',
      plannedDate: dstr(days(-(20 + i * 5))),
      startDate: started ? dstr(days(-(15 + i * 4))) : null,
      endDate: ended ? dstr(days(-(5 + i * 3))) : null,
      status: def.status,
      conclusion: ended ? 'Cơ bản chấp hành tốt; còn một số tồn tại cần khắc phục (dữ liệu mẫu).' : null,
      createdBy: null, updatedBy: null,
    }));
    ci++;

    // Phát hiện/kiến nghị cho cuộc đã tiến hành.
    if (started) {
      const n = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const overdue = rnd() < 0.4;
        const roll = rnd();
        const status = def.status === 'CLOSED' ? (roll < 0.7 ? 'ACCEPTED' : 'RESOLVED') : roll < 0.3 ? 'RESOLVED' : roll < 0.6 ? 'IN_PROGRESS' : 'OPEN';
        await fnd.save(fnd.create({
          inspectionId: rec.id,
          title: pick(FINDING_TITLES),
          severity: pick(SEV),
          recommendation: 'Yêu cầu đơn vị khắc phục theo quy định, báo cáo kết quả.',
          responsibleOrgId: orgId, responsibleAreaId: b?.area_id ?? null,
          dueDate: dstr(days(overdue ? -(3 + Math.floor(rnd() * 30)) : 15 + Math.floor(rnd() * 40))),
          status,
          resolutionNote: status === 'RESOLVED' || status === 'ACCEPTED' ? 'Đã khắc phục theo kiến nghị.' : null,
          resolvedAt: status === 'RESOLVED' || status === 'ACCEPTED' ? days(-(1 + Math.floor(rnd() * 10))) : null,
          linkedEntityType: b ? 'barracks' : null, linkedEntityId: b?.id ?? null,
          createdBy: null,
        }));
        cf++;
      }
    }
  }

  console.log(`M22 seed kiểm tra/thanh tra: +${ci} cuộc kiểm tra (bỏ qua ${skipped}), +${cf} phát hiện/kiến nghị.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
