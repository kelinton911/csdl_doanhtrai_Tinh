// [11] DT-11 — Báo cáo & biểu mẫu (Quyển XI). Nạp 17 biểu dưới dạng CẤU HÌNH (report_definition +
// template_version PUBLISHED + dataset_definition/field/formula). KHÔNG tạo official snapshot island —
// dataset nguồn DT10_OFFICIAL_SNAPSHOT đọc THẲNG official_snapshot THẬT do bước [10] tạo (per xã → rollup).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ReportDefinition, ReportTemplateVersion } from '../../../modules/dt11-report/entities/report-definition.entity';
import { DatasetDefinition, DatasetField, DatasetFormula } from '../../../modules/dt11-report/entities/dataset-definition.entity';
import { DatasetSourceType, ReportDefinitionStatus, TemplateVersionStatus } from '../../../modules/dt11-report/dt11.enums';
import { standalone } from './_shared/run-step';

interface FieldSpec { fieldKey: string; sourcePath: string; header: string; dataType: string }
interface DatasetSpec { code: string; title: string; sourceType: DatasetSourceType; fields: FieldSpec[]; formulas?: Array<{ targetField: string; formulaExpr: string }> }
interface FormSpec { formCode: string; title: string; category: string; datasetCode: string; columns: Array<{ key: string; header: string }> }
const F = (fieldKey: string, sourcePath: string, header: string, dataType: string): FieldSpec => ({ fieldKey, sourcePath, header, dataType });

const DATASETS: DatasetSpec[] = [
  { code: 'ds-kk-so-luong', title: 'Số lượng vật chất (official snapshot DT-10)', sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT, fields: [F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'), F('total', 'total', 'Số lượng', 'number')] },
  { code: 'ds-kk-gia-tri', title: 'Số lượng & giá trị (official snapshot DT-10)', sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT, fields: [F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'), F('total', 'total', 'Số lượng', 'number'), F('value', 'value', 'Giá trị', 'value')] },
  { code: 'ds-kk-chat-luong', title: 'Chất lượng C1–5 (official snapshot DT-10)', sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT, fields: [F('materialCatalogId', 'materialCatalogId', 'Vật chất', 'string'), F('total', 'total', 'Tổng số', 'quality_total'), F('c1', 'c1', 'Cấp 1', 'number'), F('c2', 'c2', 'Cấp 2', 'number'), F('c3', 'c3', 'Cấp 3', 'number'), F('c4', 'c4', 'Cấp 4', 'number'), F('c5', 'c5', 'Cấp 5', 'number')], formulas: [{ targetField: 'sumGrades', formulaExpr: 'c1+c2+c3+c4+c5' }] },
  { code: 'ds-land-dqp', title: 'Biến động đất quốc phòng (land-forms DT-02)', sourceType: DatasetSourceType.LAND_FORMS, fields: [F('name', 'name', 'Đơn vị/thửa', 'string'), F('areaPrev', 'areaPrev', 'Kỳ trước', 'number'), F('incArea', 'incArea', 'Tăng', 'number'), F('decArea', 'decArea', 'Giảm', 'number'), F('total', 'total', 'Kỳ này', 'number'), F('areaDefense', 'areaDefense', 'Đất QP', 'number')] },
  { code: 'ds-land-kgd', title: 'Khu gia đình (land-forms DT-02)', sourceType: DatasetSourceType.LAND_FORMS, fields: [F('name', 'name', 'Khu gia đình', 'string'), F('total', 'total', 'Diện tích', 'number'), F('areaFamily', 'areaFamily', 'Đất gia đình', 'number')] },
  { code: 'ds-land-nha', title: 'Nhà ở/công vụ (land-forms DT-02)', sourceType: DatasetSourceType.LAND_FORMS, fields: [F('name', 'name', 'Khu nhà', 'string'), F('total', 'total', 'Diện tích', 'number'), F('areaFamily', 'areaFamily', 'Đất ở', 'number')] },
];

const KK_QTY_COLS = [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }];
const KK_VAL_COLS = [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }, { key: 'value', header: 'Giá trị' }];
const KK_QLT_COLS = [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Tổng số' }, { key: 'c1', header: 'Cấp 1' }, { key: 'c2', header: 'Cấp 2' }, { key: 'c3', header: 'Cấp 3' }, { key: 'c4', header: 'Cấp 4' }, { key: 'c5', header: 'Cấp 5' }];
const DQP_COLS = [{ key: 'name', header: 'Đơn vị/thửa' }, { key: 'areaPrev', header: 'Kỳ trước' }, { key: 'incArea', header: 'Tăng' }, { key: 'decArea', header: 'Giảm' }, { key: 'total', header: 'Kỳ này' }, { key: 'areaDefense', header: 'Đất QP' }];
const KGD_COLS = [{ key: 'name', header: 'Khu gia đình' }, { key: 'total', header: 'Diện tích' }, { key: 'areaFamily', header: 'Đất gia đình' }];
const NHA_COLS = [{ key: 'name', header: 'Khu nhà' }, { key: 'total', header: 'Diện tích' }, { key: 'areaFamily', header: 'Đất ở' }];

const FORMS: FormSpec[] = [
  { formCode: '01/KK', title: 'Biểu 01/KK — Số lượng vật tư hàng hóa', category: 'KK', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '02/KK', title: 'Biểu 02/KK — Số lượng và giá trị vật tư hàng hóa', category: 'KK', datasetCode: 'ds-kk-gia-tri', columns: KK_VAL_COLS },
  { formCode: '03/KK', title: 'Biểu 03/KK — Chất lượng vật tư hàng hóa (C1–5)', category: 'KK', datasetCode: 'ds-kk-chat-luong', columns: KK_QLT_COLS },
  { formCode: '01/KKDT', title: 'Biểu 01/KKDT — Kiểm kê doanh trại (tổng hợp)', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '02/KKDT', title: 'Biểu 02/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '03/KKDT', title: 'Biểu 03/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-chat-luong', columns: KK_QLT_COLS },
  { formCode: '04/KKDT', title: 'Biểu 04/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-gia-tri', columns: KK_VAL_COLS },
  { formCode: '05/KKDT', title: 'Biểu 05/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '06/KKDT', title: 'Biểu 06/KKDT — Kiểm kê doanh trại', category: 'KKDT', datasetCode: 'ds-kk-so-luong', columns: KK_QTY_COLS },
  { formCode: '01/KK-ĐQP', title: 'Biểu 01/KK-ĐQP — Tổng hợp kiểm kê đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '02/KK-ĐQP', title: 'Biểu 02/KK-ĐQP — Kiểm kê đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '03/KK-ĐQP', title: 'Biểu 03/KK-ĐQP — Hiện trạng sử dụng đất quốc phòng', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '04/KK-ĐQP', title: 'Biểu 04/KK-ĐQP — Đất quốc phòng cho thuê/mượn/LDLK', category: 'DQP', datasetCode: 'ds-land-dqp', columns: DQP_COLS },
  { formCode: '01/KK-KGĐ', title: 'Biểu 01/KK-KGĐ — Tổng hợp khu gia đình', category: 'KGD', datasetCode: 'ds-land-kgd', columns: KGD_COLS },
  { formCode: '01/KK-NHA', title: 'Biểu 01/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
  { formCode: '02/KK-NHA', title: 'Biểu 02/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
  { formCode: '03/KK-NHA', title: 'Biểu 03/KK-NHA — Nhà ở/công vụ', category: 'NHA', datasetCode: 'ds-land-nha', columns: NHA_COLS },
];

export async function run(ds: DataSource): Promise<void> {
  const dsRepo = ds.getRepository(DatasetDefinition);
  const fieldRepo = ds.getRepository(DatasetField);
  const formulaRepo = ds.getRepository(DatasetFormula);
  const defRepo = ds.getRepository(ReportDefinition);
  const tvRepo = ds.getRepository(ReportTemplateVersion);

  let nDs = 0;
  for (const spec of DATASETS) {
    if (await dsRepo.findOne({ where: { code: spec.code } })) continue;
    const dsDef = await dsRepo.save(dsRepo.create({ code: spec.code, title: spec.title, sourceType: spec.sourceType, status: 'ACTIVE' }));
    let order = 0;
    for (const f of spec.fields) await fieldRepo.save(fieldRepo.create({ datasetDefinitionId: dsDef.id, fieldKey: f.fieldKey, sourcePath: f.sourcePath, header: f.header, dataType: f.dataType, orderNo: order++ }));
    let forder = 0;
    for (const fm of spec.formulas ?? []) await formulaRepo.save(formulaRepo.create({ datasetDefinitionId: dsDef.id, targetField: fm.targetField, formulaExpr: fm.formulaExpr, orderNo: forder++ }));
    nDs++;
  }

  let nForm = 0;
  for (const form of FORMS) {
    if (await defRepo.findOne({ where: { formCode: form.formCode } })) continue;
    const def = await defRepo.save(defRepo.create({ formCode: form.formCode, title: form.title, category: form.category, status: ReportDefinitionStatus.ACTIVE, currentVersionNo: 1 }));
    await tvRepo.save(tvRepo.create({ reportDefinitionId: def.id, versionNo: 1, layoutSchemaJson: { datasetDefinitionCode: form.datasetCode, columns: form.columns }, status: TemplateVersionStatus.PUBLISHED, effectiveFrom: new Date() }));
    nForm++;
  }

  console.log(`  [11] DT-11: dataset +${nDs}/${DATASETS.length} · biểu +${nForm}/${FORMS.length} (nguồn = official_snapshot THẬT DT-10).`);
}

if (require.main === module) standalone(run);
