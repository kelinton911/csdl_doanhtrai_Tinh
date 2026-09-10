// [05] DT-05 — Nhập–xuất–điều chuyển (Quyển V). Chứng từ POSTED sinh movement DT-04 (posting),
// mỗi dòng gắn movement_id (truy vết TC-HD-002); điều chuyển 2 đầu giữa 2 xã (TRANSFER_OUT/IN).
// Giữ Σ POSTED ≥ 0 theo (vật chất, đơn vị). Idempotent theo document_no/order_no/transaction_no.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InventoryDocument } from '../../../modules/dt05-documents/entities/inventory-document.entity';
import { InventoryDocumentLine } from '../../../modules/dt05-documents/entities/inventory-document-line.entity';
import { TransferOrder } from '../../../modules/dt05-documents/entities/transfer-order.entity';
import { InventoryDocumentType, TransferStatus } from '../../../modules/dt05-documents/dt05.enums';
import { DocumentStatus } from '../../../common/enums';
import { MaterielMovement } from '../../../modules/dt04-materiel/entities/materiel-movement.entity';
import { MovementStatus, MovementType } from '../../../modules/dt04-materiel/materiel-rules';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, MATERIALS, CORE_MATERIAL_CODES, CHAIN, T_DOC } from './_shared/demo-ids';

const CORE = MATERIALS.filter((m) => CORE_MATERIAL_CODES.includes(m.code));

export async function run(ds: DataSource): Promise<void> {
  const docRepo = ds.getRepository(InventoryDocument);
  const lineRepo = ds.getRepository(InventoryDocumentLine);
  const transferRepo = ds.getRepository(TransferOrder);
  const moveRepo = ds.getRepository(MaterielMovement);

  const communes = await pickRepresentativeCommunes(ds, 2);
  if (communes.length < 2) {
    console.log('  [05] DT-05: cần ≥2 xã đại diện — bỏ qua.');
    return;
  }
  const [orgA, orgB] = communes;

  const lotId = async (orgCode: string, matCode: string): Promise<string | null> => {
    const r = await ds.query(`SELECT id FROM inventory_lot WHERE lot_code = $1 LIMIT 1`, [CHAIN.lotCode(orgCode, matCode)]);
    return r?.[0]?.id ?? null;
  };
  const postMovement = async (opts: {
    txNo: string; type: MovementType; matId: string; orgId: string; qty: number; sign: 1 | -1; docId?: string | null; lotId?: string | null;
  }): Promise<string> => {
    const existing = await moveRepo.findOne({ where: { transactionNo: opts.txNo } });
    if (existing) return existing.id;
    const mv = await moveRepo.save(
      moveRepo.create({
        transactionNo: opts.txNo,
        transactionType: opts.type,
        materialCatalogId: opts.matId,
        lotId: opts.lotId ?? null,
        quantity: String(opts.qty),
        quantitySigned: String(opts.sign * opts.qty),
        organizationId: opts.orgId,
        documentId: opts.docId ?? null,
        effectiveTime: T_DOC,
        postedAt: T_DOC,
        status: MovementStatus.POSTED,
      }),
    );
    return mv.id;
  };

  let nDoc = 0;
  let nTransfer = 0;

  // 1) Chứng từ XUẤT tại xã A (2 dòng) → POST sinh movement ISSUE (−).
  const issueNo = CHAIN.documentNo(orgA.orgCode, 1);
  let issueDoc = await docRepo.findOne({ where: { documentNo: issueNo } });
  if (!issueDoc) {
    issueDoc = await docRepo.save(
      docRepo.create({
        documentNo: issueNo,
        documentType: InventoryDocumentType.ISSUE,
        organizationId: orgA.orgId,
        effectiveDate: '2026-07-15',
        status: DocumentStatus.POSTED,
        postedAt: T_DOC,
      }),
    );
    const issueLines: Array<{ mat: (typeof CORE)[number]; qty: number }> = [
      { mat: CORE[0], qty: 20 },
      { mat: CORE[1], qty: 15 },
    ];
    let lineNo = 1;
    for (const l of issueLines) {
      const mvId = await postMovement({
        txNo: `MV-${issueNo}-${lineNo}`,
        type: MovementType.ISSUE,
        matId: l.mat.id,
        orgId: orgA.orgId,
        qty: l.qty,
        sign: -1,
        docId: issueDoc.id,
        lotId: await lotId(orgA.orgCode, l.mat.code),
      });
      await lineRepo.save(
        lineRepo.create({
          documentId: issueDoc.id,
          lineNo,
          materialCatalogId: l.mat.id,
          quantity: String(l.qty),
          movementId: mvId,
        }),
      );
      lineNo++;
    }
    nDoc++;
  }

  // 2) Chứng từ NHẬP tại xã B (1 dòng) → POST sinh movement RECEIPT (+).
  const recvNo = CHAIN.documentNo(orgB.orgCode, 1);
  let recvDoc = await docRepo.findOne({ where: { documentNo: recvNo } });
  if (!recvDoc) {
    recvDoc = await docRepo.save(
      docRepo.create({
        documentNo: recvNo,
        documentType: InventoryDocumentType.RECEIPT,
        organizationId: orgB.orgId,
        effectiveDate: '2026-07-15',
        status: DocumentStatus.POSTED,
        postedAt: T_DOC,
      }),
    );
    const mvId = await postMovement({
      txNo: `MV-${recvNo}-1`,
      type: MovementType.RECEIPT,
      matId: CORE[2].id,
      orgId: orgB.orgId,
      qty: 40,
      sign: 1,
      docId: recvDoc.id,
      lotId: await lotId(orgB.orgCode, CORE[2].code),
    });
    await lineRepo.save(
      lineRepo.create({ documentId: recvDoc.id, lineNo: 1, materialCatalogId: CORE[2].id, quantity: '40', movementId: mvId }),
    );
    nDoc++;
  }

  // 3) Điều chuyển 2 đầu A→B cho CORE[3] (30): TRANSFER_OUT (A −30) + TRANSFER_IN (B +30).
  const orderNo = CHAIN.transferNo(orgA.orgCode, orgB.orgCode);
  if (!(await transferRepo.findOne({ where: { orderNo } }))) {
    await postMovement({
      txNo: `MV-${orderNo}-OUT`,
      type: MovementType.TRANSFER_OUT,
      matId: CORE[3].id,
      orgId: orgA.orgId,
      qty: 30,
      sign: -1,
      lotId: await lotId(orgA.orgCode, CORE[3].code),
    });
    await postMovement({
      txNo: `MV-${orderNo}-IN`,
      type: MovementType.TRANSFER_IN,
      matId: CORE[3].id,
      orgId: orgB.orgId,
      qty: 30,
      sign: 1,
    });
    await transferRepo.save(
      transferRepo.create({
        orderNo,
        fromOrg: orgA.orgId,
        toOrg: orgB.orgId,
        materialCatalogId: CORE[3].id,
        dispatchedQty: '30',
        receivedQty: '30',
        dispatchedAt: T_DOC,
        receivedAt: T_DOC,
        status: TransferStatus.RECEIVED,
      }),
    );
    nTransfer++;
  }

  console.log(`  [05] DT-05: chứng từ POSTED +${nDoc} · điều chuyển 2 đầu +${nTransfer} (sinh movement DT-04).`);
}

if (require.main === module) standalone(run);
