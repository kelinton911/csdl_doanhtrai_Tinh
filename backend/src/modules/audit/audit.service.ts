import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuditLog } from './entities/audit-log.entity';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';

export interface AuditRecordInput {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  correlationId?: string | null;
}

// Ghi nhật ký append-only. Không bao giờ chặn luồng nghiệp vụ nếu ghi log lỗi.
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.repo.insert(input as QueryDeepPartialEntity<AuditLog>);
    } catch (err) {
      // Không để lỗi ghi audit làm hỏng request chính.
      this.logger.warn(`Không ghi được audit: ${(err as Error).message}`);
    }
  }

  async list(
    q: PaginationQuery,
    filters: { actorId?: string; entityType?: string; correlationId?: string },
  ) {
    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .skip(q.skip)
      .take(q.size);
    if (filters.actorId) qb.andWhere('a.actor_id = :actorId', filters);
    if (filters.entityType) qb.andWhere('a.entity_type = :entityType', filters);
    if (filters.correlationId)
      qb.andWhere('a.correlation_id = :correlationId', filters);
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async get(id: string) {
    return this.repo.findOne({ where: { id } });
  }
}
