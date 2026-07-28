// Seed dữ liệu giả lập tối thiểu để đăng nhập thử (KHÔNG dùng ở PROD).
// Tạo 1 đơn vị cấp tỉnh + tài khoản demo cho từng vai trò chính.
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/roles';

async function run() {
  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);

  let province = await orgRepo.findOne({ where: { code: 'TINH-GL' } });
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({
        code: 'TINH-GL',
        name: 'Bộ CHQS tỉnh (giả lập)',
        type: 'PROVINCE',
        status: 'ACTIVE',
      }),
    );
    console.log('  + Tạo đơn vị cấp tỉnh:', province.code);
  }

  // Mật khẩu demo — chỉ dùng cho môi trường DEV dữ liệu giả lập.
  const demoUsers: Array<{ username: string; fullName: string; roles: Role[] }> = [
    { username: 'admin', fullName: 'Quản trị hệ thống', roles: [Role.SYS_ADMIN] },
    { username: 'chihuy', fullName: 'Chỉ huy tỉnh', roles: [Role.PROVINCIAL_COMMAND] },
    { username: 'hckt', fullName: 'Cán bộ ngành doanh trại', roles: [Role.BARRACKS_OFFICER] },
    { username: 'xa01', fullName: 'Cán bộ Ban CHQS xã A01', roles: [Role.COMMUNE_USER] },
    { username: 'kiemduyet', fullName: 'Kiểm duyệt viên', roles: [Role.REVIEWER] },
  ];

  const passwordHash = await bcrypt.hash('admin@123', 10);
  for (const u of demoUsers) {
    const existing = await userRepo.findOne({ where: { username: u.username } });
    if (existing) continue;
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
    console.log(`  + Tạo tài khoản demo: ${u.username} (${u.roles.join(', ')})`);
  }

  await dataSource.destroy();
  console.log('\n  Seed hoàn tất. Đăng nhập demo: admin / admin@123 (chỉ DEV).');
}

run().catch((err) => {
  console.error('Seed lỗi:', err);
  process.exit(1);
});
