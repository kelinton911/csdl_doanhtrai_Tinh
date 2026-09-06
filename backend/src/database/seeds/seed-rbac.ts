// Seed RBAC theo Chức vụ–Chức năng: danh mục chức năng (functions), chức vụ (positions),
// ma trận phân quyền (position_functions) ánh xạ từ 8 vai trò cũ, và BACKFILL user_positions
// từ users.roles[] để hệ thống đang chạy không gãy khi bật PermissionGuard.
// Idempotent: chạy lại nhiều lần an toàn. Không seed dữ liệu nghiệp vụ.
import 'reflect-metadata';
import dataSource from '../data-source';
import { AppFunction } from '../../modules/rbac/entities/app-function.entity';
import { Position } from '../../modules/rbac/entities/position.entity';
import { PositionFunction } from '../../modules/rbac/entities/position-function.entity';
import { UserPosition } from '../../modules/rbac/entities/user-position.entity';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/roles';
import {
  ActionType,
  FunctionScope,
  PositionScope,
} from '../../modules/rbac/rbac.enums';

type Action =
  | 'VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'EXPORT'
  | 'IMPORT';

// Danh mục module nghiệp vụ × hành động (khớp các module trong app.module).
const MODULES: Array<{ code: string; name: string; actions: Action[] }> = [
  { code: 'BARRACKS', name: 'Doanh trại', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] },
  { code: 'FACILITY', name: 'Công trình', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'LAND_PARCEL', name: 'Khu đất quốc phòng', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'IMPORT'] },
  { code: 'FAMILY_HOUSING', name: 'Khu gia đình', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'INVENTORY', name: 'Tồn kho', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'INSPECTION', name: 'Kiểm kê & kiểm tra', actions: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'] },
  { code: 'DOCUMENT', name: 'Tài liệu & minh chứng', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'MAINTENANCE', name: 'Bảo trì & khắc phục', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'SCENARIO', name: 'Phương án & kế hoạch', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'ALERT', name: 'Cảnh báo', actions: ['VIEW', 'UPDATE'] },
  { code: 'REPORT', name: 'Báo cáo & tra cứu', actions: ['VIEW', 'EXPORT'] },
  { code: 'INTEGRATION', name: 'Tích hợp & đồng bộ', actions: ['VIEW', 'CREATE', 'UPDATE'] },
  { code: 'MASTER_DATA', name: 'Danh mục chuẩn', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'PROJECT', name: 'Dự án đầu tư', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] },
  { code: 'BUDGET', name: 'Kế hoạch & ngân sách', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] },
  { code: 'TASK', name: 'Kế hoạch công tác', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'OVERSIGHT', name: 'Kiểm tra, thanh tra', actions: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'] },
  { code: 'LEGAL_DOC', name: 'Văn bản, định mức', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'READINESS', name: 'Sẵn sàng chiến đấu', actions: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE'] },
  { code: 'LOCAL_RESOURCE', name: 'Nguồn lực địa phương', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'ANALYTICS', name: 'Phân tích & dự báo', actions: ['VIEW', 'EXPORT'] },
  { code: 'ORGANIZATION', name: 'Đơn vị & địa bàn', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'USER', name: 'Tài khoản', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
  { code: 'RBAC', name: 'Phân quyền (chức vụ/chức năng)', actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] },
];

const ACTION_LABEL: Record<Action, string> = {
  VIEW: 'Xem',
  CREATE: 'Thêm',
  UPDATE: 'Sửa',
  DELETE: 'Xóa',
  APPROVE: 'Duyệt',
  EXPORT: 'Xuất',
  IMPORT: 'Nhập',
};

// Module quản trị (chỉ SYS_ADMIN đụng tới).
const ADMIN_MODULES = new Set(['USER', 'RBAC', 'ORGANIZATION']);

interface FnMeta {
  code: string;
  name: string;
  module: string;
  actionType: Action;
  isCritical: boolean;
}

function buildFunctions(): FnMeta[] {
  const out: FnMeta[] = [];
  for (const m of MODULES) {
    for (const a of m.actions) {
      out.push({
        code: `${m.code}_${a}`,
        name: `${ACTION_LABEL[a]} ${m.name.toLowerCase()}`,
        module: m.code,
        actionType: a,
        isCritical: a === 'DELETE' || a === 'APPROVE' || ADMIN_MODULES.has(m.code),
      });
    }
  }
  return out;
}

// Ánh xạ 8 vai trò cũ → chức vụ. code chức vụ = giá trị Role để backfill khớp trực tiếp.
interface PositionSeed {
  code: string;
  name: string;
  scope: PositionScope;
  level: number;
  // Chọn chức năng được gán + scope tương ứng.
  grants: (fn: FnMeta) => FunctionScope | null;
}

const DOMAIN = (fn: FnMeta) => !ADMIN_MODULES.has(fn.module);

const POSITIONS: PositionSeed[] = [
  {
    code: Role.SYS_ADMIN,
    name: 'Quản trị hệ thống',
    scope: PositionScope.SYSTEM,
    level: 0,
    grants: () => FunctionScope.ALL, // Toàn quyền
  },
  {
    code: Role.PROVINCIAL_COMMAND,
    name: 'Chỉ huy tỉnh',
    scope: PositionScope.PROVINCE,
    level: 1,
    // Xem tất cả + duyệt + xuất báo cáo/phân tích, phạm vi toàn tỉnh.
    grants: (fn) =>
      DOMAIN(fn) &&
      (fn.actionType === 'VIEW' ||
        fn.actionType === 'APPROVE' ||
        fn.actionType === 'EXPORT')
        ? FunctionScope.PROVINCE
        : null,
  },
  {
    code: Role.BARRACKS_OFFICER,
    name: 'Trợ lý doanh trại (ngành HC-KT)',
    scope: PositionScope.PROVINCE,
    level: 2,
    // Tác nghiệp toàn bộ nghiệp vụ (trừ duyệt), phạm vi tỉnh.
    grants: (fn) =>
      DOMAIN(fn) && fn.actionType !== 'APPROVE' ? FunctionScope.PROVINCE : null,
  },
  {
    code: Role.COMMUNE_USER,
    name: 'Cán bộ Ban CHQS xã/phường',
    scope: PositionScope.UNIT,
    level: 3,
    // Khai báo trong phạm vi đơn vị mình: xem + thêm/sửa/xuất mọi nghiệp vụ; KHÔNG xóa, KHÔNG duyệt.
    grants: (fn) => {
      if (!DOMAIN(fn)) return null;
      if (fn.actionType === 'DELETE' || fn.actionType === 'APPROVE') return null;
      return FunctionScope.UNIT;
    },
  },
  {
    code: Role.REVIEWER,
    name: 'Kiểm duyệt viên',
    scope: PositionScope.PROVINCE,
    level: 2,
    grants: (fn) =>
      DOMAIN(fn) && (fn.actionType === 'VIEW' || fn.actionType === 'APPROVE')
        ? FunctionScope.PROVINCE
        : null,
  },
  {
    code: Role.REPORT_VIEWER,
    name: 'Người xem báo cáo',
    scope: PositionScope.PROVINCE,
    level: 4,
    grants: (fn) =>
      DOMAIN(fn) && (fn.actionType === 'VIEW' || fn.actionType === 'EXPORT')
        ? FunctionScope.PROVINCE
        : null,
  },
  {
    code: Role.AUDITOR,
    name: 'Cán bộ kiểm tra - thanh tra',
    scope: PositionScope.PROVINCE,
    level: 2,
    grants: (fn) => {
      if (fn.module === 'OVERSIGHT') return FunctionScope.PROVINCE;
      if (DOMAIN(fn) && (fn.actionType === 'VIEW' || fn.actionType === 'EXPORT'))
        return FunctionScope.PROVINCE;
      return null;
    },
  },
  {
    code: Role.INTEGRATION_CLIENT,
    name: 'Client tích hợp (hệ thống ngoài)',
    scope: PositionScope.SYSTEM,
    level: 5,
    grants: (fn) => {
      if (fn.module === 'INTEGRATION') return FunctionScope.ALL;
      if (fn.actionType === 'VIEW' && DOMAIN(fn)) return FunctionScope.PROVINCE;
      return null;
    },
  },
];

async function run() {
  await dataSource.initialize();
  const fnRepo = dataSource.getRepository(AppFunction);
  const posRepo = dataSource.getRepository(Position);
  const pfRepo = dataSource.getRepository(PositionFunction);
  const upRepo = dataSource.getRepository(UserPosition);
  const userRepo = dataSource.getRepository(User);

  // 1) Chức năng (upsert theo code).
  const fns = buildFunctions();
  const fnByCode = new Map<string, AppFunction>();
  for (const f of fns) {
    let row = await fnRepo.findOne({ where: { code: f.code } });
    if (!row) {
      row = await fnRepo.save(
        fnRepo.create({
          code: f.code,
          name: f.name,
          module: f.module,
          actionType: f.actionType as ActionType,
          isCritical: f.isCritical,
          isActive: true,
        }),
      );
    }
    fnByCode.set(f.code, row);
  }
  console.log(`  + Chức năng: ${fns.length}`);

  // 2) Chức vụ (upsert theo code) + 3) ma trận position_functions (thay thế cho chức vụ seeded).
  for (const p of POSITIONS) {
    let pos = await posRepo.findOne({ where: { code: p.code } });
    if (!pos) {
      pos = await posRepo.save(
        posRepo.create({
          code: p.code,
          name: p.name,
          positionScope: p.scope,
          level: p.level,
          isActive: true,
        }),
      );
    }

    await pfRepo.delete({ positionId: pos.id });
    const rows: PositionFunction[] = [];
    for (const f of fns) {
      const scope = p.grants(f);
      if (!scope) continue;
      const fnRow = fnByCode.get(f.code)!;
      rows.push(
        pfRepo.create({
          positionId: pos.id,
          functionId: fnRow.id,
          scope,
          isActive: true,
        }),
      );
    }
    if (rows.length) await pfRepo.save(rows);
    console.log(`  + Chức vụ ${p.code}: ${rows.length} chức năng`);
  }

  // 4) BACKFILL user_positions từ users.roles[] (idempotent).
  const posByCode = new Map(
    (await posRepo.find()).map((p) => [p.code, p]),
  );
  const users = await userRepo.find();
  let created = 0;
  for (const u of users) {
    const roles = u.roles ?? [];
    for (let i = 0; i < roles.length; i++) {
      const pos = posByCode.get(roles[i]);
      if (!pos) continue;
      const exists = await upRepo.findOne({
        where: { userId: u.id, positionId: pos.id },
      });
      if (exists) continue;
      await upRepo.save(
        upRepo.create({
          userId: u.id,
          positionId: pos.id,
          organizationId: u.organizationId ?? null,
          isPrimary: i === 0,
          startDate: new Date(),
          notes: 'Backfill từ roles[] (seed-rbac)',
          isActive: true,
        }),
      );
      created++;
    }
  }
  console.log(`  + Backfill bổ nhiệm: ${created} (từ ${users.length} tài khoản)`);

  await dataSource.destroy();
  console.log('\n  Seed RBAC hoàn tất.');
}

run().catch((err) => {
  console.error('Seed RBAC lỗi:', err);
  process.exit(1);
});
