import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryDocument } from './entities/inventory-document.entity';
import { InventoryDocumentLine } from './entities/inventory-document-line.entity';
import { PostingBatch } from './entities/posting-batch.entity';
import { TransferOrder } from './entities/transfer-order.entity';
import { StockPeriod } from './entities/stock-period.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { MovementStatus, MovementType, signedQuantity, assertSufficientStock } from '../dt04-materiel/materiel-rules';
import { StockPeriodStatus, TRANSFER_TRANSITIONS, TransferStatus } from './dt05.enums';
import { DOCUMENT_TRANSITIONS, DocumentStatus } from '../../common/enums';
import { assertTransition } from '../../common/enums/assert-transition';
import {
  assertPeriodNotLocked,
  computeDiscrepancy,
  documentAffectsStock,
  movementTypeForDocument,
} from './doc-rules';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { applyOrgScope, assertReadScope } from '../../common/scope/scope-query';
import { isProvinceWide, scopeOrganizationId } from '../../common/data-scope';
import { AddLineDto, CreateDocumentDto, CreatePeriodDto, CreateTransferDto } from './dt05.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(InventoryDocument) private readonly docs: Repository<InventoryDocument>,
    @InjectRepository(InventoryDocumentLine) private readonly lines: Repository<InventoryDocumentLine>,
    @InjectRepository(PostingBatch) private readonly batches: Repository<PostingBatch>,
    @InjectRepository(TransferOrder) private readonly transfers: Repository<TransferOrder>,
    @InjectRepository(StockPeriod) private readonly periods: Repository<StockPeriod>,
    @InjectRepository(MaterielMovement) private readonly movements: Repository<MaterielMovement>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private uid(user: AuthUser) {
    return user?.sub ?? null;
  }

  // HC hiện tại của material/lot/org từ sổ cái (dùng trong transaction để kiểm tồn).
  private async hcInTxn(mgr: EntityManager, filter: { materialCatalogId: string; organizationId: string; lotId?: string | null }): Promise<number> {
    const qb = mgr
      .getRepository(MaterielMovement)
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.quantity_signed),0)', 'hc')
      .where('m.material_catalog_id = :mat', { mat: filter.materialCatalogId })
      .andWhere('m.organization_id = :org', { org: filter.organizationId })
      .andWhere('m.status = :posted', { posted: MovementStatus.POSTED });
    if (filter.lotId) qb.andWhere('m.lot_id = :lot', { lot: filter.lotId });
    const row = await qb.getRawOne<{ hc: string }>();
    return Number(row?.hc ?? 0);
  }

  // ---- Documents ----
  async createDocument(dto: CreateDocumentDto, user: AuthUser): Promise<InventoryDocument> {
    return this.docs.save(
      this.docs.create({
        documentNo: `${dto.documentType.slice(0, 3)}-${Date.now()}`,
        documentType: dto.documentType,
        organizationId: dto.organizationId,
        counterpartyOrgId: dto.counterpartyOrgId ?? null,
        basisDocumentId: dto.basisDocumentId ?? null,
        effectiveDate: dto.effectiveDate,
        status: DocumentStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async getDocument(id: string, user?: AuthUser): Promise<InventoryDocument> {
    const d = await this.docs.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`DATA-001: Không có chứng từ ${id}`);
    assertReadScope(undefined, d.organizationId, user);
    return d;
  }

  async addLine(docId: string, dto: AddLineDto, user: AuthUser): Promise<InventoryDocumentLine> {
    const doc = await this.getDocument(docId);
    if (doc.status !== DocumentStatus.DRAFT) {
      throw new ConflictException('DATA-003: Chỉ thêm dòng khi chứng từ ở trạng thái DRAFT');
    }
    const count = await this.lines.count({ where: { documentId: docId } });
    return this.lines.save(
      this.lines.create({
        documentId: docId,
        lineNo: count + 1,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        assetId: dto.assetId ?? null,
        quantity: String(dto.quantity),
        unitId: dto.unitId ?? null,
        fromLocationId: dto.fromLocationId ?? null,
        toLocationId: dto.toLocationId ?? null,
        qualityGrade: dto.qualityGrade ?? null,
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async listDocuments(status?: string, user?: AuthUser, organizationId?: string) {
    const qb = this.docs.createQueryBuilder('d').orderBy('d.created_at', 'DESC').take(200);
    if (status) qb.andWhere('d.status = :st', { st: status });
    if (organizationId) qb.andWhere('d.organization_id = :org', { org: organizationId });
    applyOrgScope(qb, 'd', user); // SYS-BR-08: cưỡng chế phạm vi ngay cả khi caller không truyền org.
    return qb.getMany();
  }

  async transitionDocument(id: string, to: DocumentStatus, user: AuthUser): Promise<InventoryDocument> {
    const doc = await this.getDocument(id);
    assertTransition(DOCUMENT_TRANSITIONS, doc.status, to);
    doc.status = to;
    doc.updatedBy = this.uid(user);
    return this.docs.save(doc);
  }

  // POST nguyên tử: APPROVED→POSTED. Sinh N movement DT-04 all-or-nothing; kiểm tồn cho phần
  // giảm; cấm backdate kỳ LOCKED; ghi posting_batch + outbox (BR-DT05-002/010/011/026).
  async postDocument(id: string, user: AuthUser): Promise<{ document: InventoryDocument; batch: PostingBatch; movementCount: number }> {
    return this.dataSource.transaction(async (mgr) => {
      const docRepo = mgr.getRepository(InventoryDocument);
      const lineRepo = mgr.getRepository(InventoryDocumentLine);
      const moveRepo = mgr.getRepository(MaterielMovement);
      const batchRepo = mgr.getRepository(PostingBatch);

      const doc = await docRepo.findOne({ where: { id } });
      if (!doc) throw new NotFoundException(`DATA-001: Không có chứng từ ${id}`);
      // Idempotent: đã POST → trả lại batch hiện có.
      if (doc.status === DocumentStatus.POSTED && doc.postingBatchId) {
        const existing = await batchRepo.findOne({ where: { id: doc.postingBatchId } });
        if (existing) return { document: doc, batch: existing, movementCount: existing.movementCount };
      }
      assertTransition(DOCUMENT_TRANSITIONS, doc.status, DocumentStatus.POSTED);

      // Cấm backdate vào kỳ đã khóa của đơn vị.
      const locked = await mgr.getRepository(StockPeriod).find({
        where: { organizationId: doc.organizationId, status: StockPeriodStatus.LOCKED },
      });
      assertPeriodNotLocked(doc.effectiveDate, locked.map((p) => ({ from: p.periodFrom, to: p.periodTo })));

      const docLines = await lineRepo.find({ where: { documentId: id }, order: { lineNo: 'ASC' } });
      if (!docLines.length) throw new ConflictException('DATA-003: Chứng từ không có dòng nào để ghi sổ');

      let movementCount = 0;
      if (documentAffectsStock(doc.documentType)) {
        const moveType = movementTypeForDocument(doc.documentType);
        for (const line of docLines) {
          const signed = signedQuantity(moveType, Number(line.quantity));
          if (signed < 0) {
            const hcBefore = await this.hcInTxn(mgr, {
              materialCatalogId: line.materialCatalogId,
              organizationId: doc.organizationId,
              lotId: line.lotId,
            });
            assertSufficientStock(hcBefore, signed); // all-or-nothing: ném → rollback toàn bộ.
          }
          const movement = await moveRepo.save(
            moveRepo.create({
              transactionNo: `MV-${doc.documentNo}-${line.lineNo}`,
              transactionType: moveType,
              materialCatalogId: line.materialCatalogId,
              lotId: line.lotId,
              assetId: line.assetId,
              quantity: String(Math.abs(Number(line.quantity))),
              quantitySigned: String(signed),
              organizationId: doc.organizationId,
              fromLocationId: line.fromLocationId,
              toLocationId: line.toLocationId,
              documentId: doc.id,
              effectiveTime: new Date(doc.effectiveDate),
              postedAt: new Date(),
              status: MovementStatus.POSTED,
              createdBy: this.uid(user),
              updatedBy: this.uid(user),
            }),
          );
          line.movementId = movement.id;
          await lineRepo.save(line);
          movementCount += 1;
        }
      }

      const batch = await batchRepo.save(
        batchRepo.create({ documentId: doc.id, postedBy: this.uid(user), movementCount, status: 'POSTED' }),
      );
      doc.status = DocumentStatus.POSTED;
      doc.postedAt = new Date();
      doc.postingBatchId = batch.id;
      doc.updatedBy = this.uid(user);
      await docRepo.save(doc);

      await this.outbox.enqueue(mgr, {
        aggregateType: 'inventory_document',
        aggregateId: doc.id,
        eventType: 'inventory.document.posted',
        payload: { documentType: doc.documentType, movementCount, organizationId: doc.organizationId },
      });
      return { document: doc, batch, movementCount };
    });
  }

  // Reversal: chứng từ POSTED → tạo chứng từ đảo POSTED (movement đảo dấu), gốc REVERSED.
  async reverseDocument(id: string, user: AuthUser): Promise<InventoryDocument> {
    return this.dataSource.transaction(async (mgr) => {
      const docRepo = mgr.getRepository(InventoryDocument);
      const lineRepo = mgr.getRepository(InventoryDocumentLine);
      const moveRepo = mgr.getRepository(MaterielMovement);

      const orig = await docRepo.findOne({ where: { id } });
      if (!orig) throw new NotFoundException(`DATA-001: Không có chứng từ ${id}`);
      assertTransition(DOCUMENT_TRANSITIONS, orig.status, DocumentStatus.REVERSED);

      const reversal = await docRepo.save(
        docRepo.create({
          documentNo: `RV-${orig.documentNo}`,
          documentType: orig.documentType,
          organizationId: orig.organizationId,
          counterpartyOrgId: orig.counterpartyOrgId,
          effectiveDate: new Date().toISOString().slice(0, 10),
          status: DocumentStatus.POSTED,
          postedAt: new Date(),
          reversalOfId: orig.id,
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      const origMovements = await moveRepo.find({ where: { documentId: orig.id, status: MovementStatus.POSTED } });
      for (const m of origMovements) {
        await moveRepo.save(
          moveRepo.create({
            transactionNo: `RV-${m.transactionNo}`,
            transactionType: m.transactionType,
            materialCatalogId: m.materialCatalogId,
            lotId: m.lotId,
            assetId: m.assetId,
            quantity: m.quantity,
            quantitySigned: String(-Number(m.quantitySigned)),
            organizationId: m.organizationId,
            documentId: reversal.id,
            effectiveTime: new Date(),
            postedAt: new Date(),
            status: MovementStatus.POSTED,
            reversalOfId: m.id,
            reasonCode: 'REVERSAL',
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        );
        void lineRepo; // dòng đảo không bắt buộc cho MVP.
      }
      orig.status = DocumentStatus.REVERSED;
      orig.updatedBy = this.uid(user);
      await docRepo.save(orig);
      return reversal;
    });
  }

  // Truy vết chứng từ → dòng → movement → sổ cái (phục vụ DT-11).
  async trace(id: string, user?: AuthUser) {
    const doc = await this.getDocument(id, user);
    const lines = await this.lines.find({ where: { documentId: id }, order: { lineNo: 'ASC' } });
    const moveIds = lines.map((l) => l.movementId).filter((x): x is string => !!x);
    const movements = moveIds.length
      ? await this.movements.find({ where: moveIds.map((mid) => ({ id: mid })) })
      : [];
    return { document: doc, lines, movements };
  }

  // ---- Transfer 2 đầu (IN_TRANSIT không cộng trùng HC) ----
  async createTransfer(dto: CreateTransferDto, user: AuthUser): Promise<TransferOrder> {
    return this.transfers.save(
      this.transfers.create({
        orderNo: `TO-${Date.now()}`,
        fromOrg: dto.fromOrg,
        toOrg: dto.toOrg,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        dispatchedQty: String(dto.quantity),
        status: TransferStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async dispatchTransfer(id: string, user: AuthUser): Promise<TransferOrder> {
    return this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(TransferOrder);
      const moveRepo = mgr.getRepository(MaterielMovement);
      const order = await repo.findOne({ where: { id } });
      if (!order) throw new NotFoundException(`DATA-001: Không có lệnh điều chuyển ${id}`);
      assertTransition(TRANSFER_TRANSITIONS, order.status, TransferStatus.DISPATCHED);
      const qty = Number(order.dispatchedQty ?? 0);
      const hcBefore = await this.hcInTxn(mgr, { materialCatalogId: order.materialCatalogId, organizationId: order.fromOrg, lotId: order.lotId });
      assertSufficientStock(hcBefore, -qty);
      await moveRepo.save(
        moveRepo.create({
          transactionNo: `TRO-${order.orderNo}`,
          transactionType: MovementType.TRANSFER_OUT,
          materialCatalogId: order.materialCatalogId,
          lotId: order.lotId,
          quantity: String(qty),
          quantitySigned: String(-qty),
          organizationId: order.fromOrg,
          fromOrgId: order.fromOrg,
          toOrgId: order.toOrg,
          effectiveTime: new Date(),
          postedAt: new Date(),
          status: MovementStatus.POSTED,
          reasonCode: 'TRANSFER_OUT',
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      order.status = TransferStatus.IN_TRANSIT; // đã xuất, chưa nhận → không cộng bên nhận.
      order.dispatchedAt = new Date();
      order.updatedBy = this.uid(user);
      return repo.save(order);
    });
  }

  async receiveTransfer(id: string, receivedQty: number, user: AuthUser): Promise<TransferOrder> {
    return this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(TransferOrder);
      const moveRepo = mgr.getRepository(MaterielMovement);
      const order = await repo.findOne({ where: { id } });
      if (!order) throw new NotFoundException(`DATA-001: Không có lệnh điều chuyển ${id}`);
      assertTransition(TRANSFER_TRANSITIONS, order.status, TransferStatus.RECEIVED);
      await moveRepo.save(
        moveRepo.create({
          transactionNo: `TRI-${order.orderNo}`,
          transactionType: MovementType.TRANSFER_IN,
          materialCatalogId: order.materialCatalogId,
          lotId: order.lotId,
          quantity: String(receivedQty),
          quantitySigned: String(receivedQty),
          organizationId: order.toOrg,
          fromOrgId: order.fromOrg,
          toOrgId: order.toOrg,
          effectiveTime: new Date(),
          postedAt: new Date(),
          status: MovementStatus.POSTED,
          reasonCode: 'TRANSFER_IN',
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      const { discrepancy, hasDiscrepancy } = computeDiscrepancy(Number(order.dispatchedQty ?? 0), receivedQty);
      order.status = TransferStatus.RECEIVED;
      order.receivedQty = String(receivedQty);
      order.receivedAt = new Date();
      order.discrepancyNote = hasDiscrepancy ? `Chênh lệch giao–nhận: ${discrepancy}` : null;
      order.updatedBy = this.uid(user);
      return repo.save(order);
    });
  }

  async closeTransfer(id: string, user: AuthUser): Promise<TransferOrder> {
    const order = await this.transfers.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`DATA-001: Không có lệnh điều chuyển ${id}`);
    assertTransition(TRANSFER_TRANSITIONS, order.status, TransferStatus.CLOSED);
    order.status = TransferStatus.CLOSED;
    order.updatedBy = this.uid(user);
    return this.transfers.save(order);
  }

  async inTransit(user?: AuthUser) {
    const qb = this.transfers
      .createQueryBuilder('t')
      .where('t.status = :st', { st: TransferStatus.IN_TRANSIT });
    // SYS-BR-08: điều chuyển 2 đầu — thấy khi đơn vị mình là bên gửi HOẶC bên nhận.
    if (!isProvinceWide(user)) {
      const org = scopeOrganizationId(user) ?? '__none__';
      qb.andWhere('(t.from_org = :org OR t.to_org = :org)', { org });
    }
    return qb.getMany();
  }

  // ---- Stock periods (khóa kỳ) ----
  async createPeriod(dto: CreatePeriodDto, user: AuthUser): Promise<StockPeriod> {
    return this.periods.save(
      this.periods.create({ ...dto, status: StockPeriodStatus.OPEN, createdBy: this.uid(user), updatedBy: this.uid(user) }),
    );
  }

  async lockPeriod(id: string, user: AuthUser): Promise<StockPeriod> {
    const p = await this.periods.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`DATA-001: Không có kỳ ${id}`);
    p.status = StockPeriodStatus.LOCKED;
    p.lockedBy = this.uid(user);
    p.lockedAt = new Date();
    p.updatedBy = this.uid(user);
    return this.periods.save(p);
  }

  async unlockPeriod(id: string, reason: string, user: AuthUser): Promise<StockPeriod> {
    const p = await this.periods.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`DATA-001: Không có kỳ ${id}`);
    p.status = StockPeriodStatus.OPEN;
    p.unlockReason = reason;
    p.updatedBy = this.uid(user);
    return this.periods.save(p);
  }

  async listPeriods(organizationId?: string, user?: AuthUser) {
    const qb = this.periods.createQueryBuilder('p').orderBy('p.period_from', 'DESC');
    if (organizationId) qb.andWhere('p.organization_id = :org', { org: organizationId });
    applyOrgScope(qb, 'p', user); // SYS-BR-08
    return qb.getMany();
  }
}
