import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
} from './workflow-transition';
import { WorkflowStatus } from './workflow';

// Guard workflow DÙNG CHUNG (barracks + kho trạm). Kiểm chứng đúng luật chuyển trạng thái.
describe('workflow-transition — guards dùng chung', () => {
  describe('assertEditable', () => {
    it('cho phép DRAFT và CHANGES_REQUESTED', () => {
      expect(() => assertEditable(WorkflowStatus.DRAFT)).not.toThrow();
      expect(() => assertEditable(WorkflowStatus.CHANGES_REQUESTED)).not.toThrow();
    });
    it('chặn APPROVED/PENDING_REVIEW/LOCKED → ConflictException', () => {
      for (const s of [WorkflowStatus.APPROVED, WorkflowStatus.PENDING_REVIEW, WorkflowStatus.LOCKED]) {
        expect(() => assertEditable(s)).toThrow(ConflictException);
      }
    });
  });

  describe('assertPendingReview', () => {
    it('cho phép PENDING_REVIEW', () => {
      expect(() => assertPendingReview(WorkflowStatus.PENDING_REVIEW)).not.toThrow();
    });
    it('chặn khi không ở PENDING_REVIEW → ConflictException', () => {
      expect(() => assertPendingReview(WorkflowStatus.DRAFT)).toThrow(ConflictException);
      expect(() => assertPendingReview(WorkflowStatus.APPROVED)).toThrow(ConflictException);
    });
  });

  describe('assertNotSelfApprove', () => {
    it('chặn người lập tự duyệt → ForbiddenException', () => {
      expect(() => assertNotSelfApprove('u1', 'u1')).toThrow(ForbiddenException);
    });
    it('cho phép người khác duyệt', () => {
      expect(() => assertNotSelfApprove('u1', 'u2')).not.toThrow();
      expect(() => assertNotSelfApprove(null, 'u2')).not.toThrow();
    });
  });
});
