import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModel } from './entities/product-model.entity';
import { ModelCatalogLink } from './entities/model-catalog-link.entity';
import { DesignRevision } from './entities/design-revision.entity';
import { TechnicalDocument } from './entities/technical-document.entity';
import { DrawingSheet } from './entities/drawing-sheet.entity';
import { TechnicalAttribute } from './entities/technical-attribute.entity';
import { BomHeader } from './entities/bom-header.entity';
import { BomItem } from './entities/bom-item.entity';
import { SourceProvenance } from './entities/source-provenance.entity';
import { ModelRelationship } from './entities/model-relationship.entity';
import { TechnicalService } from './technical.service';
import { TechnicalController } from './technical.controller';

// DT-03 — Hồ sơ kỹ thuật vật chất (model/revision/bản vẽ/BOM/xác minh).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductModel, ModelCatalogLink, DesignRevision, TechnicalDocument, DrawingSheet,
      TechnicalAttribute, BomHeader, BomItem, SourceProvenance, ModelRelationship,
    ]),
  ],
  controllers: [TechnicalController],
  providers: [TechnicalService],
  exports: [TechnicalService],
})
export class Dt03TechnicalModule {}
