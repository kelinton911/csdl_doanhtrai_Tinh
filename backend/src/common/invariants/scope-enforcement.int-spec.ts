// Integration test SYS-BR-08 (§4 Hardening, TC-HD-004/005) — chạy trên DB THẬT.
// Chứng minh khép rò rỉ dữ liệu chéo đơn vị: list chỉ trả phạm vi được giao; đọc chéo
// đơn vị → 403 NO_PERMISSION_SCOPE; user toàn tỉnh xem tất cả.
// Chạy: `npm run test:int` (cần DB dev — .env, mặc định 5435).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { OutboxEvent } from '../outbox/outbox-event.entity';
import { OutboxService } from '../outbox/outbox.service';
import { BusinessError, BusinessException } from '../errors/business-error';
import type { AuthUser } from '../decorators/current-user.decorator';

import { DocumentsService } from '../../modules/dt05-documents/documents.service';
import { InventoryDocument } from '../../modules/dt05-documents/entities/inventory-document.entity';
import { InventoryDocumentLine } from '../../modules/dt05-documents/entities/inventory-document-line.entity';
import { PostingBatch } from '../../modules/dt05-documents/entities/posting-batch.entity';
import { TransferOrder } from '../../modules/dt05-documents/entities/transfer-order.entity';
import { StockPeriod } from '../../modules/dt05-documents/entities/stock-period.entity';
import { MaterielMovement } from '../../modules/dt04-materiel/entities/materiel-movement.entity';
import { InventoryDocumentType } from '../../modules/dt05-documents/dt05.enums';

const RUN = Date.now();
const ORG_A = '00000000-0000-0000-0000-0000000c5a01';
const ORG_B = '00000000-0000-0000-0000-0000000c5b02';

// Toàn tỉnh (SYS_ADMIN) vs giới hạn đơn vị A (COMMUNE_USER).
const provincial: AuthUser = { sub: 'it-admin', username: 'admin', roles: ['SYS_ADMIN'], organizationId: null };
const scopedA: AuthUser = { sub: 'it-xaA', username: 'xaA', roles: ['COMMUNE_USER'], organizationId: ORG_A };

describe('SYS-BR-08 data-scope — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: DocumentsService;
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    const outbox = new OutboxService(ds.getRepository(OutboxEvent));
    svc = new DocumentsService(
      ds.getRepository(InventoryDocument),
      ds.getRepository(InventoryDocumentLine),
      ds.getRepository(PostingBatch),
      ds.getRepository(TransferOrder),
      ds.getRepository(StockPeriod),
      ds.getRepository(MaterielMovement),
      ds,
      outbox,
    );

    const mk = (org: string) =>
      svc.createDocument(
        { documentType: InventoryDocumentType.RECEIPT, organizationId: org, effectiveDate: '2026-06-01' },
        provincial,
      );
    const a = await mk(ORG_A);
    const b = await mk(ORG_B);
    createdDocIds.push(a.id, b.id);
  });

  afterAll(async () => {
    if (createdDocIds.length) {
      await ds.getRepository(InventoryDocument).delete(createdDocIds);
    }
    await ds.destroy();
  });

  it('list: user toàn tỉnh thấy cả 2 đơn vị; user giới hạn A chỉ thấy đơn vị A (TC-HD-004)', async () => {
    const all = await svc.listDocuments(undefined, provincial);
    const orgsAll = new Set(all.map((d) => d.organizationId));
    expect(orgsAll.has(ORG_A)).toBe(true);
    expect(orgsAll.has(ORG_B)).toBe(true);

    const mine = await svc.listDocuments(undefined, scopedA);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((d) => d.organizationId === ORG_A)).toBe(true);
    expect(mine.some((d) => d.organizationId === ORG_B)).toBe(false);
  });

  it('read: đọc chứng từ đơn vị khác → 403 NO_PERMISSION_SCOPE; đúng đơn vị/ toàn tỉnh → OK (TC-HD-004/005)', async () => {
    const [, docB] = createdDocIds;
    // scopedA đọc chứng từ ORG_B → chặn.
    try {
      await svc.getDocument(docB, scopedA);
      throw new Error('đáng lẽ 403');
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException);
      expect((e as BusinessException).code).toBe(BusinessError.NO_PERMISSION_SCOPE);
    }
    // Toàn tỉnh đọc được.
    const okAdmin = await svc.getDocument(docB, provincial);
    expect(okAdmin.organizationId).toBe(ORG_B);
  });
});
