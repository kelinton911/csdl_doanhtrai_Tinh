import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { EDITABLE_STATUSES, WorkflowStatus } from './workflow';

// Quy tắc duyệt DÙNG CHUNG cho mọi hồ sơ có workflow (doanh trại, kho trạm…).
// Tách khỏi barracks.service để không lặp lại logic trọng yếu và giữ hành vi nhất quán.

// Chỉ cho sửa/gửi duyệt khi hồ sơ chưa chốt (DRAFT | CHANGES_REQUESTED).
export function assertEditable(status: WorkflowStatus, action = 'sửa'): void {
  if (!EDITABLE_STATUSES.includes(status)) {
    throw new ConflictException(
      `WF-001: Hồ sơ ở trạng thái ${status}, không thể ${action} trực tiếp`,
    );
  }
}

// Chỉ duyệt/yêu cầu bổ sung khi đang chờ duyệt.
export function assertPendingReview(status: WorkflowStatus, action = 'duyệt'): void {
  if (status !== WorkflowStatus.PENDING_REVIEW) {
    throw new ConflictException(`WF-001: Chỉ ${action} hồ sơ đang chờ duyệt`);
  }
}

// Phân tách nhiệm vụ: người lập không được tự duyệt hồ sơ của mình.
export function assertNotSelfApprove(
  createdBy: string | null | undefined,
  userSub: string,
): void {
  if (createdBy && createdBy === userSub) {
    throw new ForbiddenException('AUTH-003: Người lập không được tự duyệt hồ sơ');
  }
}

// Cấu hình để chuyển trạng thái + ghi revision bất biến cho một loại hồ sơ.
export interface TransitionConfig<E extends ObjectLiteral, R extends ObjectLiteral> {
  dataSource: DataSource;
  entityTarget: EntityTarget<E>;
  revisionTarget: EntityTarget<R>;
  // Tên cột FK trên bảng revision trỏ về id hồ sơ (vd 'barracksId', 'storageLocationId').
  fkColumn: string;
  // Dựng ảnh chụp JSONB lưu vào revision.
  buildPayload: (entity: E) => Record<string, unknown>;
}

// Đổi trạng thái hồ sơ và ghi một revision bất biến trong CÙNG một transaction
// (No silent overwrite). Trả về bản ghi đã lưu.
export async function transitionWithRevision<
  E extends ObjectLiteral,
  R extends ObjectLiteral,
>(cfg: TransitionConfig<E, R>, entity: E, to: WorkflowStatus, userSub: string): Promise<E> {
  return cfg.dataSource.transaction(async (m) => {
    const e = entity as Record<string, unknown>;
    e.workflowStatus = to;
    e.updatedBy = userSub;
    const saved = (await m.getRepository(cfg.entityTarget).save(entity)) as E;
    const savedId = (saved as Record<string, unknown>).id as string;

    // Repo revision dùng chung nhiều loại entity — thao tác qua kiểu động.
    const revRepo = m.getRepository<Record<string, unknown>>(cfg.revisionTarget);
    const last = (await revRepo.findOne({
      where: { [cfg.fkColumn]: savedId },
      order: { revisionNo: 'DESC' },
    })) as { revisionNo?: number } | null;
    const nextNo = (last?.revisionNo ?? 0) + 1;
    await revRepo.save(
      revRepo.create({
        [cfg.fkColumn]: savedId,
        revisionNo: nextNo,
        workflowStatus: to,
        createdBy: userSub,
        payload: cfg.buildPayload(saved),
      }),
    );
    return saved;
  });
}
