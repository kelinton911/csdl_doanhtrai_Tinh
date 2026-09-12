import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialDeclaration } from './entities/material-declaration.entity';
import { MaterialDeclarationLine } from './entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from './entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from './entities/declaration-amendment-request.entity';
import { DeclarationTemplate } from './entities/declaration-template.entity';
import { MaterialCatalog } from '../catalog/entities/material-catalog.entity';
import { MaterialAlias } from '../catalog/entities/material-alias.entity';
import { MaterialDeclarationService } from './material-declaration.service';
import { MaterialDeclarationController } from './material-declaration.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { MasterDataModule } from '../master-data/master-data.module';

// Trục A — Khai báo vật chất thời bình của cấp xã / đơn vị trực thuộc Tỉnh:
// CRUD đầy đủ khi chưa duyệt · duyệt xong khóa · đề nghị sửa kèm minh chứng.
// Đọc material_catalog + material_alias để khớp danh mục khi import Excel/CSV.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialDeclaration,
      MaterialDeclarationLine,
      MaterialDeclarationRevision,
      DeclarationAmendmentRequest,
      DeclarationTemplate,
      MaterialCatalog,
      MaterialAlias,
    ]),
    InventoryModule,
    MasterDataModule,
  ],
  controllers: [MaterialDeclarationController],
  providers: [MaterialDeclarationService],
  exports: [MaterialDeclarationService],
})
export class MaterialDeclarationModule {}
