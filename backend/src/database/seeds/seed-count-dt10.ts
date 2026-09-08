// Seed demo DT-10 (Quyển X). Tạo 1 đợt kiểm kê mẫu (DRAFT) + sổ cái DT-04 tối thiểu để chuỗi
// cutoff → book_snapshot → blind → variance → official → điều chỉnh chạy được trong demo/E2E.
// Idempotent theo campaign_code / transaction_no.
import 'reflect-metadata';
import dataSource from '../data-source';
import { MaterielMovement } from '../../modules/dt04-materiel/entities/materiel-movement.entity';
import { MovementStatus, MovementType } from '../../modules/dt04-materiel/materiel-rules';
import { InventoryCountCampaign } from '../../modules/dt10-inventory-count/entities/inventory-count-campaign.entity';
import { CampaignStatus, CountType } from '../../modules/dt10-inventory-count/dt10.enums';

const DEMO_ORG = '00000000-0000-0000-0000-0000000d1001';
const DEMO_MATERIAL = '00000000-0000-0000-0000-0000000d1002';
const CAMPAIGN_CODE = 'KK-DEMO-2026';

async function run() {
  await dataSource.initialize();
  const moveRepo = dataSource.getRepository(MaterielMovement);
  const campRepo = dataSource.getRepository(InventoryCountCampaign);

  // Sổ cái: 1 RECEIPT +120 (POSTED) trước thời điểm demo cutoff.
  const txNo = 'MV-KKDEMO-0001';
  if (!(await moveRepo.findOne({ where: { transactionNo: txNo } }))) {
    await moveRepo.save(
      moveRepo.create({
        transactionNo: txNo,
        transactionType: MovementType.RECEIPT,
        materialCatalogId: DEMO_MATERIAL,
        organizationId: DEMO_ORG,
        quantity: '120',
        quantitySigned: '120',
        effectiveTime: new Date(Date.now() - 30 * 86_400_000),
        postedAt: new Date(Date.now() - 30 * 86_400_000),
        status: MovementStatus.POSTED,
      }),
    );
    console.log('  + movement RECEIPT +120 (demo)');
  }

  // Đợt kiểm kê mẫu (DRAFT) — người dùng tự cutoff + dựng book_snapshot trên UI.
  if (!(await campRepo.findOne({ where: { campaignCode: CAMPAIGN_CODE } }))) {
    await campRepo.save(
      campRepo.create({
        campaignCode: CAMPAIGN_CODE,
        name: 'Kiểm kê định kỳ demo 2026',
        countType: CountType.PERIODIC,
        scopeJson: { organizationId: DEMO_ORG },
        status: CampaignStatus.DRAFT,
        note: 'Đợt demo cho chuỗi DT-10',
      }),
    );
    console.log(`  + campaign ${CAMPAIGN_CODE} (DRAFT)`);
  }

  console.log('DT-10 demo seed xong.');
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
