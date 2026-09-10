// [07] DT-07 — Định mức có căn cứ & chỉ lệnh (Quyển VII). Văn bản → bộ định mức + material_norm
// VERIFIED (semantic CONSUMPTION_PREPARATION) cho vài vật chất CORE → PUBLISHED → chỉ lệnh.
// Sẵn sàng cho DT-08 /norms/resolve (SELECTED cho vật chất có norm, NO_RULE cho còn lại — không quy 0).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from '../../../modules/dt07-norms/entities/normative-document.entity';
import { NormSet, NormSetVersion } from '../../../modules/dt07-norms/entities/norm-set.entity';
import { MaterialNorm } from '../../../modules/dt07-norms/entities/material-norm.entity';
import { AuthorityRankVersion, CalculationParameter } from '../../../modules/dt07-norms/entities/norm-selector.entity';
import { Command, CommandRequirement } from '../../../modules/dt07-norms/entities/command.entity';
import { CatalogVersionStatus } from '../../../common/enums';
import { NormSourceStatus, NormValueType, SemanticParam } from '../../../modules/dt07-norms/norms-rules';
import { standalone } from './_shared/run-step';
import { MATERIALS, CORE_MATERIAL_CODES, CHAIN } from './_shared/demo-ids';

const CORE = MATERIALS.filter((m) => CORE_MATERIAL_CODES.includes(m.code));
// Định mức tiêu thụ GĐCB (đơn vị/kỳ) cho một số vật chất CORE — phần còn lại NO_RULE.
const PREP_NORMS: Array<{ matCode: string; value: number }> = [
  { matCode: 'R00.01.01', value: 40 },
  { matCode: 'R00.01.03', value: 200 },
  { matCode: 'R00.02.01', value: 30 },
];

export async function run(ds: DataSource): Promise<void> {
  const docRepo = ds.getRepository(NormativeDocument);
  const docVerRepo = ds.getRepository(NormativeDocumentVersion);
  const refRepo = ds.getRepository(NormSourceReference);
  const setRepo = ds.getRepository(NormSet);
  const setVerRepo = ds.getRepository(NormSetVersion);
  const normRepo = ds.getRepository(MaterialNorm);
  const rankRepo = ds.getRepository(AuthorityRankVersion);
  const paramRepo = ds.getRepository(CalculationParameter);
  const cmdRepo = ds.getRepository(Command);
  const reqRepo = ds.getRepository(CommandRequirement);

  // 1) Tham số tính toán (semantic) — nguồn cho DT-08.
  const PARAMS = [
    { semanticParam: SemanticParam.CONSUMPTION_PREPARATION, description: 'Tiêu thụ giai đoạn chuẩn bị (GĐCB)' },
    { semanticParam: SemanticParam.CONSUMPTION_COMBAT, description: 'Tiêu thụ giai đoạn chiến đấu (GĐCĐ)' },
    { semanticParam: SemanticParam.POST_COMBAT_REQUIRED, description: 'Phải có sau chiến đấu (PC)' },
    { semanticParam: SemanticParam.RESERVE_SSCD, description: 'Dự trữ sẵn sàng chiến đấu' },
  ];
  for (const p of PARAMS) {
    if (!(await paramRepo.findOne({ where: { semanticParam: p.semanticParam } }))) {
      await paramRepo.save(paramRepo.create(p));
    }
  }

  // 2) Xếp hạng cơ quan ban hành.
  if (!(await rankRepo.findOne({ where: { versionLabel: 'AR-2026' } }))) {
    await rankRepo.save(rankRepo.create({ versionLabel: 'AR-2026', rankJson: { BQP: 1, BTL: 2, CUC: 3 }, effectiveFrom: '2026-01-01', isActive: true }));
  }

  // 3) Văn bản căn cứ + phiên bản + trích dẫn.
  let doc = await docRepo.findOne({ where: { docNo: CHAIN.normDocNo } });
  if (!doc) doc = await docRepo.save(docRepo.create({ docNo: CHAIN.normDocNo, title: 'Thông tư định mức trang bị doanh trại 2026', issuingAuthority: 'BQP', issueDate: '2026-01-01' }));
  let docVer = await docVerRepo.findOne({ where: { documentId: doc.id } });
  if (!docVer) docVer = await docVerRepo.save(docVerRepo.create({ documentId: doc.id, versionLabel: 'v1', fileHash: 'seed-hash-dt07-th', effectiveFrom: '2026-01-01', status: CatalogVersionStatus.PUBLISHED }));
  let ref = await refRepo.findOne({ where: { documentVersionId: docVer.id } });
  if (!ref) ref = await refRepo.save(refRepo.create({ documentVersionId: docVer.id, pageNo: 8, lineRef: '§2.1', quoteText: 'Định mức trang bị doanh cụ giai đoạn chuẩn bị', appendixCode: 'PL-01' }));

  // 4) Bộ định mức + phiên bản.
  let set = await setRepo.findOne({ where: { setCode: CHAIN.normSetCode } });
  if (!set) set = await setRepo.save(setRepo.create({ setCode: CHAIN.normSetCode, name: 'Định mức trang bị doanh trại 2026' }));
  let ver = await setVerRepo.findOne({ where: { normSetId: set.id } });
  if (!ver) {
    ver = await setVerRepo.save(setVerRepo.create({ normSetId: set.id, versionLabel: 'v1', documentVersionId: docVer.id, effectiveFrom: '2026-01-01', status: CatalogVersionStatus.DRAFT }));
  }

  // 5) material_norm VERIFIED (semantic CONSUMPTION_PREPARATION) cho vài vật chất CORE.
  if ((await normRepo.count({ where: { normSetVersionId: ver.id } })) === 0) {
    for (const n of PREP_NORMS) {
      const mat = CORE.find((m) => m.code === n.matCode);
      if (!mat) continue;
      await normRepo.save(
        normRepo.create({
          normSetVersionId: ver.id,
          materialCatalogId: mat.id,
          semanticParam: SemanticParam.CONSUMPTION_PREPARATION,
          valueType: NormValueType.FIXED,
          valueNumeric: String(n.value),
          rawValue: `${n.value} ${mat.unit}/kỳ`,
          sourceStatus: NormSourceStatus.VERIFIED,
          sourceReferenceId: ref.id,
          effectiveFrom: '2026-01-01',
        }),
      );
    }
  }

  // 6) Công bố bộ định mức (PUBLISHED — sẵn sàng resolve).
  if (ver.status !== CatalogVersionStatus.PUBLISHED) {
    ver.status = CatalogVersionStatus.PUBLISHED;
    ver.publishedAt = new Date();
    await setVerRepo.save(ver);
  }

  // 7) Chỉ lệnh hậu cần + yêu cầu vật chất.
  let cmd = await cmdRepo.findOne({ where: { commandNo: CHAIN.commandNo } });
  if (!cmd) cmd = await cmdRepo.save(cmdRepo.create({ commandNo: CHAIN.commandNo, title: 'Chỉ lệnh bảo đảm doanh trại Thanh Hóa Q3/2026', issuingAuthority: 'BTL', effectiveDate: '2026-07-01' }));
  if (!(await reqRepo.findOne({ where: { commandId: cmd.id } }))) {
    await reqRepo.save(reqRepo.create({ commandId: cmd.id, materialCatalogId: CORE[0].id, requiredQty: '500', deadline: '2026-09-30', normSetVersionId: ver.id }));
  }

  console.log(`  [07] DT-07: set ${CHAIN.normSetCode} (${ver.status}) · ${PREP_NORMS.length} định mức VERIFIED · chỉ lệnh ${CHAIN.commandNo}.`);
}

if (require.main === module) standalone(run);
