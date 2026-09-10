// [03] DT-03 — Hồ sơ kỹ thuật (Quyển III). Mẫu sản phẩm + liên kết R00 (DT-01) + đời thiết kế
// PUBLISHED cho vài vật chất. Idempotent theo model_code_internal / (model+revision).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProductModel } from '../../../modules/dt03-technical/entities/product-model.entity';
import { ModelCatalogLink } from '../../../modules/dt03-technical/entities/model-catalog-link.entity';
import { DesignRevision } from '../../../modules/dt03-technical/entities/design-revision.entity';
import { ModelStatus, RevisionStatus, CatalogLinkType } from '../../../modules/dt03-technical/tech.enums';
import { ActiveStatus } from '../../../modules/catalog/catalog.enums';
import { standalone } from './_shared/run-step';
import { MATERIALS } from './_shared/demo-ids';

// Gắn mẫu kỹ thuật cho các vật chất có "đời thiết kế" rõ.
const MODELS: Array<{ matCode: string; modelCode: string; name: string; symbol: string; year: string; revision: string }> = [
  { matCode: 'R00.01.03', modelCode: 'PM-GIUONG-K18', name: 'Giường cá nhân kiểu K18', symbol: 'K18', year: '2018', revision: 'K18/2018' },
  { matCode: 'R00.01.04', modelCode: 'PM-TU-QTT-2016', name: 'Tủ quân tư trang mẫu 2016', symbol: 'QTT-2016', year: '2016', revision: '2016' },
  { matCode: 'R00.04.01', modelCode: 'PM-MPD-5KVA', name: 'Máy phát điện 5kVA', symbol: 'MPĐ-5', year: '2020', revision: 'R1' },
];

export async function run(ds: DataSource): Promise<void> {
  const modelRepo = ds.getRepository(ProductModel);
  const linkRepo = ds.getRepository(ModelCatalogLink);
  const revRepo = ds.getRepository(DesignRevision);

  let nModel = 0;
  let nRev = 0;
  for (const m of MODELS) {
    const material = MATERIALS.find((x) => x.code === m.matCode);
    if (!material) continue;

    let model = await modelRepo.findOne({ where: { modelCodeInternal: m.modelCode } });
    if (!model) {
      model = await modelRepo.save(
        modelRepo.create({
          modelCodeInternal: m.modelCode,
          modelName: m.name,
          shortName: m.symbol,
          designSymbol: m.symbol,
          designYear: m.year,
          issuingAuthority: 'Cục Doanh trại/TCHC-KT',
          status: ModelStatus.ACTIVE,
        }),
      );
      nModel++;
    }

    if (!(await linkRepo.findOne({ where: { productModelId: model.id, materialCatalogId: material.id } }))) {
      await linkRepo.save(
        linkRepo.create({
          productModelId: model.id,
          materialCatalogId: material.id,
          linkType: CatalogLinkType.PRIMARY,
          effectiveFrom: '2026-01-01',
          status: ActiveStatus.ACTIVE,
        }),
      );
    }

    let rev = await revRepo.findOne({ where: { productModelId: model.id, revisionCode: m.revision } });
    if (!rev) {
      rev = await revRepo.save(
        revRepo.create({
          productModelId: model.id,
          revisionCode: m.revision,
          status: RevisionStatus.PUBLISHED,
          effectiveFrom: '2026-01-01',
          publishedAt: new Date(),
          changeSummary: 'Bản thiết kế gốc (seed mẫu).',
        }),
      );
      nRev++;
    } else if (rev.status !== RevisionStatus.PUBLISHED) {
      rev.status = RevisionStatus.PUBLISHED;
      rev.publishedAt = new Date();
      await revRepo.save(rev);
    }
  }

  console.log(`  [03] DT-03: mẫu +${nModel} · đời thiết kế PUBLISHED +${nRev} (liên kết R00).`);
}

if (require.main === module) standalone(run);
