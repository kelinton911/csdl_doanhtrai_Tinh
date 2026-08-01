import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageLocation } from './entities/storage-location.entity';
import { StorageLocationRevision } from './entities/storage-location-revision.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { StockQualityDetail } from './entities/stock-quality-detail.entity';
import { InventoryPeriodSnapshot } from './entities/inventory-period-snapshot.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

// M06 — Inventory: kho (có workflow duyệt + revision), sổ kho bất biến, số dư, kiểm kê.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorageLocation,
      StorageLocationRevision,
      InventoryTransaction,
      StockBalance,
      StockQualityDetail,
      InventoryPeriodSnapshot,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
