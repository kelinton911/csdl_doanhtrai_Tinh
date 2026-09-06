import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { C3Catalog } from './entities/c3-catalog.entity';
import { C3CatalogService } from './c3-catalog.service';
import { C3CatalogController } from './c3-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([C3Catalog])],
  controllers: [C3CatalogController],
  providers: [C3CatalogService],
  exports: [C3CatalogService],
})
export class C3CatalogModule {}
