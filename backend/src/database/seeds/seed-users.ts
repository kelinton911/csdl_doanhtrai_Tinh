// Seed lại BỘ TÀI KHOẢN demo/kiểm thử (mỗi vai trò một tài khoản) — phục vụ "đăng nhập nhanh"
// trên trang Login. Idempotent + tự chữa: nếu tài khoản đã tồn tại thì RESET mật khẩu về chuẩn,
// MỞ KHÓA (status ACTIVE, xóa lockedUntil/failedAttempts) và đảm bảo đúng vai trò — nhưng GIỮ
// NGUYÊN organizationId/dataScopes đã gán (không ghi đè phạm vi của tài khoản cấp xã).
// Chạy: npm run seed:users  (nên chạy tiếp `npm run seed:rbac` để backfill chức vụ RBAC).
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/roles';

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'admin@123';

// Danh sách khớp với DEMO_ACCOUNTS ở webapp/src/pages/LoginPage.tsx.
const USERS: Array<{ username: string; fullName: string; roles: Role[] }> = [
  { username: 'admin', fullName: 'Quản trị hệ thống', roles: [Role.SYS_ADMIN] },
  { username: 'chihuy', fullName: 'Chỉ huy tỉnh', roles: [Role.PROVINCIAL_COMMAND] },
  { username: 'hckt', fullName: 'Cán bộ ngành doanh trại', roles: [Role.BARRACKS_OFFICER] },
  { username: 'xa01', fullName: 'Cán bộ Ban CHQS xã A01', roles: [Role.COMMUNE_USER] },
  { username: 'kiemduyet', fullName: 'Kiểm duyệt viên', roles: [Role.REVIEWER] },
  { username: 'kiemtra', fullName: 'Cán bộ kiểm tra - thanh tra', roles: [Role.AUDITOR] },
  { username: 'baocao', fullName: 'Người xem báo cáo', roles: [Role.REPORT_VIEWER] },
];

async function run() {
  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);

  // Đơn vị cấp tỉnh để gán cho tài khoản mới (ưu tiên TINH-GL, nếu không có lấy PROVINCE bất kỳ, rồi tạo).
  let province =
    (await orgRepo.findOne({ where: { code: 'TINH-GL' } })) ||
    (await orgRepo.findOne({ where: { type: 'PROVINCE' } }));
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({ code: 'TINH-GL', name: 'Bộ CHQS tỉnh (demo)', type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log('  + Tạo đơn vị cấp tỉnh:', province.code);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let created = 0;
  let healed = 0;
  for (const u of USERS) {
    const existing = await userRepo.findOne({ where: { username: u.username } });
    if (!existing) {
      await userRepo.save(
        userRepo.create({
          username: u.username,
          passwordHash,
          fullName: u.fullName,
          roles: u.roles,
          organizationId: province.id,
          status: 'ACTIVE',
        }),
      );
      created++;
      console.log(`  + Tạo tài khoản: ${u.username} (${u.roles.join(', ')})`);
    } else {
      // Tự chữa: reset mật khẩu + mở khóa + đảm bảo vai trò. Giữ nguyên phạm vi dữ liệu.
      existing.passwordHash = passwordHash;
      existing.status = 'ACTIVE';
      existing.failedAttempts = 0;
      existing.lockedUntil = null;
      existing.roles = u.roles;
      if (!existing.organizationId) existing.organizationId = province.id;
      await userRepo.save(existing);
      healed++;
      console.log(`  = Reset & mở khóa: ${u.username}`);
    }
  }

  await dataSource.destroy();
  console.log(`\n  Seed tài khoản hoàn tất: tạo ${created}, cập nhật ${healed}. Mật khẩu chung: ${DEFAULT_PASSWORD}`);
  console.log('  → Chạy tiếp `npm run seed:rbac` để backfill chức vụ (nếu có tài khoản mới).');
}

run().catch((err) => {
  console.error('Seed tài khoản lỗi:', err);
  process.exit(1);
});
