import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetCatalogItem } from './entities/asset-catalog-item.entity';
import { AssetCatalogProposal } from './entities/asset-catalog-proposal.entity';
import { AssetCatalogProposalBatch } from './entities/asset-catalog-proposal-batch.entity';
import { AssetCatalogService } from './asset-catalog.service';
import { AssetClassifyService } from './asset-classify.service';
import { AssetProposalService } from './asset-proposal.service';
import { AssetCatalogController } from './asset-catalog.controller';
import { AssetProposalController } from './asset-proposal.controller';
import { Material } from '../master-data/entities/material.entity';
import { MaterialVersion } from '../master-data/entities/material-version.entity';
import { Facility } from '../facilities/entities/facility.entity';

// TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (Phụ lục CV 2837/DT-QLDT ngày 16/7/2026).
// Module riêng vì danh mục trải CẢ hai miền nghiệp vụ: công trình (M05) và vật chất (M03/M06),
// và vì luồng đề xuất bổ sung cần StorageService + exceljs.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetCatalogItem,
      AssetCatalogProposal,
      AssetCatalogProposalBatch,
      Material,
      MaterialVersion,
      Facility,
    ]),
  ],
  // Controller đề xuất đặt TRƯỚC để route tĩnh 'proposals/*' không bị ':code' của
  // AssetCatalogController nuốt mất.
  controllers: [AssetProposalController, AssetCatalogController],
  providers: [AssetCatalogService, AssetClassifyService, AssetProposalService],
  exports: [AssetCatalogService],
})
export class AssetCatalogModule {}
