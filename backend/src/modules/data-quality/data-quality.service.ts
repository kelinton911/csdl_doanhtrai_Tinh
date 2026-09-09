import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { isProvinceWide, scopeOrganizationId } from '../../common/data-scope';
import { DqCheck, classifyDq, skippedDq, summarizeDq } from './data-quality.rules';

// Kiểm tra chất lượng dữ liệu toàn hệ (§6 Hardening). Mỗi check là 1 câu đếm vi phạm,
// bọc try/catch để bảng chưa tồn tại → SKIPPED (không làm sập cả báo cáo). Lọc theo
// data-scope đơn vị (SYS-BR-08): province-wide xem toàn tỉnh; ngược lại chỉ đơn vị mình.
@Injectable()
export class DataQualityService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async systemReport(user?: AuthUser) {
    const org = isProvinceWide(user) ? null : scopeOrganizationId(user);
    const checks: DqCheck[] = [];

    // 1) Tồn âm (SYS-BR bất biến): Σ signed POSTED < 0 theo material+org.
    checks.push(
      await this.count(
        'NEGATIVE_STOCK',
        'Tồn kho âm theo vật chất/đơn vị',
        `SELECT count(*) FROM (
           SELECT material_catalog_id, organization_id
           FROM materiel_movement
           WHERE status = 'POSTED' ${org ? 'AND organization_id = $1' : ''}
           GROUP BY material_catalog_id, organization_id
           HAVING COALESCE(SUM(quantity_signed),0) < 0
         ) t`,
        org ? [org] : [],
        'FAIL',
      ),
    );

    // 2) Dataset lệch/không đạt kiểm định (DT-11): dataset_validation FAIL.
    checks.push(
      await this.count(
        'DATASET_VALIDATION_FAIL',
        'Dataset không đạt reconciliation/quality (DT-11)',
        `SELECT count(*) FROM dataset_validation WHERE status = 'FAIL'`,
        [],
        'WARN',
      ),
    );

    // 3) Định mức chưa có căn cứ (DT-07): material_norm LEGACY_UNVERIFIED (không dùng chính thức).
    checks.push(
      await this.count(
        'LEGACY_UNVERIFIED_NORMS',
        'Định mức legacy chưa xác minh căn cứ (DT-07)',
        `SELECT count(*) FROM material_norm WHERE source_status = 'LEGACY_UNVERIFIED'`,
        [],
        'WARN',
      ),
    );

    // 4) Outbox tồn đọng lỗi (vận hành): FAILED (đã hết retry — dead-letter).
    checks.push(
      await this.count(
        'OUTBOX_FAILED',
        'Sự kiện outbox thất bại (dead-letter)',
        `SELECT count(*) FROM outbox_event WHERE status = 'FAILED'`,
        [],
        'WARN',
      ),
    );

    return {
      time: new Date().toISOString(),
      scope: org ? { organizationId: org } : { provinceWide: true },
      summary: summarizeDq(checks),
      checks,
    };
  }

  private async count(
    code: string,
    title: string,
    sql: string,
    params: unknown[],
    severity: 'FAIL' | 'WARN',
  ): Promise<DqCheck> {
    try {
      const rows = await this.ds.query(sql, params);
      const n = Number(rows?.[0]?.count ?? 0);
      return classifyDq(code, title, n, severity);
    } catch (err) {
      return skippedDq(code, title, (err as Error).message);
    }
  }
}
