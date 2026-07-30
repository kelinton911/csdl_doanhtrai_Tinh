import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface PendingApproval {
  kind: 'barracks' | 'storage';
  id: string;
  code: string;
  name: string;
  areaName: string | null;
  workflowStatus: string;
  updatedAt: string;
}

// Hàng chờ duyệt GỘP: tổng hợp mọi hồ sơ đang chờ duyệt (doanh trại + kho trạm) để
// chỉ huy xã duyệt tại MỘT chỗ thay vì đi từng module. Lọc theo phạm vi dữ liệu.
@Injectable()
export class ApprovalsService {
  constructor(private readonly dataSource: DataSource) {}

  async pending(user: AuthUser): Promise<PendingApproval[]> {
    const scope = barracksScope(user);
    const params: unknown[] = [];
    let barracksWhere = "b.workflow_status = 'PENDING_REVIEW'";
    let storageWhere = "l.workflow_status = 'PENDING_REVIEW'";
    if (scope) {
      params.push(scope.areaIds, scope.organizationId);
      barracksWhere += ' AND (b.area_id = ANY($1::uuid[]) OR b.organization_id = $2)';
      storageWhere += ' AND (l.area_id = ANY($1::uuid[]) OR l.organization_id = $2)';
    }
    const sql = `
      SELECT 'barracks' AS kind, b.id::text AS id, b.code AS code, b.name AS name,
             a.name AS "areaName", b.workflow_status AS "workflowStatus",
             b.updated_at AS "updatedAt"
      FROM barracks b
      LEFT JOIN administrative_areas a ON a.id = b.area_id
      WHERE ${barracksWhere}
      UNION ALL
      SELECT 'storage' AS kind, l.id::text AS id, l.code AS code, l.name AS name,
             a.name AS "areaName", l.workflow_status AS "workflowStatus",
             l.updated_at AS "updatedAt"
      FROM storage_locations l
      LEFT JOIN administrative_areas a ON a.id = l.area_id
      WHERE ${storageWhere}
      ORDER BY "updatedAt" ASC
    `;
    return this.dataSource.query(sql, params);
  }
}
