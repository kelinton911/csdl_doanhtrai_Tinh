import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InspectionCampaign } from './entities/inspection-campaign.entity';
import { InspectionSheet } from './entities/inspection-sheet.entity';
import { InspectionLine } from './entities/inspection-line.entity';
import { ReviewTask } from './entities/review-task.entity';
import {
  CreateCampaignDto,
  CreateSheetDto,
  ReviewDecisionDto,
  UpdateSheetDto,
} from './dto/inspection.dto';
import { InspectionStatus, SheetStatus } from '../../common/workflow';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

const EDITABLE_SHEET = [SheetStatus.DRAFT, SheetStatus.NEEDS_REVISION];

// M07 — Inspection & Review. UC-09 (đợt), UC-10 (phiếu), UC-11 (kiểm duyệt).
@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(InspectionCampaign) private readonly campaigns: Repository<InspectionCampaign>,
    @InjectRepository(InspectionSheet) private readonly sheets: Repository<InspectionSheet>,
    @InjectRepository(InspectionLine) private readonly lines: Repository<InspectionLine>,
    @InjectRepository(ReviewTask) private readonly tasks: Repository<ReviewTask>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ------- Đợt kiểm kê (UC-09) -------
  async listCampaigns(q: PaginationQuery) {
    const [data, total] = await this.campaigns.findAndCount({ order: { createdAt: 'DESC' }, skip: q.skip, take: q.size });
    return paginated(data, total, q);
  }

  async createCampaign(dto: CreateCampaignDto, user: AuthUser) {
    const dup = await this.campaigns.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã đợt kiểm kê ${dto.code}`);
    return this.campaigns.save(
      this.campaigns.create({
        code: dto.code,
        name: dto.name,
        scope: dto.scope ?? {},
        plannedFrom: dto.plannedFrom ? new Date(dto.plannedFrom) : null,
        plannedTo: dto.plannedTo ? new Date(dto.plannedTo) : null,
        status: InspectionStatus.PLANNED,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async openCampaign(id: string, user: AuthUser) {
    const c = await this.getCampaign(id);
    if (c.status !== InspectionStatus.PLANNED) {
      throw new ConflictException('WF-001: Chỉ phát hành đợt đang ở trạng thái PLANNED');
    }
    c.status = InspectionStatus.OPEN;
    c.updatedBy = user.sub;
    return this.campaigns.save(c);
  }

  // UC-09: đóng đợt kiểm kê (không xóa cứng). Chỉ đóng khi đang mở/đang xử lý.
  async closeCampaign(id: string, user: AuthUser) {
    const c = await this.getCampaign(id);
    const closable = [
      InspectionStatus.OPEN,
      InspectionStatus.IN_PROGRESS,
      InspectionStatus.SUBMITTED,
      InspectionStatus.RECONCILED,
    ];
    if (!closable.includes(c.status)) {
      throw new ConflictException(`WF-001: Không thể đóng đợt đang ở trạng thái ${c.status}`);
    }
    c.status = InspectionStatus.CLOSED;
    c.updatedBy = user.sub;
    return this.campaigns.save(c);
  }

  async campaignProgress(id: string) {
    await this.getCampaign(id);
    const rows = await this.sheets
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.campaign_id = :id', { id })
      .groupBy('s.status')
      .getRawMany();
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStatus[r.status] = Number(r.count);
      total += Number(r.count);
    }
    const approved = byStatus[SheetStatus.APPROVED] ?? 0;
    return { total, approved, byStatus, completion: total ? Math.round((approved / total) * 100) : 0 };
  }

  private async getCampaign(id: string) {
    const c = await this.campaigns.findOne({ where: { id } });
    if (!c) throw new NotFoundException('DATA-001: Không tìm thấy đợt kiểm kê');
    return c;
  }

  // ------- Phiếu kiểm kê (UC-10) -------
  async listSheets(q: PaginationQuery, campaignId?: string) {
    const where = campaignId ? { campaignId } : {};
    const [data, total] = await this.sheets.findAndCount({ where, order: { createdAt: 'DESC' }, skip: q.skip, take: q.size });
    return paginated(data, total, q);
  }

  async getSheet(id: string) {
    const s = await this.sheets.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy phiếu kiểm kê');
    const lines = await this.lines.find({ where: { sheetId: id } });
    const withVariance = lines.map((l) => ({
      ...l,
      expectedQuantity: l.expectedQuantity !== null ? Number(l.expectedQuantity) : null,
      countedQuantity: l.countedQuantity !== null ? Number(l.countedQuantity) : null,
      variance:
        l.expectedQuantity !== null && l.countedQuantity !== null
          ? Number(l.countedQuantity) - Number(l.expectedQuantity)
          : null,
    }));
    return { ...s, lines: withVariance };
  }

  async createSheet(dto: CreateSheetDto, user: AuthUser) {
    const c = await this.getCampaign(dto.campaignId);
    if (c.status === InspectionStatus.PLANNED) {
      throw new ConflictException('WF-001: Đợt kiểm kê chưa phát hành (OPEN)');
    }
    return this.sheets.save(
      this.sheets.create({
        campaignId: dto.campaignId,
        barracksId: dto.barracksId ?? null,
        note: dto.note ?? null,
        status: SheetStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  // Autosave: cập nhật + thay toàn bộ dòng (chỉ khi DRAFT/NEEDS_REVISION).
  async updateSheet(id: string, dto: UpdateSheetDto, user: AuthUser) {
    const s = await this.sheets.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy phiếu kiểm kê');
    if (!EDITABLE_SHEET.includes(s.status)) {
      throw new ConflictException(`WF-001: Phiếu ở trạng thái ${s.status}, không thể sửa`);
    }
    return this.dataSource.transaction(async (m) => {
      if (dto.note !== undefined) s.note = dto.note;
      s.updatedBy = user.sub;
      const saved = await m.getRepository(InspectionSheet).save(s);
      if (dto.lines) {
        await m.getRepository(InspectionLine).delete({ sheetId: id });
        if (dto.lines.length) {
          await m.getRepository(InspectionLine).save(
            dto.lines.map((l) =>
              m.getRepository(InspectionLine).create({
                sheetId: id,
                itemType: l.itemType,
                itemRef: l.itemRef ?? null,
                label: l.label,
                unitCode: l.unitCode ?? null,
                expectedQuantity: l.expectedQuantity !== undefined ? l.expectedQuantity.toFixed(3) : null,
                countedQuantity: l.countedQuantity !== undefined ? l.countedQuantity.toFixed(3) : null,
                condition: l.condition ?? null,
                note: l.note ?? null,
              }),
            ),
          );
        }
      }
      return saved;
    });
  }

  // UC-10: gửi duyệt → tạo ReviewTask (không gửi khi còn lỗi nghiêm trọng — thiếu dòng).
  async submitSheet(id: string, user: AuthUser) {
    const s = await this.sheets.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy phiếu kiểm kê');
    if (!EDITABLE_SHEET.includes(s.status)) {
      throw new ConflictException('WF-001: Chỉ gửi phiếu ở trạng thái DRAFT/NEEDS_REVISION');
    }
    const lineCount = await this.lines.count({ where: { sheetId: id } });
    if (lineCount === 0) {
      throw new ConflictException('WF-002: Không gửi phiếu rỗng — nhập ít nhất một dòng số liệu');
    }
    return this.dataSource.transaction(async (m) => {
      s.status = SheetStatus.SUBMITTED;
      s.submittedAt = new Date();
      s.updatedBy = user.sub;
      const saved = await m.getRepository(InspectionSheet).save(s);
      // Nhiệm vụ kiểm duyệt: chỉ một PENDING cho mỗi phiếu.
      await m.getRepository(ReviewTask).delete({ sheetId: id, status: 'PENDING' });
      await m.getRepository(ReviewTask).save(
        m.getRepository(ReviewTask).create({ sheetId: id, status: 'PENDING', submittedBy: user.sub }),
      );
      return saved;
    });
  }

  // ------- Kiểm duyệt (UC-11) -------
  async listReviewTasks(q: PaginationQuery, status = 'PENDING') {
    const [data, total] = await this.tasks.findAndCount({ where: { status }, order: { createdAt: 'ASC' }, skip: q.skip, take: q.size });
    return paginated(data, total, q);
  }

  async getReviewTask(id: string) {
    const t = await this.tasks.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ kiểm duyệt');
    const sheet = await this.getSheet(t.sheetId);
    return { ...t, sheet };
  }

  async approveTask(id: string, dto: ReviewDecisionDto, user: AuthUser) {
    return this.decide(id, 'APPROVED', SheetStatus.APPROVED, dto, user);
  }

  async requestRevision(id: string, dto: ReviewDecisionDto, user: AuthUser) {
    return this.decide(id, 'REVISION_REQUESTED', SheetStatus.NEEDS_REVISION, dto, user);
  }

  private async decide(
    id: string,
    taskStatus: string,
    sheetStatus: SheetStatus,
    dto: ReviewDecisionDto,
    user: AuthUser,
  ) {
    const t = await this.tasks.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ kiểm duyệt');
    if (t.status !== 'PENDING') {
      throw new ConflictException('WF-001: Nhiệm vụ đã được xử lý');
    }
    // Phân tách nhiệm vụ: người gửi không tự duyệt.
    if (t.submittedBy && t.submittedBy === user.sub) {
      throw new ForbiddenException('AUTH-003: Người lập phiếu không được tự kiểm duyệt');
    }
    return this.dataSource.transaction(async (m) => {
      t.status = taskStatus;
      t.reviewerId = user.sub;
      t.decisionNote = dto.note ?? null;
      t.decidedAt = new Date();
      const savedTask = await m.getRepository(ReviewTask).save(t);
      const s = await m.getRepository(InspectionSheet).findOne({ where: { id: t.sheetId } });
      if (s) {
        s.status = sheetStatus;
        s.updatedBy = user.sub;
        await m.getRepository(InspectionSheet).save(s);
      }
      await this.audit.record({
        actorId: user.sub,
        actorName: user.username,
        action: `INSPECTION_${taskStatus}`,
        entityType: 'inspection_sheet',
        entityId: t.sheetId,
        after: { decision: taskStatus, note: dto.note ?? null },
      });
      return savedTask;
    });
  }
}
