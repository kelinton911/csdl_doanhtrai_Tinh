import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { C3Catalog } from './entities/c3-catalog.entity';
import { C3Query } from './dto/c3-query.dto';
import { paginated } from '../../common/dto/pagination.dto';

export interface C3SeedRow {
  c3Code: string;
  name: string;
  subsystem: string;
  useCase?: string | null;
  businessRule?: string | null;
  screen?: string | null;
  api?: string | null;
  test?: string | null;
  description?: string | null;
}

@Injectable()
export class C3CatalogService {
  constructor(
    @InjectRepository(C3Catalog)
    private readonly repo: Repository<C3Catalog>,
  ) {}

  async list(q: C3Query) {
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.c3_code', 'ASC')
      .skip(q.skip)
      .take(q.size);
    if (q.subsystem) qb.andWhere('c.subsystem = :subsystem', { subsystem: q.subsystem });
    if (q.search) {
      qb.andWhere('(c.c3_code ILIKE :s OR c.name ILIKE :s OR c.description ILIKE :s)', {
        s: `%${q.search}%`,
      });
    }
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async getByCode(code: string): Promise<C3Catalog> {
    const row = await this.repo.findOne({ where: { c3Code: code } });
    if (!row) throw new NotFoundException(`DATA-001: Không có mã C3 ${code}`);
    return row;
  }

  // Import/seed idempotent theo c3_code (upsert) — chạy lại không sinh trùng.
  async upsertMany(rows: C3SeedRow[]): Promise<number> {
    for (const r of rows) {
      const existing = await this.repo.findOne({ where: { c3Code: r.c3Code } });
      if (existing) {
        await this.repo.update(existing.id, r);
      } else {
        await this.repo.insert(this.repo.create(r));
      }
    }
    return rows.length;
  }
}
