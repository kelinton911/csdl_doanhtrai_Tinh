import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BarracksService } from './barracks.service';
import { WorkflowStatus } from '../../common/workflow';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Unit test quy tắc nghiệp vụ M04 (không cần DB) — mock repository + dataSource.
function makeService(barracks: Partial<{ workflowStatus: WorkflowStatus; createdBy: string; id: string }> | null, dup = false) {
  const repo = {
    findOne: jest
      .fn()
      // create() gọi findOne để kiểm tra trùng mã; các hàm khác gọi get() → findOne trả entity.
      .mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
        if (where.code !== undefined) return Promise.resolve(dup ? { id: 'x' } : null);
        return Promise.resolve(barracks);
      }),
    create: jest.fn((e) => e),
    save: jest.fn((e) => Promise.resolve({ id: 'new', ...e })),
    // get() gọi repo.query(ST_AsGeoJSON...) để chuẩn hoá toạ độ + tên xã/đơn vị.
    query: jest.fn().mockResolvedValue([{ g: null, area_name: null, org_name: null }]),
  };
  const revisions = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new BarracksService(repo as any, revisions as any, dataSource as any);
}

const user = (sub: string): AuthUser => ({ sub, username: 'u', roles: [], organizationId: null });

describe('BarracksService — quy tắc workflow (M04, UC-05/06)', () => {
  it('tạo trùng mã → ConflictException (DATA-003)', async () => {
    const svc = makeService(null, true);
    await expect(svc.create({ code: 'DT-1', name: 'x' } as never, user('u1'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('không sửa trực tiếp bản đã APPROVED → ConflictException (WF-001)', async () => {
    const svc = makeService({ id: '1', workflowStatus: WorkflowStatus.APPROVED });
    await expect(svc.update('1', { name: 'y' } as never, user('u1'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('người lập không được tự duyệt → ForbiddenException (AUTH-003)', async () => {
    const svc = makeService({ id: '1', workflowStatus: WorkflowStatus.PENDING_REVIEW, createdBy: 'u1' });
    await expect(svc.approve('1', user('u1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('chỉ duyệt hồ sơ đang PENDING_REVIEW → ConflictException nếu ở DRAFT', async () => {
    const svc = makeService({ id: '1', workflowStatus: WorkflowStatus.DRAFT, createdBy: 'u2' });
    await expect(svc.approve('1', user('u1'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('chỉ gửi duyệt hồ sơ DRAFT/CHANGES_REQUESTED → ConflictException nếu đã APPROVED', async () => {
    const svc = makeService({ id: '1', workflowStatus: WorkflowStatus.APPROVED });
    await expect(svc.submit('1', user('u1'))).rejects.toBeInstanceOf(ConflictException);
  });
});
