import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { MaterialDeclarationService } from './material-declaration.service';
import { MaterialDeclaration } from './entities/material-declaration.entity';
import { MaterialDeclarationLine } from './entities/material-declaration-line.entity';
import { MaterialDeclarationRevision } from './entities/material-declaration-revision.entity';
import { DeclarationAmendmentRequest } from './entities/declaration-amendment-request.entity';
import { WorkflowStatus } from '../../common/workflow';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Unit test các GUARD trọng yếu (không chạm DB): khóa-sau-duyệt, xóa chỉ DRAFT,
// người lập không tự duyệt, phạm vi đơn vị, đề nghị sửa chỉ khi APPROVED.
type MockRepo = Partial<Record<keyof Repository<any>, jest.Mock>>;
const repoMock = (): MockRepo => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn((x) => Promise.resolve(x)),
  create: jest.fn((x) => x),
  delete: jest.fn(),
});

const ADMIN: AuthUser = { sub: 'admin', username: 'admin', roles: ['SYS_ADMIN'], organizationId: null } as AuthUser;
const XA_A: AuthUser = { sub: 'uXaA', username: 'xa', roles: ['COMMUNE_USER'], organizationId: 'orgA' } as AuthUser;

describe('MaterialDeclarationService — guards', () => {
  let repo: MockRepo;
  let lines: MockRepo;
  let revisions: MockRepo;
  let amendments: MockRepo;
  let service: MaterialDeclarationService;

  beforeEach(() => {
    repo = repoMock();
    lines = repoMock();
    revisions = repoMock();
    amendments = repoMock();
    const dataSource = { transaction: jest.fn() } as unknown as DataSource;
    service = new MaterialDeclarationService(
      repo as unknown as Repository<MaterialDeclaration>,
      lines as unknown as Repository<MaterialDeclarationLine>,
      revisions as unknown as Repository<MaterialDeclarationRevision>,
      amendments as unknown as Repository<DeclarationAmendmentRequest>,
      dataSource,
    );
  });

  it('update: chặn sửa khi ĐÃ DUYỆT (APPROVED) → ConflictException', async () => {
    repo.findOne!.mockResolvedValue({ id: 'd1', organizationId: 'orgA', workflowStatus: WorkflowStatus.APPROVED });
    await expect(service.update('d1', { title: 'x' }, ADMIN)).rejects.toThrow(ConflictException);
  });

  it('remove: chỉ xóa DRAFT; APPROVED → ConflictException', async () => {
    repo.findOne!.mockResolvedValue({ id: 'd1', organizationId: 'orgA', workflowStatus: WorkflowStatus.APPROVED });
    await expect(service.remove('d1', ADMIN)).rejects.toThrow(ConflictException);
  });

  it('approve: người lập không được tự duyệt → ForbiddenException', async () => {
    repo.findOne!.mockResolvedValue({ id: 'd1', organizationId: 'orgA', workflowStatus: WorkflowStatus.PENDING_REVIEW, createdBy: 'u1' });
    const self: AuthUser = { sub: 'u1', username: 'u1', roles: ['BARRACKS_OFFICER'], organizationId: null } as AuthUser;
    await expect(service.approve('d1', self)).rejects.toThrow(ForbiddenException);
  });

  it('get: cấp xã không xem được bản của đơn vị khác → chặn phạm vi', async () => {
    repo.findOne!.mockResolvedValue({ id: 'd1', organizationId: 'orgB', workflowStatus: WorkflowStatus.DRAFT });
    await expect(service.get('d1', XA_A)).rejects.toThrow();
  });

  it('createAmendment: chỉ đề nghị sửa khi bản ĐÃ DUYỆT', async () => {
    repo.findOne!.mockResolvedValue({ id: 'd1', organizationId: 'orgA', workflowStatus: WorkflowStatus.DRAFT });
    await expect(
      service.createAmendment('d1', { requestedChanges: 'x', reason: 'y' }, ADMIN),
    ).rejects.toThrow(ConflictException);
  });

  it('approveAmendment: người gửi không được tự duyệt đề nghị → ForbiddenException', async () => {
    amendments.findOne!.mockResolvedValue({ id: 'a1', organizationId: 'orgA', status: WorkflowStatus.PENDING_REVIEW, submittedBy: 'u2' });
    const self: AuthUser = { sub: 'u2', username: 'u2', roles: ['REVIEWER'], organizationId: null } as AuthUser;
    await expect(service.approveAmendment('a1', self)).rejects.toThrow(ForbiddenException);
  });
});
