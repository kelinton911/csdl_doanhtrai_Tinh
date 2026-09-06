import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertNoAliasConflict,
  assertParentExists,
  assertTempCodeNotR00,
  compareVersions,
  findMaterialsByAlias,
  isValidTempCode,
  normalizeAlias,
  replacementWarning,
  validateImportRows,
  wouldCreateCycle,
} from './catalog-rules';

describe('DT-01 catalog-rules (Quyển I §VII)', () => {
  describe('BR-DT01-006 mã tạm không bắt đầu R00 (TC-DT01-003)', () => {
    it('mã bắt đầu R00 → không hợp lệ, ném lỗi', () => {
      expect(isValidTempCode('R00.01.02')).toBe(false);
      expect(() => assertTempCodeNotR00('R00.01')).toThrow(BadRequestException);
      expect(() => assertTempCodeNotR00('  r00abc')).toThrow(BadRequestException);
    });
    it('mã TEMP hợp lệ', () => {
      expect(isValidTempCode('TEMP-DT-001')).toBe(true);
      expect(() => assertTempCodeNotR00('TEMP-DT-001')).not.toThrow();
    });
  });

  describe('BR-DT01-004/005 cây phân loại (TC-DT01-002)', () => {
    const nodes = [
      { id: 'A', parentId: null },
      { id: 'B', parentId: 'A' },
      { id: 'C', parentId: 'B' },
    ];
    it('tự làm cha → vòng lặp', () => {
      expect(wouldCreateCycle(nodes, 'A', 'A')).toBe(true);
    });
    it('A→B→C→A → vòng lặp', () => {
      expect(wouldCreateCycle(nodes, 'A', 'C')).toBe(true);
    });
    it('gán cha hợp lệ → không vòng lặp', () => {
      expect(wouldCreateCycle(nodes, 'C', 'A')).toBe(false);
      expect(wouldCreateCycle(nodes, 'A', null)).toBe(false);
    });
    it('parent không tồn tại → chặn validate', () => {
      const ids = new Set(['A', 'B', 'C']);
      expect(() => assertParentExists(ids, 'X')).toThrow(BadRequestException);
      expect(() => assertParentExists(ids, 'A')).not.toThrow();
      expect(() => assertParentExists(ids, null)).not.toThrow();
    });
  });

  describe('BR-DT01-009 alias (TC-DT01-006)', () => {
    const aliases = [
      { aliasName: 'Ghế tựa lưng', materialId: 'MAT-CHAIR', status: 'ACTIVE' },
      { aliasName: 'Bàn gấp', materialId: 'MAT-TABLE', status: 'ACTIVE' },
    ];
    it('chuẩn hóa bỏ dấu + hạ chữ', () => {
      expect(normalizeAlias('Ghế Tựa Lưng')).toBe('ghe tua lung');
      expect(normalizeAlias('  Bàn   Gấp ')).toBe('ban gap');
    });
    it('nhập "Ghế Tựa lưng" → gợi ý mã chuẩn', () => {
      expect(findMaterialsByAlias(aliases, 'ghe tua lung')).toEqual(['MAT-CHAIR']);
      expect(findMaterialsByAlias(aliases, 'Ghế Tựa Lưng')).toEqual(['MAT-CHAIR']);
    });
    it('alias trỏ tới mã khác đang hiệu lực → xung đột', () => {
      expect(() =>
        assertNoAliasConflict(aliases, 'Ghế tựa lưng', 'MAT-OTHER'),
      ).toThrow(ConflictException);
      // cùng material thì không xung đột.
      expect(() =>
        assertNoAliasConflict(aliases, 'Ghế tựa lưng', 'MAT-CHAIR'),
      ).not.toThrow();
    });
  });

  describe('BR-DT01-011 mã thay thế (TC-DT01-008)', () => {
    const replacements = [{ oldMaterialId: 'A', newMaterialId: 'B', newCode: 'R00.09' }];
    it('mã A có mã thay thế B → cảnh báo dùng B', () => {
      expect(replacementWarning(replacements, 'A')).toEqual({
        replaced: true,
        newMaterialId: 'B',
        newCode: 'R00.09',
      });
    });
    it('mã không bị thay thế → không cảnh báo', () => {
      expect(replacementWarning(replacements, 'B')).toEqual({ replaced: false });
    });
  });

  describe('§3.3 so sánh phiên bản (TC-DT01-007)', () => {
    const oldV = [
      { code: 'R00.01', name: 'Bàn', unitCode: 'CAI', parentCode: null },
      { code: 'R00.02', name: 'Ghế', unitCode: 'CAI', parentCode: 'R00.01' },
      { code: 'R00.03', name: 'Tủ', unitCode: 'CAI', parentCode: null },
    ];
    const newV = [
      { code: 'R00.01', name: 'Bàn làm việc', unitCode: 'CAI', parentCode: null }, // đổi tên
      { code: 'R00.02', name: 'Ghế', unitCode: 'BO', parentCode: 'R00.01' }, // đổi ĐVT
      { code: 'R00.04', name: 'Giường', unitCode: 'CAI', parentCode: null }, // mã mới
      // R00.03 bị bỏ
    ];
    it('phát hiện thêm/bỏ/đổi tên/đổi ĐVT', () => {
      const d = compareVersions(oldV, newV);
      expect(d.added).toEqual(['R00.04']);
      expect(d.removed).toEqual(['R00.03']); // dữ liệu lịch sử vẫn giữ mã cũ
      expect(d.renamed).toEqual([{ code: 'R00.01', from: 'Bàn', to: 'Bàn làm việc' }]);
      expect(d.unitChanged).toEqual([{ code: 'R00.02', from: 'CAI', to: 'BO' }]);
    });
  });

  describe('import validate (TC-DT01-001)', () => {
    it('mã trùng trong file → báo lỗi dòng trùng', () => {
      const errs = validateImportRows([
        { rowNo: 1, code: 'R00.01', name: 'Bàn' },
        { rowNo: 2, code: 'R00.01', name: 'Bàn 2' },
      ]);
      expect(errs.some((e) => e.errorCode === 'DUPLICATE_CODE' && e.rowNo === 2)).toBe(true);
    });
    it('thiếu tên + parent không tồn tại → báo lỗi', () => {
      const errs = validateImportRows([
        { rowNo: 1, code: 'R00.01', name: '', parentCode: 'R00.99' },
      ]);
      expect(errs.map((e) => e.errorCode).sort()).toEqual(['MISSING_NAME', 'PARENT_NOT_FOUND']);
    });
    it('file hợp lệ → không lỗi', () => {
      const errs = validateImportRows([
        { rowNo: 1, code: 'R00.01', name: 'Bàn' },
        { rowNo: 2, code: 'R00.02', name: 'Ghế', parentCode: 'R00.01' },
      ]);
      expect(errs).toEqual([]);
    });
  });
});
