import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument } from './entities/legal-document.entity';
import { CreateLegalDocDto, UpdateLegalDocDto } from './dto/legal-document.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../identity/roles';

export interface LegalDocFilters {
  search?: string;
  docType?: string;
  effectiveStatus?: string;
  field?: string;
}

// Vai trò được xem văn bản độ mật cao (CONFIDENTIAL/SECRET). Người dùng khác chỉ thấy PUBLIC/INTERNAL.
const CLASSIFIED_ROLES: string[] = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.AUDITOR, Role.REVIEWER];

// M20 — Văn bản, tiêu chuẩn, định mức. CRUD + tìm kiếm + liên kết thay thế + phân quyền theo độ mật.
@Injectable()
export class LegalDocsService {
  constructor(
    @InjectRepository(LegalDocument) private readonly repo: Repository<LegalDocument>,
  ) {}

  private allowedConfidentiality(user?: AuthUser): string[] {
    const classified = user?.roles?.some((r) => CLASSIFIED_ROLES.includes(r)) ?? false;
    return classified ? ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] : ['PUBLIC', 'INTERNAL'];
  }

  async list(q: PaginationQuery, filters: LegalDocFilters, user?: AuthUser) {
    const where = this.repo.createQueryBuilder('d')
      .where('d.confidentiality = ANY(:conf)', { conf: this.allowedConfidentiality(user) });
    const countQb = this.repo.createQueryBuilder('d')
      .where('d.confidentiality = ANY(:conf)', { conf: this.allowedConfidentiality(user) });
    const apply = (b: typeof where) => {
      if (filters.search) b.andWhere('(d.doc_number ILIKE :s OR d.title ILIKE :s OR d.summary ILIKE :s OR d.keywords ILIKE :s OR d.issuing_body ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.docType) b.andWhere('d.doc_type = :dt', { dt: filters.docType });
      if (filters.effectiveStatus) b.andWhere('d.effective_status = :es', { es: filters.effectiveStatus });
      if (filters.field) b.andWhere('d.field = :fl', { fl: filters.field });
    };
    apply(where);
    apply(countQb);
    const [data, total] = await Promise.all([
      where.orderBy('d.issued_date', 'DESC', 'NULLS LAST').addOrderBy('d.doc_number', 'DESC').skip(q.skip).take(q.size).getMany(),
      countQb.getCount(),
    ]);
    return paginated(data.map((d) => this.slim(d)), total, q);
  }

  private slim(d: LegalDocument) {
    return {
      id: d.id, code: d.code, docNumber: d.docNumber, title: d.title, docType: d.docType,
      issuingBody: d.issuingBody, issuedDate: d.issuedDate, effectiveDate: d.effectiveDate, expiryDate: d.expiryDate,
      effectiveStatus: d.effectiveStatus, field: d.field, confidentiality: d.confidentiality, updatedAt: d.updatedAt,
    };
  }

  async get(id: string, user?: AuthUser) {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy văn bản');
    if (!this.allowedConfidentiality(user).includes(d.confidentiality)) {
      throw new ForbiddenException('AUTH-003: Không đủ thẩm quyền xem văn bản độ mật này');
    }
    // Liên kết thay thế: văn bản này thay thế văn bản nào + bị văn bản nào thay thế.
    const supersedes = d.supersedesId ? await this.repo.findOne({ where: { id: d.supersedesId }, select: { id: true, code: true, docNumber: true, title: true } as never }) : null;
    const supersededBy = await this.repo.find({ where: { supersedesId: d.id }, select: { id: true, code: true, docNumber: true, title: true } as never });
    return { ...d, supersedes: supersedes ?? null, supersededBy };
  }

  async create(dto: CreateLegalDocDto, user: AuthUser): Promise<LegalDocument> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã văn bản ${dto.code}`);
    const entity = this.repo.create({
      code: dto.code, docNumber: dto.docNumber, title: dto.title, docType: dto.docType ?? 'OTHER',
      issuingBody: dto.issuingBody ?? null, issuedDate: dto.issuedDate ?? null, effectiveDate: dto.effectiveDate ?? null,
      expiryDate: dto.expiryDate ?? null, effectiveStatus: dto.effectiveStatus ?? 'EFFECTIVE',
      field: dto.field ?? 'CHUNG', confidentiality: dto.confidentiality ?? 'INTERNAL',
      summary: dto.summary ?? null, keywords: dto.keywords ?? null, supersedesId: dto.supersedesId ?? null,
      sourceUrl: dto.sourceUrl ?? null, notes: dto.notes ?? null,
      createdBy: user.sub, updatedBy: user.sub,
    });
    const saved = await this.repo.save(entity);
    await this.markSuperseded(saved.supersedesId, user);
    return saved;
  }

  async update(id: string, dto: UpdateLegalDocDto, user: AuthUser): Promise<LegalDocument> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy văn bản');
    const prevSupersedes = d.supersedesId;
    const assign = <K extends keyof LegalDocument>(k: K, v: LegalDocument[K] | undefined) => { if (v !== undefined) d[k] = v; };
    assign('docNumber', dto.docNumber);
    assign('title', dto.title);
    assign('docType', dto.docType);
    assign('issuingBody', dto.issuingBody ?? undefined);
    assign('issuedDate', dto.issuedDate ?? undefined);
    assign('effectiveDate', dto.effectiveDate ?? undefined);
    assign('expiryDate', dto.expiryDate ?? undefined);
    assign('effectiveStatus', dto.effectiveStatus);
    assign('field', dto.field);
    assign('confidentiality', dto.confidentiality);
    assign('summary', dto.summary ?? undefined);
    assign('keywords', dto.keywords ?? undefined);
    if (dto.supersedesId !== undefined) d.supersedesId = dto.supersedesId || null;
    assign('sourceUrl', dto.sourceUrl ?? undefined);
    assign('notes', dto.notes ?? undefined);
    d.updatedBy = user.sub;
    const saved = await this.repo.save(d);
    if (saved.supersedesId && saved.supersedesId !== prevSupersedes) await this.markSuperseded(saved.supersedesId, user);
    return saved;
  }

  // Đánh dấu văn bản bị thay thế → SUPERSEDED (nếu đang hiệu lực).
  private async markSuperseded(targetId: string | null, user: AuthUser) {
    if (!targetId) return;
    const old = await this.repo.findOne({ where: { id: targetId } });
    if (old && old.effectiveStatus === 'EFFECTIVE') {
      old.effectiveStatus = 'SUPERSEDED';
      old.updatedBy = user.sub;
      await this.repo.save(old);
    }
  }

  async summary(user?: AuthUser) {
    const conf = this.allowedConfidentiality(user);
    const base = () => this.repo.createQueryBuilder('d').where('d.confidentiality = ANY(:conf)', { conf });
    const total = await base().getCount();
    const effective = await base().andWhere("d.effective_status = 'EFFECTIVE'").getCount();
    const expired = await base().andWhere("d.effective_status IN ('EXPIRED','REVOKED')").getCount();
    const expiringSoon = await base()
      .andWhere("d.effective_status = 'EFFECTIVE' AND d.expiry_date IS NOT NULL AND d.expiry_date < (now() + interval '60 days') AND d.expiry_date >= now()")
      .getCount();
    const byType = await base().select('d.doc_type', 'docType').addSelect('COUNT(*)', 'count').groupBy('d.doc_type').getRawMany();
    return {
      generatedAt: new Date().toISOString(),
      total, effective, expired, expiringSoon,
      byType: byType.map((r) => ({ docType: r.docType, count: Number(r.count) })),
    };
  }
}
