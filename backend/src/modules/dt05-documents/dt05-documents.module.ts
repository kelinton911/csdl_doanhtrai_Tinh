import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryDocument } from './entities/inventory-document.entity';
import { InventoryDocumentLine } from './entities/inventory-document-line.entity';
import { PostingBatch } from './entities/posting-batch.entity';
import { TransferOrder } from './entities/transfer-order.entity';
import { StockPeriod } from './entities/stock-period.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

// DT-05 — Chứng từ nghiệp vụ. Tái dùng sổ cái materiel_movement (DT-04) khi POST.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryDocument, InventoryDocumentLine, PostingBatch, TransferOrder, StockPeriod,
      MaterielMovement,
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class Dt05DocumentsModule {}
