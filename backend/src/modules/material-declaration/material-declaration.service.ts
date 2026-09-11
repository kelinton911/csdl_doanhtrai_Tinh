import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MaterialDeclaration } from './entities/material-declaration.entity';
import { MaterialDeclarationLine } from './entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from './entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from './entities/declaration-amendment-request.entity';
import {
  CreateAmendmentDto,
  CreateDeclarationDto,
  CreateLineDto,
  ReviewDecisionDto,
  UpdateDeclarationDto,
  UpdateLineDto,
} from './dto/material-declaration.dto';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { assertReadScope, orgScopeWhere } from '../../common/scope/scope-query';

// Khai báo vật chất (cấp xã / đơn vị trực thuộc Tỉnh). CRUD đầy đủ khi chưa duyệt;
// duyệt xong khóa; sửa sau duyệt qua đề nghị cấp trên (amendment). Tái dùng toolkit
// workflow-transition + data-scope theo đơn vị (SYS-BR-08).
@Injectable()
export class MaterialDeclarationService {
  constructor(
    @InjectRepository(MaterialDeclaration)
    private readonly repo: Repository<MaterialDeclaration>,
    @InjectRepository(MaterialDeclarationLine)
    private readonly lines: Repository<MaterialDeclarationLine>,
    @InjectRepository(MaterialDeclarationRevision)
    private readonly revisions: Repository<MaterialDeclarationRevision>,
    @InjectRepository(DeclarationAmendmentRequest)
    private readonly amendments: Repository<DeclarationAmendmentRequest>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Bản khai báo ----------
  async list(user: AuthUser) {
    // orgScopeWhere: province-wide → {} (tất cả); ngược lại lọc theo organizationId.
    return this.repo.find({
      where: orgScopeWhere(user),
      order: { updatedAt: 'DESC' },
      take: 200,
    });
  }

  private async getEntity(id: string): Promise<MaterialDeclaration> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy bản khai báo');
    return d;
  }

  async get(id: string, user: AuthUser) {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    const lines = await this.lines.find({
      where: { declarationId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { ...d, lines };
  }

  async create(dto: CreateDeclarationDto, user: AuthUser): Promise<MaterialDeclaration> {
    const code = dto.code ?? `KBVC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dup = await this.repo.findOne({ where: { code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã bản khai báo ${code}`);
    return this.repo.save(
      this.repo.create({
        code,
        title: dto.title,
        organizationId: dto.organizationId ?? user.organizationId ?? null,
        areaId: dto.areaId ?? null,
        storageLocationId: dto.storageLocationId ?? null,
        periodLabel: dto.periodLabel ?? null,
        note: dto.note ?? null,
        workflowStatus: WorkflowStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async update(id: string, dto: UpdateDeclarationDto, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus);
    if (dto.title !== undefined) d.title = dto.title;
    if (dto.organizationId !== undefined) d.organizationId = dto.organizationId;
    if (dto.areaId !== undefined) d.areaId = dto.areaId;
    if (dto.storageLocationId !== undefined) d.storageLocationId = dto.storageLocationId;
    if (dto.periodLabel !== undefined) d.periodLabel = dto.periodLabel;
    if (dto.note !== undefined) d.note = dto.note;
    d.updatedBy = user.sub;
    return this.repo.save(d);
  }

  // Xóa chỉ khi DRAFT (chưa từng vào luồng duyệt) — bảo toàn dữ liệu đã trình/duyệt.
  async remove(id: string, user: AuthUser): Promise<{ deleted: true }> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    if (d.workflowStatus !== WorkflowStatus.DRAFT) {
      throw new ConflictException(
        `WF-001: Chỉ xóa bản khai báo ở trạng thái DRAFT (hiện ${d.workflowStatus})`,
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(MaterialDeclarationLine).delete({ declarationId: id });
      await m.getRepository(MaterialDeclaration).delete({ id });
    });
    return { deleted: true };
  }

  // ---------- Dòng vật chất ----------
  private async getEditableParent(declarationId: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus);
    return d;
  }

  async addLine(declarationId: string, dto: CreateLineDto, user: AuthUser): Promise<MaterialDeclarationLine> {
    await this.getEditableParent(declarationId, user);
    return this.lines.save(this.lines.create(this.lineFields(dto, { declarationId, user })));
  }

  async updateLine(lineId: string, dto: UpdateLineDto, user: AuthUser): Promise<MaterialDeclarationLine> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('DATA-001: Không tìm thấy dòng khai báo');
    await this.getEditableParent(line.declarationId, user);
    Object.assign(line, this.lineFields(dto, { user }));
    line.updatedBy = user.sub;
    return this.lines.save(line);
  }

  async deleteLine(lineId: string, user: AuthUser): Promise<{ deleted: true }> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('DATA-001: Không tìm thấy dòng khai báo');
    await this.getEditableParent(line.declarationId, user);
    await this.lines.delete({ id: lineId });
    return { deleted: true };
  }

  // Map DTO → cột (số lượng lưu dạng chuỗi numeric). Bỏ qua trường undefined khi cập nhật.
  private lineFields(
    dto: CreateLineDto | UpdateLineDto,
    ctx: { declarationId?: string; user: AuthUser },
  ): Partial<MaterialDeclarationLine> {
    const num = (v: number | undefined) => (v === undefined ? undefined : String(v));
    const out: Partial<MaterialDeclarationLine> = {
      materialCatalogId: dto.materialCatalogId,
      aliasUsed: dto.aliasUsed,
      unitId: dto.unitId,
      reservePurpose: dto.reservePurpose,
      quantity: num(dto.quantity),
      qtyGrade1: num(dto.qtyGrade1),
      qtyGrade2: num(dto.qtyGrade2),
      qtyGrade3: num(dto.qtyGrade3),
      qtyGrade4: num(dto.qtyGrade4),
      qtyGrade5: num(dto.qtyGrade5),
      unitPrice: num(dto.unitPrice),
      note: dto.note,
      sortOrder: dto.sortOrder,
    };
    if (ctx.declarationId) {
      out.declarationId = ctx.declarationId;
      out.createdBy = ctx.user.sub;
      out.updatedBy = ctx.user.sub;
    }
    // Loại bỏ khóa undefined để không ghi đè giá trị cũ khi PUT.
    (Object.keys(out) as Array<keyof MaterialDeclarationLine>).forEach((k) => {
      if (out[k] === undefined) delete out[k];
    });
    return out;
  }

  // ---------- Workflow duyệt ----------
  async submit(id: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    assertEditable(d.workflowStatus, 'gửi duyệt');
    return this.transition(d, WorkflowStatus.PENDING_REVIEW, user);
  }

  async approve(id: string, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertPendingReview(d.workflowStatus);
    assertNotSelfApprove(d.createdBy, user.sub);
    d.lockedAt = new Date();
    d.lockedBy = user.sub;
    return this.transition(d, WorkflowStatus.APPROVED, user);
  }

  async requestChanges(id: string, _dto: ReviewDecisionDto, user: AuthUser): Promise<MaterialDeclaration> {
    const d = await this.getEntity(id);
    assertPendingReview(d.workflowStatus, 'yêu cầu bổ sung');
    d.lockedAt = null;
    d.lockedBy = null;
    return this.transition(d, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  async listRevisions(id: string, user: AuthUser): Promise<MaterialDeclarationRevision[]> {
    const d = await this.getEntity(id);
    assertReadScope(undefined, d.organizationId, user);
    return this.revisions.find({ where: { declarationId: id }, order: { revisionNo: 'DESC' } });
  }

  private transition(d: MaterialDeclaration, to: WorkflowStatus, user: AuthUser): Promise<MaterialDeclaration> {
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
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
      user.sub,
    );
  }

  // ---------- Đề nghị sửa sau duyệt ----------
  async createAmendment(declarationId: string, dto: CreateAmendmentDto, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    if (d.workflowStatus !== WorkflowStatus.APPROVED) {
      throw new ConflictException('WF-001: Chỉ đề nghị sửa bản khai báo đã DUYỆT (APPROVED)');
    }
    return this.amendments.save(
      this.amendments.create({
        requestCode: `AMR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        declarationId,
        organizationId: d.organizationId,
        requestedChanges: dto.requestedChanges,
        reason: dto.reason,
        evidenceDocumentIds: dto.evidenceDocumentIds ?? [],
        status: WorkflowStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async listAmendments(declarationId: string, user: AuthUser): Promise<DeclarationAmendmentRequest[]> {
    const d = await this.getEntity(declarationId);
    assertReadScope(undefined, d.organizationId, user);
    return this.amendments.find({ where: { declarationId }, order: { createdAt: 'DESC' } });
  }

  private async getAmendment(id: string): Promise<DeclarationAmendmentRequest> {
    const a = await this.amendments.findOne({ where: { id } });
    if (!a) throw new NotFoundException('DATA-001: Không tìm thấy đề nghị sửa');
    return a;
  }

  async submitAmendment(id: string, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertReadScope(undefined, a.organizationId, user);
    assertEditable(a.status, 'gửi duyệt');
    a.status = WorkflowStatus.PENDING_REVIEW;
    a.submittedBy = user.sub;
    a.submittedAt = new Date();
    a.updatedBy = user.sub;
    return this.amendments.save(a);
  }

  // Duyệt đề nghị → mở khóa bản khai báo về CHANGES_REQUESTED để đơn vị tự sửa.
  async approveAmendment(id: string, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertPendingReview(a.status);
    assertNotSelfApprove(a.submittedBy, user.sub);
    a.status = WorkflowStatus.APPROVED;
    a.reviewedBy = user.sub;
    a.reviewedAt = new Date();
    a.updatedBy = user.sub;
    const saved = await this.amendments.save(a);
    // Mở khóa bản khai báo (chỉ khi đang APPROVED) để đơn vị chỉnh sửa.
    const d = await this.getEntity(a.declarationId);
    if (d.workflowStatus === WorkflowStatus.APPROVED) {
      d.lockedAt = null;
      d.lockedBy = null;
      await this.transition(d, WorkflowStatus.CHANGES_REQUESTED, user);
    }
    return saved;
  }

  async rejectAmendment(id: string, dto: ReviewDecisionDto, user: AuthUser): Promise<DeclarationAmendmentRequest> {
    const a = await this.getAmendment(id);
    assertPendingReview(a.status, 'từ chối');
    a.status = WorkflowStatus.REJECTED;
    a.reviewedBy = user.sub;
    a.reviewedAt = new Date();
    a.reviewNote = dto.note ?? null;
    a.updatedBy = user.sub;
    return this.amendments.save(a);
  }
}
