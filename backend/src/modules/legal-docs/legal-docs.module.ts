import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalDocument } from './entities/legal-document.entity';
import { LegalDocsService } from './legal-docs.service';
import { LegalDocsController } from './legal-docs.controller';

// M20 — Văn bản, tiêu chuẩn, định mức.
@Module({
  imports: [TypeOrmModule.forFeature([LegalDocument])],
  controllers: [LegalDocsController],
  providers: [LegalDocsService],
  exports: [LegalDocsService],
})
export class LegalDocsModule {}
