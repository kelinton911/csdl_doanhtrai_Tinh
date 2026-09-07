// Seed golden DT-07 (Quyển VII). Chuỗi nghiệm thu tối giản: văn bản căn cứ →
// bộ định mức + material_norm (scope mission) → công bố → sẵn sàng cho /norms/resolve
// (SELECTED/NO_RULE/CONFLICT) → chỉ lệnh + yêu cầu. Idempotent theo set_code/doc_no.
import 'reflect-metadata';
import dataSource from '../data-source';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from '../../modules/dt07-norms/entities/normative-document.entity';
import { NormSet, NormSetVersion } from '../../modules/dt07-norms/entities/norm-set.entity';
import { MaterialNorm, NormDimension } from '../../modules/dt07-norms/entities/material-norm.entity';
import { AuthorityRankVersion, CalculationParameter } from '../../modules/dt07-norms/entities/norm-selector.entity';
import { Command, CommandRequirement } from '../../modules/dt07-norms/entities/command.entity';
import { MaterialCatalog } from '../../modules/catalog/entities/material-catalog.entity';
import { CatalogVersionStatus } from '../../common/enums';
import { DimensionType, NormSourceStatus, NormValueType, SemanticParam } from '../../modules/dt07-norms/norms-rules';

const DOC_NO = 'TT-DM-2026/BQP';
const SET_CODE = 'ND-XANGDAU-2026';
const CMD_NO = 'CL-HC-2026-001';
const DEMO_MATERIAL = '00000000-0000-0000-0000-0000000d7001';

async function run() {
  await dataSource.initialize();
  const docRepo = dataSource.getRepository(NormativeDocument);
  const docVerRepo = dataSource.getRepository(NormativeDocumentVersion);
  const refRepo = dataSource.getRepository(NormSourceReference);
  const setRepo = dataSource.getRepository(NormSet);
  const setVerRepo = dataSource.getRepository(NormSetVersion);
  const normRepo = dataSource.getRepository(MaterialNorm);
  const dimRepo = dataSource.getRepository(NormDimension);
  const rankRepo = dataSource.getRepository(AuthorityRankVersion);
  const paramRepo = dataSource.getRepository(CalculationParameter);
  const cmdRepo = dataSource.getRepository(Command);
  const reqRepo = dataSource.getRepository(CommandRequirement);
  const catalogRepo = dataSource.getRepository(MaterialCatalog);

  // Vật chất mẫu: lấy 1 mã catalog có sẵn (nếu chưa seed DT-01 thì dùng UUID demo).
  const anyItem = await catalogRepo.findOne({ where: {}, order: { code: 'ASC' } });
  const materialId = anyItem?.id ?? DEMO_MATERIAL;

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

  // 2) Xếp hạng cơ quan ban hành (authority_rank) — bản active.
  if (!(await rankRepo.findOne({ where: { versionLabel: 'AR-2026' } }))) {
    await rankRepo.save(
      rankRepo.create({ versionLabel: 'AR-2026', rankJson: { BQP: 1, BTL: 2, CUC: 3 }, effectiveFrom: '2026-01-01', isActive: true }),
    );
  }

  // 3) Văn bản căn cứ + phiên bản + trích dẫn.
  let doc = await docRepo.findOne({ where: { docNo: DOC_NO } });
  if (!doc) doc = await docRepo.save(docRepo.create({ docNo: DOC_NO, title: 'Thông tư định mức xăng dầu 2026', issuingAuthority: 'BQP', issueDate: '2026-01-01' }));
  let docVer = await docVerRepo.findOne({ where: { documentId: doc.id } });
  if (!docVer) docVer = await docVerRepo.save(docVerRepo.create({ documentId: doc.id, versionLabel: 'v1', fileHash: 'seed-hash-dt07', effectiveFrom: '2026-01-01', status: CatalogVersionStatus.PUBLISHED }));
  let ref = await refRepo.findOne({ where: { documentVersionId: docVer.id } });
  if (!ref) ref = await refRepo.save(refRepo.create({ documentVersionId: docVer.id, pageNo: 12, lineRef: '§3.2', quoteText: 'Định mức tiêu thụ giai đoạn chiến đấu', appendixCode: 'PL-01' }));

  // 4) Bộ định mức + phiên bản (gắn văn bản căn cứ).
  let set = await setRepo.findOne({ where: { setCode: SET_CODE } });
  if (!set) set = await setRepo.save(setRepo.create({ setCode: SET_CODE, name: 'Định mức xăng dầu 2026' }));
  let ver = await setVerRepo.findOne({ where: { normSetId: set.id } });
  if (!ver) {
    ver = await setVerRepo.save(
      setVerRepo.create({ normSetId: set.id, versionLabel: 'v1', documentVersionId: docVer.id, effectiveFrom: '2026-01-01', status: CatalogVersionStatus.DRAFT }),
    );
  }

  // 5) Định mức: A đặc thù (mission=ATTACK) + B tổng quát — cả 2 VERIFIED (có căn cứ).
  const existingNorms = await normRepo.count({ where: { normSetVersionId: ver.id } });
  if (existingNorms === 0) {
    const normA = await normRepo.save(
      normRepo.create({
        normSetVersionId: ver.id,
        materialCatalogId: materialId,
        semanticParam: SemanticParam.CONSUMPTION_COMBAT,
        valueType: NormValueType.FIXED,
        valueNumeric: '15',
        rawValue: '15 lít/xe/ngày',
        sourceStatus: NormSourceStatus.VERIFIED,
        sourceReferenceId: ref.id,
        effectiveFrom: '2026-01-01',
      }),
    );
    await dimRepo.save(dimRepo.create({ materialNormId: normA.id, dimensionType: DimensionType.MISSION, dimensionValue: 'ATTACK' }));

    await normRepo.save(
      normRepo.create({
        normSetVersionId: ver.id,
        materialCatalogId: materialId,
        semanticParam: SemanticParam.CONSUMPTION_COMBAT,
        valueType: NormValueType.FIXED,
        valueNumeric: '10',
        rawValue: '10 lít/xe/ngày',
        sourceStatus: NormSourceStatus.VERIFIED,
        sourceReferenceId: ref.id,
        effectiveFrom: '2026-01-01',
      }),
    );
  }

  // 6) Công bố bộ định mức (PUBLISHED — sẵn sàng cho resolve).
  if (ver.status !== CatalogVersionStatus.PUBLISHED) {
    ver.status = CatalogVersionStatus.PUBLISHED;
    ver.publishedAt = new Date();
    await setVerRepo.save(ver);
  }

  // 7) Chỉ lệnh hậu cần + yêu cầu vật chất (gắn định mức PUBLISHED tại effective_date).
  let cmd = await cmdRepo.findOne({ where: { commandNo: CMD_NO } });
  if (!cmd) cmd = await cmdRepo.save(cmdRepo.create({ commandNo: CMD_NO, title: 'Chỉ lệnh bảo đảm xăng dầu Q1/2026', issuingAuthority: 'BTL', effectiveDate: '2026-02-01' }));
  if (!(await reqRepo.findOne({ where: { commandId: cmd.id } }))) {
    await reqRepo.save(
      reqRepo.create({ commandId: cmd.id, materialCatalogId: materialId, requiredQty: '1000', deadline: '2026-03-31', normSetVersionId: ver.id }),
    );
  }

  console.log(
    `DT-07 seed: doc ${DOC_NO}, set ${SET_CODE} (${ver.status}), material ${materialId}, command ${CMD_NO}. ` +
      `Thử: POST /norms/resolve { materialCatalogId:"${materialId}", semanticParam:"CONSUMPTION_COMBAT", scope:{mission:"ATTACK"} } → SELECTED 15.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
