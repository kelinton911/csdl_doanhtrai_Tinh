// Seed DT-11 (Quyển XI). Nạp DANH MỤC 17 BIỂU dưới dạng CẤU HÌNH (report_definition + template_version
// PUBLISHED + dataset_definition/field/formula) — KHÔNG hard-code số lượng trong code engine (BR-DT11-004/019).
// Biểu KK/KKDT lấy nguồn DT-10 official snapshot; ĐQP/KGĐ/NHA lấy nguồn LAND_FORMS (tái dùng land-parcels).
// Idempotent theo form_code / dataset code.
import 'reflect-metadata';
import dataSource from '../data-source';
import { ReportDefinition, ReportTemplateVersion } from '../../modules/dt11-report/entities/report-definition.entity';
import { DatasetDefinition, DatasetField, DatasetFormula } from '../../modules/dt11-report/entities/dataset-definition.entity';
import { DatasetSourceType, ReportDefinitionStatus, TemplateVersionStatus } from '../../modules/dt11-report/dt11.enums';
import { OfficialSnapshot, OfficialSnapshotLine } from '../../modules/dt10-inventory-count/entities/official-snapshot.entity';

// Kỳ kiểm kê demo (official snapshot) làm nguồn DT-10 cho webapp/E2E DT-11 (id cố định).
export const DT11_DEMO_CAMPAIGN_ID = '00000000-0000-0000-0000-0000000d1100';
const DT11_DEMO_MAT1 = '00000000-0000-0000-0000-0000000d1101';
const DT11_DEMO_MAT2 = '00000000-0000-0000-0000-0000000d1102';

interface FieldSpec { fieldKey: string; sourcePath: string; header: string; dataType: string }
interface DatasetSpec {
  code: string;
  title: string;
  sourceType: DatasetSourceType;
  fields: FieldSpec[];
  formulas?: Array<{ targetField: string; formulaExpr: string }>;
}
interface FormSpec {
  formCode: string;
  title: string;
  category: string;
  datasetCode: string;
  columns: Array<{ key: string; header: string }>;
}

const F = (fieldKey: string, sourcePath: string, header: string, dataType: string): FieldSpec => ({ fieldKey, sourcePath, header, dataType });

// ---- dataset_definition (nguồn snapshot chuẩn) ----
const DATASETS: DatasetSpec[] = [
  {
    code: 'ds-kk-so-luong',
    title: 'Số lượng vật chất (official snapshot DT-10)',
    sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT,
    fields: [F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'), F('total', 'total', 'Số lượng', 'number')],
  },
  {
    code: 'ds-kk-gia-tri',
    title: 'Số lượng & giá trị (official snapshot DT-10)',
    sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT,
    fields: [
      F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'),
      F('total', 'total', 'Số lượng', 'number'),
      F('value', 'value', 'Giá trị', 'value'),
    ],
  },
  {
    code: 'ds-kk-chat-luong',
    title: 'Chất lượng C1–5 (official snapshot DT-10)',
    sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT,
    fields: [
      F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'),
      F('total', 'total', 'Tổng số', 'quality_total'),
      F('c1', 'c1', 'Cấp 1', 'number'),
      F('c2', 'c2', 'Cấp 2', 'number'),
      F('c3', 'c3', 'Cấp 3', 'number'),
      F('c4', 'c4', 'Cấp 4', 'number'),
      F('c5', 'c5', 'Cấp 5', 'number'),
    ],
    formulas: [{ targetField: 'sumGrades', formulaExpr: 'c1+c2+c3+c4+c5' }],
  },
  {
    code: 'ds-land-dqp',
    title: 'Biến động đất quốc phòng (land-forms DT-02)',
    sourceType: DatasetSourceType.LAND_FORMS,
    fields: [
      F('name', 'name', 'Đơn vị/thửa', 'string'),
      F('areaPrev', 'areaPrev', 'Kỳ trước', 'number'),
      F('incArea', 'incArea', 'Tăng', 'number'),
      F('decArea', 'decArea', 'Giảm', 'number'),
      F('total', 'total', 'Kỳ này', 'number'),
      F('areaDefense', 'areaDefense', 'Đất QP', 'number'),
    ],
  },
  {
    code: 'ds-land-kgd',
    title: 'Khu gia đình (land-forms DT-02)',
    sourceType: DatasetSourceType.LAND_FORMS,
    fields: [
      F('name', 'name', 'Khu gia đình', 'string'),
      F('total', 'total', 'Diện tích', 'number'),
      F('areaFamily', 'areaFamily', 'Đất gia đình', 'number'),
    ],
  },
  {
    code: 'ds-land-nha',
    title: 'Nhà ở/công vụ (land-forms DT-02)',
    sourceType: DatasetSourceType.LAND_FORMS,
    fields: [
      F('name', 'name', 'Khu nhà', 'string'),
      F('total', 'total', 'Diện tích', 'number'),
      F('areaFamily', 'areaFamily', 'Đất ở', 'number'),
    ],
  },
];

// ---- report_definition (17 biểu) ----
const KK_QTY_COLS = [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }];
const KK_VAL_COLS = [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }, { key: 'value', header: 'Giá trị' }];
const KK_QLT_COLS = [
  { key: 'materialCatalogId', header: 'Vật chất' },
  { key: 'total', header: 'Tổng số' },
  { key: 'c1', header: 'Cấp 1' }, { key: 'c2', header: 'Cấp 2' }, { key: 'c3', header: 'Cấp 3' }, { key: 'c4', header: 'Cấp 4' }, { key: 'c5', header: 'Cấp 5' },
];
const DQP_COLS = [
  { key: 'name', header: 'Đơn vị/thửa' }, { key: 'areaPrev', header: 'Kỳ trước' },
  { key: 'incArea', header: 'Tăng' }, { key: 'decArea', header: 'Giảm' }, { key: 'total', header: 'Kỳ này' }, { key: 'areaDefense', header: 'Đất QP' },
];
const KGD_COLS = [{ key: 'name', header: 'Khu gia đình' }, { key: 'total', header: 'Diện tích' }, { key: 'areaFamily', header: 'Đất gia đình' }];
const NHA_COLS = [{ key: 'name', header: 'Khu nhà' }, { key: 'total', header: 'Diện tích' }, { key: 'areaFamily', header: 'Đất ở' }];

const FORMS: FormSpec[] = [
  // Biểu kiểm kê vật chất (KK) — nguồn DT-10
  { formCode: '01/KK', title: 'Biểu 01/KK — Số lượng vật tư hàng hóa', category: 'KK', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '02/KK', title: 'Biểu 02/KK — Số lượng và giá trị vật tư hàng hóa', category: 'KK', datasetCode: 'ds-kk-gia-tri', columns: KK_VAL_COLS },
  { formCode: '03/KK', title: 'Biểu 03/KK — Chất lượng vật tư hàng hóa (C1–5)', category: 'KK', datasetCode: 'ds-kk-chat-luong', columns: KK_QLT_COLS },
  // Biểu kiểm kê doanh trại (KKDT) 01–06 — nguồn DT-10
  { formCode: '01/KKDT', title: 'Biểu 01/KKDT — Kiểm kê doanh trại (tổng hợp)', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '02/KKDT', title: 'Biểu 02/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '03/KKDT', title: 'Biểu 03/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-chat-luong', columns: KK_QLT_COLS },
  { formCode: '04/KKDT', title: 'Biểu 04/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-gia-tri', columns: KK_VAL_COLS },
  { formCode: '05/KKDT', title: 'Biểu 05/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '06/KKDT', title: 'Biểu 06/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  // Biểu đất quốc phòng (ĐQP) 01–04 — nguồn LAND_FORMS
  { formCode: '01/KK-ĐQP', title: 'Biểu 01/KK-ĐQP — Tổng hợp kiểm kê đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '02/KK-ĐQP', title: 'Biểu 02/KK-ĐQP — Kiểm kê đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '03/KK-ĐQP', title: 'Biểu 03/KK-ĐQP — Hiện trạng sử dụng đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '04/KK-ĐQP', title: 'Biểu 04/KK-ĐQP — Đất quốc phòng cho thuê/mượn/LDLK', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  // Biểu khu gia đình (KGĐ) 01 — nguồn LAND_FORMS
  { formCode: '01/KK-KGĐ', title: 'Biểu 01/KK-KGĐ — Tổng hợp khu gia đình', category: 'KGD', datasetCode: 'ds-land-kgd', columns: KGD_COLS },
  // Biểu nhà (NHA) 01–03 — nguồn LAND_FORMS
  { formCode: '01/KK-NHA', title: 'Biểu 01/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
  { formCode: '02/KK-NHA', title: 'Biểu 02/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
  { formCode: '03/KK-NHA', title: 'Biểu 03/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
];

async function run() {
  await dataSource.initialize();
  const dsRepo = dataSource.getRepository(DatasetDefinition);
  const fieldRepo = dataSource.getRepository(DatasetField);
  const formulaRepo = dataSource.getRepository(DatasetFormula);
  const defRepo = dataSource.getRepository(ReportDefinition);
  const tvRepo = dataSource.getRepository(ReportTemplateVersion);

  // 1) dataset_definition + field/formula
  for (const spec of DATASETS) {
    let ds = await dsRepo.findOne({ where: { code: spec.code } });
    if (!ds) {
      ds = await dsRepo.save(dsRepo.create({ code: spec.code, title: spec.title, sourceType: spec.sourceType, status: 'ACTIVE' }));
      let order = 0;
      for (const f of spec.fields) {
        await fieldRepo.save(fieldRepo.create({ datasetDefinitionId: ds.id, fieldKey: f.fieldKey, sourcePath: f.sourcePath, header: f.header, dataType: f.dataType, orderNo: order++ }));
      }
      let forder = 0;
      for (const fm of spec.formulas ?? []) {
        await formulaRepo.save(formulaRepo.create({ datasetDefinitionId: ds.id, targetField: fm.targetField, formulaExpr: fm.formulaExpr, orderNo: forder++ }));
      }
      console.log(`  + dataset ${spec.code} (${spec.fields.length} field)`);
    }
  }

  // 2) report_definition + template_version PUBLISHED
  for (const form of FORMS) {
    let def = await defRepo.findOne({ where: { formCode: form.formCode } });
    if (!def) {
      def = await defRepo.save(
        defRepo.create({ formCode: form.formCode, title: form.title, category: form.category, status: ReportDefinitionStatus.ACTIVE, currentVersionNo: 1 }),
      );
      await tvRepo.save(
        tvRepo.create({
          reportDefinitionId: def.id,
          versionNo: 1,
          layoutSchemaJson: { datasetDefinitionCode: form.datasetCode, columns: form.columns },
          status: TemplateVersionStatus.PUBLISHED,
          effectiveFrom: new Date(),
        }),
      );
      console.log(`  + biểu ${form.formCode} → ${form.datasetCode}`);
    }
  }

  // 3) Nguồn demo DT-10: official_snapshot + 2 dòng (để sinh dataset trong webapp/E2E). Idempotent theo campaignId.
  const snapRepo = dataSource.getRepository(OfficialSnapshot);
  const snapLineRepo = dataSource.getRepository(OfficialSnapshotLine);
  let snap = await snapRepo.findOne({ where: { campaignId: DT11_DEMO_CAMPAIGN_ID } });
  if (!snap) {
    snap = await snapRepo.save(
      snapRepo.create({ campaignId: DT11_DEMO_CAMPAIGN_ID, version: 1, checksum: 'dt11-demo-official-1', approvedAt: new Date() }),
    );
    await snapLineRepo.save(snapLineRepo.create({ snapshotId: snap.id, materialCatalogId: DT11_DEMO_MAT1, officialQty: '120', grade1: '80', grade2: '30', grade3: '10', grade4: '0', grade5: '0', value: '12000' }));
    await snapLineRepo.save(snapLineRepo.create({ snapshotId: snap.id, materialCatalogId: DT11_DEMO_MAT2, officialQty: '60', grade1: '60', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '6000' }));
    console.log(`  + official_snapshot demo (campaignId=${DT11_DEMO_CAMPAIGN_ID}, 2 dòng, tổng 180)`);
  }

  console.log(`DT-11 seed xong: ${DATASETS.length} dataset · ${FORMS.length} biểu (cấu hình). Demo campaignId=${DT11_DEMO_CAMPAIGN_ID}`);
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
