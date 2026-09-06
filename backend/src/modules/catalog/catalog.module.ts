import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogVersion } from './entities/catalog-version.entity';
import { MaterialCatalog } from './entities/material-catalog.entity';
import { MaterialAlias } from './entities/material-alias.entity';
import { CatalogReplacement } from './entities/catalog-replacement.entity';
import { UnitOfMeasure } from './entities/unit-of-measure.entity';
import { CatalogImportBatch } from './entities/catalog-import-batch.entity';
import { CatalogImportError } from './entities/catalog-import-error.entity';
import { CatalogChangeRequest } from './entities/catalog-change-request.entity';
import { TemporaryMaterial } from './entities/temporary-material.entity';
import { CatalogModelLink } from './entities/catalog-model-link.entity';
import { CatalogService } from './catalog.service';
import { CatalogRegistryService } from './catalog-registry.service';
import { CatalogController } from './catalog.controller';
import { CatalogRegistryController } from './catalog-registry.controller';

// DT-01 — Quản lý danh mục chuẩn ngành (Single Source of Truth). Dựng trên nền Sprint 0
// (AbstractEntity, OutboxService, AuditService, mã lỗi/enum chung).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogVersion,
      MaterialCatalog,
      MaterialAlias,
      CatalogReplacement,
      UnitOfMeasure,
      CatalogImportBatch,
      CatalogImportError,
      CatalogChangeRequest,
      TemporaryMaterial,
      CatalogModelLink,
    ]),
  ],
  controllers: [CatalogController, CatalogRegistryController],
  providers: [CatalogService, CatalogRegistryService],
  exports: [CatalogService, CatalogRegistryService],
})
export class CatalogModule {}
