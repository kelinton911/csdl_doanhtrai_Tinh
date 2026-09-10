// [00] NỀN + ĐỊA BÀN — anchor Tỉnh Thanh Hóa (mã '38').
// - Bộ CHQS tỉnh Thanh Hoá (DV-38) + Ban CHQS cho CẢ 166 xã/phường (DV-<mã xã>).
// - Tài khoản demo 7 vai + 4 tài khoản cán bộ xã đại diện (data-scope theo area).
// Điều kiện: GIS Thanh Hóa đã nạp (administrative_areas có tỉnh '38' + xã). RBAC/C3 do
// orchestrator run-all chạy (seed:rbac, seed:c3-catalog). Idempotent theo code/username.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Organization } from '../../../modules/identity/entities/organization.entity';
import { User } from '../../../modules/identity/entities/user.entity';
import { Role } from '../../../modules/identity/roles';
import { standalone } from './_shared/run-step';
import { PROVINCE_AREA_CODE, PROVINCE_ORG_CODE, PREFERRED_COMMUNE_CODES } from './_shared/demo-ids';

export async function run(ds: DataSource): Promise<void> {
  const orgRepo = ds.getRepository(Organization);
  const userRepo = ds.getRepository(User);

  // 1) Xác nhận địa bàn tỉnh Thanh Hóa đã có (do GIS nạp).
  const prov = await ds.query(
    `SELECT id, name FROM administrative_areas WHERE code = $1 AND level = 'PROVINCE' LIMIT 1`,
    [PROVINCE_AREA_CODE],
  );
  if (!prov?.[0]) {
    throw new Error(
      `Chưa có địa bàn Tỉnh Thanh Hóa (code=${PROVINCE_AREA_CODE}). Hãy nạp GIS trước ` +
        `(npm run seed:geojson -- <provinces> <thanh_hoa_communes>).`,
    );
  }
  const provName: string = prov[0].name;

  // 2) Đơn vị cấp tỉnh (Bộ CHQS tỉnh Thanh Hoá).
  let provinceOrg = await orgRepo.findOne({ where: { code: PROVINCE_ORG_CODE } });
  if (!provinceOrg) {
    provinceOrg = await orgRepo.save(
      orgRepo.create({ code: PROVINCE_ORG_CODE, name: `Bộ CHQS ${provName}`, type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log(`  + Đơn vị tỉnh: ${PROVINCE_ORG_CODE} — ${provinceOrg.name}`);
  }

  // 3) Ban CHQS cho TOÀN BỘ xã/phường của tỉnh (idempotent).
  const communes: Array<{ id: string; code: string; name: string }> = await ds.query(
    `SELECT id, code, name FROM administrative_areas
      WHERE province_code = $1 AND level <> 'PROVINCE' ORDER BY code`,
    [PROVINCE_AREA_CODE],
  );
  const existingRows: Array<{ code: string }> = await ds.query('SELECT code FROM organizations');
  const existingCodes: Set<string> = new Set(existingRows.map((o) => o.code));
  const toCreate: Organization[] = [];
  for (const c of communes) {
    const orgCode = `DV-${c.code}`;
    if (existingCodes.has(orgCode)) continue;
    toCreate.push(
      orgRepo.create({ code: orgCode, name: `Ban CHQS ${c.name}`, type: 'COMMUNE', parentId: provinceOrg.id, status: 'ACTIVE' }),
    );
  }
  if (toCreate.length) await orgRepo.save(toCreate, { chunk: 100 });

  // Gắn lại CHA về Bộ CHQS tỉnh cho mọi org xã TH (kể cả org tạo ở lượt seed cũ dưới đơn vị khác).
  const reparent = await ds.query(
    `UPDATE organizations SET parent_id = $1, type = 'COMMUNE'
      WHERE code IN (SELECT 'DV-' || code FROM administrative_areas WHERE province_code = $2 AND level <> 'PROVINCE')
        AND parent_id IS DISTINCT FROM $1`,
    [provinceOrg.id, PROVINCE_AREA_CODE],
  );
  const reparented = Array.isArray(reparent) ? reparent[1] ?? 0 : 0;
  console.log(`  + Ban CHQS xã/phường: +${toCreate.length} mới · gắn lại cha ${reparented} (tổng địa bàn ${communes.length})`);

  // 4) Tài khoản demo 7 vai (org = tỉnh).
  const passwordHash = await bcrypt.hash('admin@123', 10);
  const demoUsers: Array<{ username: string; fullName: string; roles: Role[] }> = [
    { username: 'admin', fullName: 'Quản trị hệ thống', roles: [Role.SYS_ADMIN] },
    { username: 'chihuy', fullName: 'Chỉ huy Bộ CHQS tỉnh Thanh Hoá', roles: [Role.PROVINCIAL_COMMAND] },
    { username: 'hckt', fullName: 'Cán bộ ngành doanh trại', roles: [Role.BARRACKS_OFFICER] },
    { username: 'kiemduyet', fullName: 'Kiểm duyệt viên', roles: [Role.REVIEWER] },
    { username: 'kiemtra', fullName: 'Cán bộ kiểm tra - thanh tra', roles: [Role.AUDITOR] },
    { username: 'baocao', fullName: 'Người xem báo cáo', roles: [Role.REPORT_VIEWER] },
  ];
  for (const u of demoUsers) {
    if (await userRepo.findOne({ where: { username: u.username } })) continue;
    await userRepo.save(
      userRepo.create({ username: u.username, passwordHash, fullName: u.fullName, roles: u.roles, organizationId: provinceOrg.id, status: 'ACTIVE' }),
    );
    console.log(`  + Tài khoản: ${u.username}`);
  }

  // 5) Tài khoản cán bộ xã đại diện (data-scope theo area) — gán vào xã ưu tiên nếu có.
  let scoped = 0;
  for (let i = 0; i < PREFERRED_COMMUNE_CODES.length; i++) {
    const areaCode = PREFERRED_COMMUNE_CODES[i];
    const areaRow = communes.find((c) => c.code === areaCode);
    if (!areaRow) continue;
    const org = await orgRepo.findOne({ where: { code: `DV-${areaCode}` } });
    if (!org) continue;
    const username = `xa_${areaCode}`;
    if (await userRepo.findOne({ where: { username } })) continue;
    await userRepo.save(
      userRepo.create({
        username,
        passwordHash,
        fullName: `Cán bộ Ban CHQS ${areaRow.name}`,
        roles: [Role.COMMUNE_USER],
        organizationId: org.id,
        dataScopes: [{ type: 'AREA', refId: areaRow.id }],
        status: 'ACTIVE',
      }),
    );
    scoped++;
  }
  if (scoped) console.log(`  + Tài khoản xã đại diện: +${scoped}`);

  console.log('  [00] Nền + địa bàn Thanh Hóa xong. Đăng nhập demo: admin / admin@123 (chỉ DEV).');
}

if (require.main === module) standalone(run);
