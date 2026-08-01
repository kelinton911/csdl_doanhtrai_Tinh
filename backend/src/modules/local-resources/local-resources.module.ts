import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalResource } from './entities/local-resource.entity';
import { LocalResourcesService } from './local-resources.service';
import { LocalResourcesController } from './local-resources.controller';

// M16 — Nguồn lực huy động tại địa phương.
@Module({
  imports: [TypeOrmModule.forFeature([LocalResource])],
  controllers: [LocalResourcesController],
  providers: [LocalResourcesService],
  exports: [LocalResourcesService],
})
export class LocalResourcesModule {}
