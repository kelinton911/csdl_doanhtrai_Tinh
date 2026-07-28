import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageLocation } from './entities/storage-location.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { StockBalance } from './entities/stock-balance.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

// M06 — Inventory: kho, sổ kho bất biến, số dư, điều chỉnh kiểm kê.
@Module({
  imports: [
    TypeOrmModule.forFeature([StorageLocation, InventoryTransaction, StockBalance]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
