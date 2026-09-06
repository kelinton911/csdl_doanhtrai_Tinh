import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertNoRelationshipCycle,
  assertVerifiedForCriterion,
  bomItemStatus,
  computeCompleteness,
  isDuplicateHash,
  wouldCreateRelationshipCycle,
} from './tech-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { REVISION_TRANSITIONS, RevisionStatus, TechVerificationStatus } from './tech.enums';

describe('DT-03 tech-rules (Quyển III §VII)', () => {
  describe('BR-DT03-006 chỉ VERIFIED dùng làm tiêu chí (TC-DT03-006)', () => {
    it('OCR chưa VERIFIED → từ chối', () => {
      expect(() => assertVerifiedForCriterion(TechVerificationStatus.DRAFT_EXTRACTED)).toThrow(BadRequestException);
      expect(() => assertVerifiedForCriterion(TechVerificationStatus.NEEDS_VERIFICATION)).toThrow(BadRequestException);
    });
    it('VERIFIED → hợp lệ', () => {
      expect(() => assertVerifiedForCriterion(TechVerificationStatus.VERIFIED)).not.toThrow();
    });
  });

  describe('BR-DT03-005 BOM item chưa ánh xạ (TC-DT03-005)', () => {
    it('không có component → UNMAPPED', () => {
      expect(bomItemStatus(null)).toBe('UNMAPPED');
      expect(bomItemStatus(undefined)).toBe('UNMAPPED');
    });
    it('có component → MAPPED', () => {
      expect(bomItemStatus('comp-1')).toBe('MAPPED');
    });
  });

  describe('BR-DT03-005 trùng hash (TC-DT03-003)', () => {
    it('hash đã tồn tại → trùng', () => {
      expect(isDuplicateHash(['a', 'b'], 'b')).toBe(true);
      expect(isDuplicateHash(['a', 'b'], 'c')).toBe(false);
    });
  });

  describe('BR-DT03-013 quan hệ thay thế không vòng lặp (TC-DT03-008)', () => {
    it('A thay B và B thay A → từ chối', () => {
      const edges = [{ source: 'A', target: 'B' }]; // A REPLACES B
      expect(wouldCreateRelationshipCycle(edges, 'B', 'A')).toBe(true);
      expect(() => assertNoRelationshipCycle(edges, 'B', 'A')).toThrow(ConflictException);
    });
    it('tự thay chính nó → từ chối', () => {
      expect(wouldCreateRelationshipCycle([], 'A', 'A')).toBe(true);
    });
    it('chuỗi thay thế hợp lệ (A→B→C) không vòng lặp', () => {
      const edges = [{ source: 'A', target: 'B' }, { source: 'B', target: 'C' }];
      expect(wouldCreateRelationshipCycle(edges, 'C', 'D')).toBe(false);
    });
  });

  describe('máy trạng thái revision (BR-DT03-007)', () => {
    it('DRAFT → PUBLISHED không hợp lệ (phải qua VERIFIED)', () => {
      expect(() => assertTransition(REVISION_TRANSITIONS, RevisionStatus.DRAFT, RevisionStatus.PUBLISHED)).toThrow();
    });
    it('chuỗi hợp lệ DRAFT→EXTRACTED→UNDER_TECHNICAL_REVIEW→VERIFIED→PUBLISHED', () => {
      expect(() => {
        assertTransition(REVISION_TRANSITIONS, RevisionStatus.DRAFT, RevisionStatus.EXTRACTED);
        assertTransition(REVISION_TRANSITIONS, RevisionStatus.EXTRACTED, RevisionStatus.UNDER_TECHNICAL_REVIEW);
        assertTransition(REVISION_TRANSITIONS, RevisionStatus.UNDER_TECHNICAL_REVIEW, RevisionStatus.VERIFIED);
        assertTransition(REVISION_TRANSITIONS, RevisionStatus.VERIFIED, RevisionStatus.PUBLISHED);
      }).not.toThrow();
    });
  });

  describe('độ đầy đủ hồ sơ', () => {
    it('không có gì → INCOMPLETE', () => {
      expect(computeCompleteness({ hasDrawing: false, hasSpecs: false, hasBom: false, hasDocument: false, allSpecsVerified: false })).toBe('INCOMPLETE');
    });
    it('có một phần → PARTIAL', () => {
      expect(computeCompleteness({ hasDrawing: true, hasSpecs: false, hasBom: false, hasDocument: false, allSpecsVerified: false })).toBe('PARTIAL');
    });
    it('đủ + thông số đã xác minh → COMPLETE_VERIFIED', () => {
      expect(computeCompleteness({ hasDrawing: true, hasSpecs: true, hasBom: true, hasDocument: true, allSpecsVerified: true })).toBe('COMPLETE_VERIFIED');
    });
    it('đủ nhưng thông số chưa xác minh → PARTIAL', () => {
      expect(computeCompleteness({ hasDrawing: true, hasSpecs: true, hasBom: true, hasDocument: true, allSpecsVerified: false })).toBe('PARTIAL');
    });
  });
});
