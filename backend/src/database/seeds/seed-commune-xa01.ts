// Seed dữ liệu MẪU ĐẦY ĐỦ cho tài khoản CẤP XÃ "xa01" (Can bo xa A01 (test), COMMUNE_USER) —
// phục vụ kiểm thử luồng dữ liệu + nghiệp vụ cấp xã đầu-cuối:
//   · Doanh trại (3 trạng thái duyệt) + công trình + kho trạm  → KPI CommuneWorkspace + trang /barracks, /storage
//   · Khu đất quốc phòng                                        → trang /land-parcels
//   · Hạ tầng điện · nước · máy phát                            → trang /utilities
//   · KHAI BÁO VẬT CHẤT (KBVC) — trọng tâm nhánh: 4 bản phủ đủ vòng đời DRAFT → PENDING_REVIEW →
//     CHANGES_REQUESTED → APPROVED(khóa) + revision bất biến + 1 đề nghị sửa sau duyệt (amendment).
//
// Mọi bản ghi GẮN organization_id + area_id của xã test ⇒ hiện đúng trong phạm vi (SYS-BR-08) khi
// đăng nhập xa01. Idempotent: dò theo mã (code) — chạy lại an toàn, không nhân bản.
// Chạy: `npm run seed:commune-xa01`  (đích DB theo .env gốc — mặc định 5435 stack :8000).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Barracks } from '../../modules/barracks/entities/barracks.entity';
import { Facility } from '../../modules/facilities/entities/facility.entity';
import { FacilityStatus } from '../../modules/facilities/facility-status';
import { StorageLocation } from '../../modules/inventory/entities/storage-location.entity';
import { LandParcel } from '../../modules/land-parcels/entities/land-parcel.entity';
import { UtilitySystem } from '../../modules/utilities/entities/utility-system.entity';
import { MaterialDeclaration } from '../../modules/material-declaration/entities/material-declaration.entity';
import { MaterialDeclarationLine } from '../../modules/material-declaration/entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from '../../modules/material-declaration/entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from '../../modules/material-declaration/entities/declaration-amendment-request.entity';
import { ReservePurpose } from '../../modules/material-declaration/material-declaration.enums';
import { DamageEvent } from '../../modules/maintenance/entities/damage-event.entity';
import { MaintenanceRequest } from '../../modules/maintenance/entities/maintenance-request.entity';
import { InspectionCampaign } from '../../modules/inspection/entities/inspection-campaign.entity';
import { InspectionSheet } from '../../modules/inspection/entities/inspection-sheet.entity';
import { WorkflowStatus, MaintenanceStatus, InspectionStatus, SheetStatus } from '../../common/workflow';
import { transitionWithRevision } from '../../common/workflow-transition';

const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });
const CENTER = { lng: 105.78, lat: 19.8 }; // tâm giả lập (xã test không có ranh giới GIS)
const s = (n: number) => n.toFixed(3); // numeric → chuỗi (TypeORM)

// Đơn giá (đồng) theo mã R00 — dựng giá trị biểu 02/KK.
const PRICE: Record<string, number> = {
  'R00.01.01': 850000,
  'R00.01.03': 1250000,
  'R00.01.04': 1450000,
  'R00.02.01': 1650000,
  'R00.02.02': 420000,
  'R00.03.01': 65000,
  'R00.03.02': 2200,
  'R00.04.01': 42000000,
};

interface Cat {
  id: string;
  code: string;
  name: string;
  unitId: string | null;
}

// Đặc tả 1 dòng vật chất: biến động kỳ + phân bổ vị trí kho + cấp chất lượng.
interface LineSpec {
  code: string;
  opening: number;
  increase: number;
  decrease: number;
  purpose?: ReservePurpose;
  grades?: [number, number, number, number, number]; // Σ nên = cuối kỳ
  store?: [number, number, number]; // [đang dùng, kho Bộ-Ngành, kho đơn vị], Σ nên = cuối kỳ
  note?: string;
}

async function run(): Promise<void> {
  const t0 = Date.now();
  await dataSource.initialize();
  const ds = dataSource;
  try {
    // --- 0) Tra tài khoản xã + phạm vi (đơn vị + địa bàn) ---
    const u = await ds.query(
      `SELECT id, organization_id,
              (SELECT (elem->>'refId') FROM jsonb_array_elements(COALESCE(data_scopes,'[]'::jsonb)) elem
                WHERE elem->>'type' = 'AREA' LIMIT 1) AS area_id
         FROM users WHERE username = 'xa01' LIMIT 1`,
    );
    if (!u?.[0]) throw new Error('Không tìm thấy tài khoản xa01 — chạy `npm run seed:users` trước.');
    const userId: string = u[0].id;
    const orgId: string | null = u[0].organization_id;
    const areaId: string | null = u[0].area_id;
    if (!orgId) throw new Error('Tài khoản xa01 chưa gán organization_id (phạm vi đơn vị).');
    console.log(`  · xa01 = ${userId}\n    org = ${orgId}\n    area = ${areaId ?? '(không có)'}`);

    // Người DUYỆT khác người lập (tách nhiệm vụ) — ưu tiên chỉ huy tỉnh, fallback admin.
    const approver = await ds.query(
      `SELECT id FROM users WHERE username IN ('chihuy','admin') ORDER BY (username='chihuy') DESC LIMIT 1`,
    );
    const approverId: string = approver?.[0]?.id ?? userId;

    // --- 1) Doanh trại (3 trạng thái) + công trình + kho ---
    const barracksRepo = ds.getRepository(Barracks);
    const facilityRepo = ds.getRepository(Facility);
    const storageRepo = ds.getRepository(StorageLocation);

    const barracksSpec: Array<{ code: string; name: string; status: WorkflowStatus; cap: number; land: number; fn: string }> = [
      { code: 'DT-XA01-01', name: 'Doanh trại Ban CHQS xã A01', status: WorkflowStatus.APPROVED, cap: 320, land: 22000, fn: 'Cơ quan chỉ huy' },
      { code: 'DT-XA01-02', name: 'Trạm quân y – hậu cần xã A01', status: WorkflowStatus.PENDING_REVIEW, cap: 120, land: 8000, fn: 'Bảo đảm hậu cần' },
      { code: 'DT-XA01-03', name: 'Điểm đóng quân dự bị động viên A01', status: WorkflowStatus.DRAFT, cap: 200, land: 15000, fn: 'Sẵn sàng chiến đấu' },
    ];
    let nBarracks = 0;
    const barracksByCode = new Map<string, Barracks>();
    for (let i = 0; i < barracksSpec.length; i++) {
      const b0 = barracksSpec[i];
      let b = await barracksRepo.findOne({ where: { code: b0.code } });
      if (!b) {
        b = await barracksRepo.save(
          barracksRepo.create({
            code: b0.code,
            name: b0.name,
            organizationId: orgId,
            areaId,
            declaredCapacity: b0.cap,
            landArea: s(b0.land),
            address: `Khu trung tâm xã A01 — vị trí ${i + 1}`,
            function: b0.fn,
            workflowStatus: b0.status,
            location: point(CENTER.lng + i * 0.01, CENTER.lat + i * 0.008),
            createdBy: userId,
            updatedBy: b0.status === WorkflowStatus.APPROVED ? approverId : userId,
          }),
        );
        nBarracks++;
      }
      barracksByCode.set(b0.code, b);
    }

    const mainBarracks = barracksByCode.get('DT-XA01-01')!;

    // Công trình tiêu biểu cho doanh trại chính (trang /barracks chi tiết).
    if (!(await facilityRepo.findOne({ where: { barracksId: mainBarracks.id, code: 'CT-01' } }))) {
      await facilityRepo.save(
        facilityRepo.create({
          barracksId: mainBarracks.id,
          code: 'CT-01',
          name: 'Nhà làm việc Ban CHQS xã',
          type: 'Nhà làm việc',
          area: s(560),
          declaredCapacity: 60,
          buildYear: 2015,
          condition: 'GOOD',
          status: FacilityStatus.IN_USE,
          houseClass: 'II',
          floors: 2,
          location: point(CENTER.lng + 0.002, CENTER.lat + 0.002),
          createdBy: userId,
          updatedBy: userId,
        }),
      );
    }

    // Kho trạm (2) — 1 gắn doanh trại chính (APPROVED, dùng cho KBVC), 1 kho SSCĐ độc lập (DRAFT).
    const khoSpec: Array<{ code: string; name: string; status: WorkflowStatus; barracksId: string | null; tons: number }> = [
      { code: 'KHO-XA01-01', name: 'Kho vật chất doanh trại xã A01', status: WorkflowStatus.APPROVED, barracksId: mainBarracks.id, tons: 250 },
      { code: 'KHO-XA01-02', name: 'Kho dự trữ SSCĐ xã A01', status: WorkflowStatus.DRAFT, barracksId: null, tons: 120 },
    ];
    const khoByCode = new Map<string, StorageLocation>();
    let nKho = 0;
    for (let i = 0; i < khoSpec.length; i++) {
      const k0 = khoSpec[i];
      let k = await storageRepo.findOne({ where: { code: k0.code } });
      if (!k) {
        k = await storageRepo.save(
          storageRepo.create({
            code: k0.code,
            name: k0.name,
            type: 'KHO-TONG',
            nganh: 'DT',
            cap: 'XA',
            capacityTons: s(k0.tons),
            barracksId: k0.barracksId,
            areaId,
            organizationId: orgId,
            workflowStatus: k0.status,
            location: point(CENTER.lng - 0.002 - i * 0.005, CENTER.lat - 0.002),
            status: 'ACTIVE',
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        nKho++;
      }
      khoByCode.set(k0.code, k);
    }
    const mainKho = khoByCode.get('KHO-XA01-01')!;

    // --- 2) Khu đất quốc phòng (trang /land-parcels) ---
    const landRepo = ds.getRepository(LandParcel);
    const landSpec: Array<{ code: string; name: string; area: number; status: WorkflowStatus; usage: string; dispute: string }> = [
      { code: 'LP-XA01-01', name: 'Khu đất Ban CHQS xã A01', area: 22000, status: WorkflowStatus.APPROVED, usage: 'IN_USE', dispute: 'NONE' },
      { code: 'LP-XA01-02', name: 'Khu đất huấn luyện DBĐV xã A01', area: 15000, status: WorkflowStatus.PENDING_REVIEW, usage: 'PLANNED', dispute: 'ENCROACHED' },
    ];
    let nLand = 0;
    for (let i = 0; i < landSpec.length; i++) {
      const l0 = landSpec[i];
      if (await landRepo.findOne({ where: { code: l0.code } })) continue;
      await landRepo.save(
        landRepo.create({
          code: l0.code,
          name: l0.name,
          organizationId: orgId,
          areaId,
          barracksId: i === 0 ? mainBarracks.id : null,
          address: `Thôn ${i + 1}, xã A01`,
          landArea: s(l0.area),
          landUseType: 'QUOC_PHONG',
          usageStatus: l0.usage,
          legalStatus: i === 0 ? 'CERTIFICATE' : 'PENDING',
          legalOrigin: i === 0 ? 'Bàn giao địa phương 2015' : null,
          certificateNo: i === 0 ? 'GCN-QP-A01-001' : null,
          pointCount: 1,
          areaDefense: s(i === 0 ? l0.area : l0.area * 0.8),
          areaEconomic: s(i === 0 ? 0 : l0.area * 0.2),
          areaFamily: s(0),
          disputeStatus: l0.dispute,
          disputeNote: l0.dispute === 'ENCROACHED' ? 'Hộ dân canh tác lấn ranh phía Đông, đang lập hồ sơ xử lý' : null,
          hasElectricity: true,
          hasWater: i === 0,
          workflowStatus: l0.status,
          location: point(CENTER.lng + 0.004 + i * 0.006, CENTER.lat + 0.004),
          createdBy: userId,
          updatedBy: l0.status === WorkflowStatus.APPROVED ? approverId : userId,
        }),
      );
      nLand++;
    }

    // --- 3) Hạ tầng điện · nước · máy phát (trang /utilities) ---
    const utilRepo = ds.getRepository(UtilitySystem);
    const utilSpec: Array<Partial<UtilitySystem> & { code: string }> = [
      { code: 'UT-XA01-DIEN-01', name: 'Trạm biến áp doanh trại xã A01', category: 'ELECTRICITY', kind: 'TRANSFORMER', capacity: s(180), capacityUnit: 'kVA', status: 'OPERATIONAL', meterNo: 'CT-A01-0001' },
      { code: 'UT-XA01-MPD-01', name: 'Máy phát điện dự phòng 100kVA', category: 'ELECTRICITY', kind: 'GENERATOR', capacity: s(100), capacityUnit: 'kVA', fuelType: 'DIESEL', fuelLevel: s(320), autonomyHours: s(18), status: 'STANDBY' },
      { code: 'UT-XA01-NUOC-01', name: 'Bể chứa nước sinh hoạt 150m³', category: 'WATER', kind: 'WATER_TANK', capacity: s(150), capacityUnit: 'm3', reserveVolume: s(120), reserveUnit: 'm3', status: 'OPERATIONAL' },
    ];
    let nUtil = 0;
    for (let i = 0; i < utilSpec.length; i++) {
      const w0 = utilSpec[i];
      if (await utilRepo.findOne({ where: { code: w0.code } })) continue;
      await utilRepo.save(
        utilRepo.create({
          ...w0,
          barracksId: mainBarracks.id,
          areaId,
          organizationId: orgId,
          location: point(CENTER.lng + 0.001 * i, CENTER.lat - 0.003),
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      nUtil++;
    }

    // --- 4) KHAI BÁO VẬT CHẤT (trọng tâm) ---
    // Danh mục chuẩn (leaf, ACTIVE) — 1 dòng/mã (chọn bản ổn định theo id nhỏ nhất).
    const catRows: Cat[] = (
      await ds.query(
        `SELECT DISTINCT ON (code) id, code, name, unit_id AS "unitId"
           FROM material_catalog WHERE is_leaf = true AND status = 'ACTIVE'
          ORDER BY code, id`,
      )
    ).map((r: any) => ({ id: r.id, code: r.code, name: r.name, unitId: r.unitId }));
    const catByCode = new Map(catRows.map((c) => [c.code, c] as const));

    const declRepo = ds.getRepository(MaterialDeclaration);
    const lineRepo = ds.getRepository(MaterialDeclarationLine);
    const amendRepo = ds.getRepository(DeclarationAmendmentRequest);

    // Ghi các dòng cho 1 bản khai báo (bỏ qua mã danh mục thiếu, không làm hỏng seed).
    async function writeLines(declId: string, specs: LineSpec[]): Promise<number> {
      let order = 0;
      let n = 0;
      for (const sp of specs) {
        const cat = catByCode.get(sp.code);
        if (!cat) {
          console.log(`    ! Bỏ dòng: thiếu danh mục ${sp.code}`);
          continue;
        }
        const closing = sp.opening + sp.increase - sp.decrease;
        const grades = sp.grades ?? [closing, 0, 0, 0, 0];
        const store = sp.store ?? [0, 0, closing];
        const price = PRICE[sp.code] ?? 0;
        await lineRepo.save(
          lineRepo.create({
            declarationId: declId,
            materialCatalogId: cat.id,
            aliasUsed: cat.name,
            unitId: cat.unitId,
            reservePurpose: sp.purpose ?? ReservePurpose.THUONG_XUYEN,
            openingQty: s(sp.opening),
            increaseQty: s(sp.increase),
            decreaseQty: s(sp.decrease),
            closingQty: s(closing),
            quantity: s(closing),
            inUseQty: s(store[0]),
            ministryStoreQty: s(store[1]),
            unitStoreQty: s(store[2]),
            qtyGrade1: s(grades[0]),
            qtyGrade2: s(grades[1]),
            qtyGrade3: s(grades[2]),
            qtyGrade4: s(grades[3]),
            qtyGrade5: s(grades[4]),
            openingValue: s(sp.opening * price),
            increaseValue: s(sp.increase * price),
            decreaseValue: s(sp.decrease * price),
            closingValue: s(closing * price),
            unitPrice: s(price),
            note: sp.note ?? null,
            sortOrder: order++,
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        n++;
      }
      return n;
    }

    // Chuyển trạng thái + ghi revision bất biến (đúng toolkit service dùng).
    const transition = (d: MaterialDeclaration, to: WorkflowStatus, by: string) =>
      transitionWithRevision(
        {
          dataSource: ds,
          entityTarget: MaterialDeclaration,
          revisionTarget: MaterialDeclarationRevision,
          fkColumn: 'declarationId',
          buildPayload: (saved) => ({
            code: saved.code,
            title: saved.title,
            organizationId: saved.organizationId,
            areaId: saved.areaId,
            periodLabel: saved.periodLabel,
          }),
        },
        d,
        to,
        by,
      );

    // Tạo (nếu chưa có) 1 bản khai báo DRAFT + dòng. Trả null nếu đã tồn tại (bỏ qua idempotent).
    async function ensureDecl(
      code: string,
      title: string,
      period: string,
      specs: LineSpec[],
    ): Promise<MaterialDeclaration | null> {
      if (await declRepo.findOne({ where: { code } })) {
        console.log(`    = Đã có KBVC ${code} — bỏ qua.`);
        return null;
      }
      const d = await declRepo.save(
        declRepo.create({
          code,
          title,
          organizationId: orgId,
          areaId,
          storageLocationId: mainKho.id,
          periodLabel: period,
          workflowStatus: WorkflowStatus.DRAFT,
          note: 'Dữ liệu mẫu kiểm thử luồng cấp xã',
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      const nl = await writeLines(d.id, specs);
      console.log(`    + KBVC ${code} (${title}) — ${nl} dòng`);
      return d;
    }

    // Bộ dòng dùng lại giữa các kỳ (đủ biến động + phân cấp chất lượng + tách vị trí kho).
    const linesQ1: LineSpec[] = [
      { code: 'R00.01.03', opening: 120, increase: 20, decrease: 5, grades: [110, 20, 5, 0, 0], store: [100, 0, 35], purpose: ReservePurpose.THUONG_XUYEN },
      { code: 'R00.01.01', opening: 40, increase: 6, decrease: 2, grades: [38, 6, 0, 0, 0], store: [30, 0, 14] },
      { code: 'R00.02.01', opening: 24, increase: 4, decrease: 0, grades: [24, 4, 0, 0, 0], store: [20, 0, 8] },
      { code: 'R00.04.01', opening: 1, increase: 1, decrease: 0, grades: [2, 0, 0, 0, 0], store: [1, 0, 1], purpose: ReservePurpose.SSCD, note: 'Máy phát dự phòng trạm chỉ huy' },
    ];
    const linesQ2: LineSpec[] = [
      { code: 'R00.01.03', opening: 135, increase: 10, decrease: 8, grades: [120, 20, 7, 0, 0], store: [110, 0, 27] },
      { code: 'R00.02.02', opening: 60, increase: 0, decrease: 6, grades: [50, 4, 0, 0, 0], store: [40, 0, 14] },
      { code: 'R00.03.02', opening: 500, increase: 300, decrease: 200, grades: [600, 0, 0, 0, 0], store: [0, 200, 400], purpose: ReservePurpose.GOI_DAU, note: 'Xi măng bảo dưỡng công trình' },
    ];
    const linesQ2b: LineSpec[] = [
      { code: 'R00.01.04', opening: 45, increase: 5, decrease: 0, grades: [45, 5, 0, 0, 0], store: [38, 0, 12] },
      { code: 'R00.03.01', opening: 80, increase: 40, decrease: 30, grades: [90, 0, 0, 0, 0], store: [0, 30, 60], purpose: ReservePurpose.THU_HOI_XU_LY },
    ];
    // Q3 (nháp): CỐ TÌNH để 1 dòng lệch tách vị trí kho ⇒ minh hoạ CẢNH BÁO đối chiếu 02/KK.
    const linesQ3: LineSpec[] = [
      { code: 'R00.01.03', opening: 145, increase: 12, decrease: 4, grades: [130, 20, 3, 0, 0], store: [100, 0, 20], note: 'Tổng vị trí kho lệch cuối kỳ — dữ liệu đang nhập dở' },
      { code: 'R00.02.01', opening: 28, increase: 2, decrease: 1, grades: [26, 3, 0, 0, 0], store: [22, 0, 7] },
    ];

    let nDecl = 0;
    // (a) Q1/2026 — DUYỆT & KHÓA + revision (DRAFT→PENDING_REVIEW→APPROVED) + đề nghị sửa.
    const q1 = await ensureDecl('KBVC-XA01-Q1-2026', 'Khai báo vật chất doanh trại xã A01 — Quý I/2026', 'Quý I/2026', linesQ1);
    if (q1) {
      await transition(q1, WorkflowStatus.PENDING_REVIEW, userId); // xã trình
      q1.lockedAt = new Date();
      q1.lockedBy = approverId;
      await transition(q1, WorkflowStatus.APPROVED, approverId); // cấp trên duyệt → khóa
      // Đề nghị sửa sau duyệt (đang chờ cấp trên).
      const reqCode = 'AMR-XA01-Q1-001';
      if (!(await amendRepo.findOne({ where: { requestCode: reqCode } }))) {
        await amendRepo.save(
          amendRepo.create({
            requestCode: reqCode,
            declarationId: q1.id,
            organizationId: orgId,
            requestedChanges: 'Điều chỉnh số lượng "Giường cá nhân" cuối kỳ từ 135 → 138 (bổ sung 03 chiếc tiếp nhận cuối kỳ).',
            reason: 'Sót chứng từ nhập ngày 28/3, đã có phiếu nhập kho bổ sung.',
            evidenceDocumentIds: [],
            status: WorkflowStatus.PENDING_REVIEW,
            submittedBy: userId,
            submittedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        console.log('    + Đề nghị sửa AMR-XA01-Q1-001 (PENDING_REVIEW)');
      }
      nDecl++;
    }

    // (b) Q2/2026 — CHỜ DUYỆT (đã trình).
    const q2 = await ensureDecl('KBVC-XA01-Q2-2026', 'Khai báo vật chất doanh trại xã A01 — Quý II/2026', 'Quý II/2026', linesQ2);
    if (q2) {
      await transition(q2, WorkflowStatus.PENDING_REVIEW, userId);
      nDecl++;
    }

    // (c) Q2/2026 bổ sung — BỊ TRẢ LẠI (CHANGES_REQUESTED).
    const q2b = await ensureDecl('KBVC-XA01-Q2-BS-2026', 'Khai báo vật chất bổ sung xã A01 — Quý II/2026', 'Quý II/2026 (bổ sung)', linesQ2b);
    if (q2b) {
      await transition(q2b, WorkflowStatus.PENDING_REVIEW, userId);
      await transition(q2b, WorkflowStatus.CHANGES_REQUESTED, approverId);
      nDecl++;
    }

    // (d) Q3/2026 — ĐANG NHẬP (DRAFT), có dòng cảnh báo đối chiếu.
    const q3 = await ensureDecl('KBVC-XA01-Q3-2026', 'Khai báo vật chất doanh trại xã A01 — Quý III/2026', 'Quý III/2026', linesQ3);
    if (q3) nDecl++;

    // --- 5) Kiểm kê (kiểm kê phiếu) + Sửa chữa (hư hỏng + yêu cầu) gắn doanh trại xã ---
    // Chứng minh cấp xã CHỈ thấy dữ liệu của mình ở các phân hệ này (đã vá rò rỉ phạm vi).
    const damageRepo = ds.getRepository(DamageEvent);
    const reqRepo = ds.getRepository(MaintenanceRequest);
    const campRepo = ds.getRepository(InspectionCampaign);
    const sheetRepo = ds.getRepository(InspectionSheet);

    // Hư hỏng trên doanh trại chính (đã xác minh) → phát sinh yêu cầu sửa chữa.
    let damage = await damageRepo.findOne({
      where: { entityType: 'barracks', entityId: mainBarracks.id },
    });
    if (!damage) {
      damage = await damageRepo.save(
        damageRepo.create({
          entityType: 'barracks',
          entityId: mainBarracks.id,
          causeCode: 'THIEN_TAI',
          severity: 'HIGH',
          description: 'Tốc mái tôn nhà làm việc sau bão số 3',
          estimatedLoss: '45000000',
          scenario: false,
          status: 'VERIFIED',
          reportedBy: userId,
          verifiedBy: approverId,
          verifiedAt: new Date(),
        }),
      );
    }
    let nMaint = 0;
    if (!(await reqRepo.findOne({ where: { code: 'SC-XA01-001' } }))) {
      await reqRepo.save(
        reqRepo.create({
          code: 'SC-XA01-001',
          title: 'Sửa chữa, lợp lại mái tôn nhà làm việc Ban CHQS xã A01',
          barracksId: mainBarracks.id,
          damageEventId: damage.id,
          priority: 'HIGH',
          estimatedCost: '52000000',
          plannedDays: 15,
          status: MaintenanceStatus.PROPOSED,
          assigneeName: 'Tổ bảo trì doanh trại',
          createdBy: userId,
        }),
      );
      nMaint++;
    }

    // Đợt kiểm kê (dùng chung toàn tỉnh) + phiếu kiểm kê của doanh trại xã.
    let camp = await campRepo.findOne({ where: { code: 'KK-DT-2026-Q3' } });
    if (!camp) {
      camp = await campRepo.save(
        campRepo.create({
          code: 'KK-DT-2026-Q3',
          name: 'Kiểm kê vật chất doanh trại — Quý III/2026',
          scope: {},
          status: InspectionStatus.OPEN,
          plannedFrom: new Date('2026-09-01T00:00:00Z'),
          plannedTo: new Date('2026-09-30T00:00:00Z'),
          createdBy: approverId,
        }),
      );
    }
    let nSheet = 0;
    const existSheet = await sheetRepo.findOne({
      where: { campaignId: camp.id, barracksId: mainBarracks.id },
    });
    if (!existSheet) {
      await sheetRepo.save(
        sheetRepo.create({
          campaignId: camp.id,
          barracksId: mainBarracks.id,
          status: SheetStatus.SUBMITTED,
          note: 'Phiếu kiểm kê doanh trại Ban CHQS xã A01 — đã nộp',
          submittedAt: new Date(),
          createdBy: userId,
        }),
      );
      nSheet++;
    }

    console.log(
      `\n  Xong: doanh trại +${nBarracks} · kho +${nKho} · khu đất +${nLand} · hạ tầng +${nUtil} · KBVC +${nDecl} · sửa chữa +${nMaint} · phiếu kiểm kê +${nSheet}. (${Date.now() - t0}ms)`,
    );
    console.log('  → Đăng nhập xa01 / admin@123 để kiểm tra luồng cấp xã.');
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('Seed commune xa01 lỗi:', err);
  process.exit(1);
});
