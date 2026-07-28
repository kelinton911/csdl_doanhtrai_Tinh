import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Global: M08 Documents và các module đính kèm ảnh dùng chung StorageService.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
