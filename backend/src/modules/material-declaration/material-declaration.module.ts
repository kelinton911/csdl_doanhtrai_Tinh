import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialDeclaration } from './entities/material-declaration.entity';
import { MaterialDeclarationLine } from './entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from './entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from './entities/declaration-amendment-request.entity';
import { MaterialDeclarationService } from './material-declaration.service';
import { MaterialDeclarationController } from './material-declaration.controller';

// Trục A — Khai báo vật chất thời bình của cấp xã / đơn vị trực thuộc Tỉnh:
// CRUD đầy đủ khi chưa duyệt · duyệt xong khóa · đề nghị sửa kèm minh chứng.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialDeclaration,
      MaterialDeclarationLine,
      MaterialDeclarationRevision,
      DeclarationAmendmentRequest,
    ]),
  ],
  controllers: [MaterialDeclarationController],
  providers: [MaterialDeclarationService],
  exports: [MaterialDeclarationService],
})
export class MaterialDeclarationModule {}
