import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCatalogItem } from './entities/asset-catalog-item.entity';
import { AssetCatalogQuery } from './dto/asset-catalog.dto';
import { paginated } from '../../common/dto/pagination.dto';
import { ancestorsOf, toSearchText } from './asset-code.util';

// Số con lớn nhất của một nút trong phụ lục là 89 ("7/ Vật tư điện"), nên cây không
// cần phân trang. Vẫn chặn trần phòng bản phụ lục mới có nhánh lớn bất thường.
const TREE_CHILD_CAP = 500;

const isTrue = (v?: string) => v === 'true' || v === '1';

@Injectable()
export class AssetCatalogService {
  constructor(
    @InjectRepository(AssetCatalogItem)
    private readonly items: Repository<AssetCatalogItem>,
  ) {}

  /** Thông tin bản đang nạp + số liệu tự kiểm chứng toàn vẹn. */
  async getMeta() {
    const [head] = await this.items.find({ take: 1, order: { code: 'ASC' } });
    if (!head) {
      return {
        loaded: false,
        message:
          'Chưa nạp danh mục tài sản. Chạy: npm run seed:asset-catalog',
      };
    }

    const total = await this.items.count({ where: { status: 'ACTIVE' } });
    const leafCount = await this.items.count({ where: { status: 'ACTIVE', isLeaf: true } });
    const unitOnGroupCount = await this.items.count({
      where: { status: 'ACTIVE', unitOnGroup: true },
    });

    const levelRows = await this.items
      .createQueryBuilder('i')
      .select('i.level', 'level')
      .addSelect('COUNT(*)::int', 'count')
      .where('i.status = :s', { s: 'ACTIVE' })
      .groupBy('i.level')
      .orderBy('i.level', 'ASC')
      .getRawMany();

    const domainRows = await this.items
      .createQueryBuilder('i')
      .select('i.domain', 'domain')
      .addSelect('COUNT(*)::int', 'count')
      .where('i.status = :s', { s: 'ACTIVE' })
      .groupBy('i.domain')
      .getRawMany();

    // Chương: lấy từ DỮ LIỆU, không sinh dãy I..XVIII (phụ lục thiếu chương VI).
    const chapterRows = await this.items
      .createQueryBuilder('i')
      .select('i.chapter', 'chapter')
      .addSelect('MIN(i.chapter_name)', 'chapterName')
      .addSelect('MIN(i.domain)', 'domain')
      .addSelect('MIN(i.code)', 'rootCode')
      .addSelect('COUNT(*)::int', 'itemCount')
      .where('i.status = :s AND i.chapter IS NOT NULL', { s: 'ACTIVE' })
      .groupBy('i.chapter')
      .orderBy('MIN(i.code)', 'ASC')
      .getRawMany();

    const [{ groups }] = await this.items.query(
      `SELECT COUNT(DISTINCT duplicate_group)::int AS groups
         FROM asset_catalog_items WHERE duplicate_group IS NOT NULL`,
    );

    return {
      loaded: true,
      revision: head.revision,
      sourceDoc: head.sourceDoc,
      sourceSha: head.sourceSha,
      total,
      leafCount,
      groupCount: total - leafCount,
      // Số nút vừa có ĐVT vừa có con — CẢNH BÁO cộng trùng khi tổng hợp.
      unitOnGroupCount,
      duplicateGroupCount: groups,
      levelHistogram: Object.fromEntries(
        levelRows.map((r) => [r.level, Number(r.count)]),
      ),
      domains: Object.fromEntries(domainRows.map((r) => [r.domain, Number(r.count)])),
      chapters: chapterRows.map((r) => ({
        chapter: r.chapter,
        chapterName: r.chapterName,
        domain: r.domain,
        rootCode: r.rootCode,
        itemCount: Number(r.itemCount),
      })),
    };
  }

  /** Con trực tiếp của một nút (bỏ trống parent = nút gốc). */
  async getChildren(parent?: string, domain?: string, leafOnly?: string) {
    const qb = this.items
      .createQueryBuilder('i')
      .where('i.status = :s', { s: 'ACTIVE' })
      .orderBy('i.code', 'ASC')
      .take(TREE_CHILD_CAP + 1);

    if (parent) qb.andWhere('i.parent_code = :parent', { parent });
    else qb.andWhere('i.parent_code IS NULL');

    if (domain) qb.andWhere('i.domain = :domain', { domain });
    if (isTrue(leafOnly)) qb.andWhere('i.is_leaf = true');

    const rows = await qb.getMany();
    const hasMore = rows.length > TREE_CHILD_CAP;
    return { data: hasMore ? rows.slice(0, TREE_CHILD_CAP) : rows, hasMore };
  }

  /**
   * Tìm kiếm theo tên (không dấu) hoặc mã.
   * MỌI kết quả đều kèm `pathNames` — 121 dòng có tên đúng bằng "Các loại khác",
   * không có đường dẫn tổ tiên thì kết quả vô nghĩa.
   */
  async search(q: {
    q?: string;
    domain?: string;
    chapter?: string;
    leafOnly?: string;
    duplicatesOnly?: string;
    page: number;
    size: number;
    skip: number;
  }) {
    const qb = this.items
      .createQueryBuilder('i')
      .where('i.status = :s', { s: 'ACTIVE' })
      .orderBy('i.code', 'ASC')
      .skip(q.skip)
      .take(q.size);

    if (q.q?.trim()) {
      // So khớp trên search_text (đã bỏ dấu) để "bom" tìm ra "bơm";
      // đồng thời cho tìm trực tiếp theo mã.
      const needle = `%${toSearchText(q.q)}%`;
      const codeNeedle = `%${q.q.trim().toUpperCase()}%`;
      qb.andWhere('(i.search_text LIKE :needle OR UPPER(i.code) LIKE :codeNeedle)', {
        needle,
        codeNeedle,
      });
    }
    if (q.domain) qb.andWhere('i.domain = :domain', { domain: q.domain });
    if (q.chapter) qb.andWhere('i.chapter = :chapter', { chapter: q.chapter });
    if (isTrue(q.leafOnly)) qb.andWhere('i.is_leaf = true');
    if (isTrue(q.duplicatesOnly)) qb.andWhere('i.duplicate_group IS NOT NULL');

    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q as AssetCatalogQuery);
  }

  /** Chi tiết một mã + tổ tiên (để dựng breadcrumb) + con trực tiếp. */
  async getByCode(code: string) {
    const item = await this.items.findOne({ where: { code } });
    if (!item) throw new NotFoundException(`DATA-001: Không tìm thấy mã tài sản ${code}`);

    const ancestorCodes = ancestorsOf(code);
    const ancestors = ancestorCodes.length
      ? await this.items.find({
          where: ancestorCodes.map((c) => ({ code: c })),
          order: { code: 'ASC' },
        })
      : [];
    const children = await this.items.find({
      where: { parentCode: code, status: 'ACTIVE' },
      order: { code: 'ASC' },
    });

    return { item, ancestors, children };
  }

  /** Toàn bộ cây con của một mã (dùng cho xuất và tổng hợp). */
  async getSubtree(code: string, q: { leafOnly?: string; page: number; size: number; skip: number }) {
    const root = await this.items.findOne({ where: { code } });
    if (!root) throw new NotFoundException(`DATA-001: Không tìm thấy mã tài sản ${code}`);

    const qb = this.items
      .createQueryBuilder('i')
      .where('i.status = :s', { s: 'ACTIVE' })
      // path đã vật chất hoá + index varchar_pattern_ops → không cần CTE đệ quy.
      .andWhere('i.path LIKE :prefix', { prefix: `${root.path}%` })
      .orderBy('i.code', 'ASC')
      .skip(q.skip)
      .take(q.size);

    if (isTrue(q.leafOnly)) qb.andWhere('i.is_leaf = true');

    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q as AssetCatalogQuery);
  }

  /**
   * Vật chất / công trình chưa gắn mã quốc gia — nguồn của màn hình "Rà soát thiếu mã".
   * Lọc theo asset_code_status để mục đã đánh "ngoài phạm vi ngành Doanh trại"
   * không bị nhắc lại mãi.
   */
  async getGaps(q: {
    kind?: 'material' | 'facility';
    status?: string;
    search?: string;
    page: number;
    size: number;
    skip: number;
  }) {
    const kind = q.kind ?? 'material';
    const status = q.status ?? 'UNMAPPED';
    const table = kind === 'facility' ? 'facilities' : 'materials';

    const params: unknown[] = [status];
    let where = `WHERE t.asset_code_status = $1`;
    if (q.search?.trim()) {
      params.push(`%${q.search.trim()}%`);
      where += ` AND (t.code ILIKE $${params.length} OR t.name ILIKE $${params.length})`;
    }

    const [{ total }] = await this.items.query(
      `SELECT COUNT(*)::int AS total FROM ${table} t ${where}`,
      params,
    );
    const rows = await this.items.query(
      `SELECT t.id, t.code, t.name, t.asset_code AS "assetCode",
              t.asset_code_status AS "assetCodeStatus"
         FROM ${table} t ${where}
        ORDER BY t.code ASC
        LIMIT ${q.size} OFFSET ${q.skip}`,
      params,
    );

    return { data: rows, meta: { page: q.page, size: q.size, total: Number(total) } };
  }
}
