// Nạp dữ liệu ĐỊA BÀN THẬT (Tỉnh + Xã/Phường/Đặc khu) từ `real-areas.data.ts`.
// Idempotent: chỉ chèn khi chưa tồn tại `code`; chạy lại an toàn. KHÔNG động tới dữ liệu nghiệp vụ.
// Chạy: `npm run seed:real` (sau khi đã điền real-areas.data.ts và migration đã chạy).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';
import {
  REAL_PROVINCE,
  REAL_AREAS,
  createUnitPerArea,
} from './real-areas.data';

async function run() {
  // Chặn chạy khi chưa có dữ liệu — tránh nạp rỗng/nửa vời.
  if (!REAL_PROVINCE.code || !REAL_PROVINCE.name) {
    throw new Error(
      'real-areas.data.ts: REAL_PROVINCE chưa được điền (code/name). Điền tỉnh mục tiêu trước khi chạy.',
    );
  }
  if (REAL_AREAS.length === 0) {
    throw new Error(
      'real-areas.data.ts: REAL_AREAS rỗng. Điền danh sách xã/phường/đặc khu chính thức trước khi chạy.',
    );
  }

  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const areaRepo = dataSource.getRepository(AdministrativeArea);

  // 1) Đơn vị cấp tỉnh (PROVINCE) — idempotent theo code.
  let province = await orgRepo.findOne({ where: { code: REAL_PROVINCE.code } });
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({ code: REAL_PROVINCE.code, name: REAL_PROVINCE.name, type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log('  + Tỉnh:', province.code, '-', province.name);
  } else {
    console.log('  = Tỉnh đã có:', province.code);
  }

  // 2) Địa bàn (xã/phường/đặc khu) + (tùy chọn) đơn vị Ban CHQS tương ứng.
  let added = 0;
  let addedUnits = 0;
  for (const a of REAL_AREAS) {
    if (!(await areaRepo.findOne({ where: { code: a.code } }))) {
      await areaRepo.save(areaRepo.create({ code: a.code, name: a.name, type: a.type, status: 'ACTIVE' }));
      added++;
    }
    if (createUnitPerArea) {
      const orgCode = `DV-${a.code}`;
      if (!(await orgRepo.findOne({ where: { code: orgCode } }))) {
        await orgRepo.save(orgRepo.create({ code: orgCode, name: `Ban CHQS ${a.name}`, type: 'COMMUNE', parentId: province.id, status: 'ACTIVE' }));
        addedUnits++;
      }
    }
  }
  console.log(`  + Địa bàn mới: ${added}/${REAL_AREAS.length} · Đơn vị mới: ${addedUnits}`);

  await dataSource.destroy();
  console.log('\n  Nạp dữ liệu địa bàn thật hoàn tất. Vui lòng RÀ SOÁT trên giao diện Quản trị → Đơn vị & địa bàn.');
}

run().catch((err) => {
  console.error('Seed dữ liệu thật lỗi:', err);
  process.exit(1);
});
