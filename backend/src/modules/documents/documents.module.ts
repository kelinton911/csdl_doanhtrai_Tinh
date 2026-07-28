import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

// M08 — Documents & Media: tài liệu, ảnh, hồ sơ pháp lý lưu MinIO.
@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
