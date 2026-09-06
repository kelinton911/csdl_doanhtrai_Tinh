import { deriveEntityType } from './audit.interceptor';

describe('deriveEntityType (Sprint 0 §1 GAP-4 audit)', () => {
  it('lấy resource sau tiền tố /api/v1', () => {
    expect(deriveEntityType('/api/v1/barracks/123')).toBe('barracks');
    expect(deriveEntityType('/api/v1/inventory/movements?x=1')).toBe('inventory');
  });
  it('không có version prefix → segment đầu', () => {
    expect(deriveEntityType('/barracks')).toBe('barracks');
  });
  it('rỗng → null', () => {
    expect(deriveEntityType(undefined)).toBeNull();
    expect(deriveEntityType('')).toBeNull();
  });
});
