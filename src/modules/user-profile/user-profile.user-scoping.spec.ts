import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { hashPassword } from '../../common/utils/password.util';
import { UserProfileService } from './user-profile.service';

/**
 * Focused security spec (in place of a full multi-tenant isolation
 * suite — this feature is user-scoped, not company-scoped): proves every
 * method resolves its target row from `actor.userId`/`actor.sessionId`
 * alone, so one user's call can never read or mutate another user's
 * profile, image, password, or sessions — even though nothing in any DTO
 * ever carries a user id for the service to (mis)trust.
 */
describe('UserProfileService — user scoping', () => {
  let service: UserProfileService;

  const mockTx = {
    user: { update: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    authSession: { updateMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockStorageService = { uploadFile: jest.fn(), deleteFile: jest.fn() };

  const userA = { userId: 'user-A', sessionId: 'session-A' } as any;
  const userB = { userId: 'user-B', sessionId: 'session-B' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(UserProfileService);
  });

  it('getProfile always queries by the calling actor own userId, never a shared/global lookup', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-A',
      fullName: 'A',
      email: 'a@example.com',
      profileImageUrl: null,
    });

    await service.getProfile(userA);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      select: expect.any(Object),
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-B',
      fullName: 'B',
      email: 'b@example.com',
      profileImageUrl: null,
    });
    await service.getProfile(userB);
    expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'user-B' },
      select: expect.any(Object),
    });
  });

  it('uploadProfileImage writes only to the calling actor own row/storage key, keyed off actor.userId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-A',
      fullName: 'A',
      email: 'a@example.com',
      profileImageUrl: null,
    });
    mockStorageService.uploadFile.mockResolvedValue('https://cdn.test/user-avatars/user-A/x.png');
    mockTx.user.update.mockResolvedValue({
      id: 'user-A',
      fullName: 'A',
      email: 'a@example.com',
      profileImageUrl: 'https://cdn.test/user-avatars/user-A/x.png',
    });

    const file = { buffer: Buffer.from('x'), mimetype: 'image/png' } as Express.Multer.File;
    await service.uploadProfileImage(userA, file);

    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
      file.buffer,
      expect.stringMatching(/^user-avatars\/user-A\//),
      'image/png',
    );
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-A' } }),
    );
    // Never touches user-B's key/row for a request made as user-A.
    expect(mockStorageService.uploadFile).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^user-avatars\/user-B\//),
      expect.anything(),
    );
  });

  it('changePassword verifies and updates only the calling actor own passwordHash, and revokes sessions scoped to that same userId', async () => {
    const hashA = await hashPassword('user-a-current-password');
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-A', passwordHash: hashA });

    await service.changePassword(userA, {
      currentPassword: 'user-a-current-password',
      newPassword: 'user-a-brand-new-password-123',
    });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      select: { id: true, passwordHash: true },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-A' } }),
    );
    expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-A', id: { not: 'session-A' } }),
      }),
    );
  });

  it("userA's correct-looking DTO can never be verified against userB's hash — each call is independently scoped by its own actor", async () => {
    const hashB = await hashPassword('user-b-secret-password');
    // Even if userA somehow knew userB's real password string, calling
    // changePassword as userA only ever reads/writes user-A's own row —
    // there is no field anywhere for a caller to name a different user.
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-A', passwordHash: hashB });

    // user-A's own row is mocked here to have userB's hash only to prove
    // the lookup key itself (not the DTO) is what determines whose
    // password is checked — in real usage user-A's row always holds
    // user-A's own hash, this just isolates the scoping guarantee.
    await expect(
      service.changePassword(userA, {
        currentPassword: 'user-b-secret-password',
        newPassword: 'irrelevant-new-password-123',
      }),
    ).resolves.toBeDefined();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-A' },
      select: { id: true, passwordHash: true },
    });
  });
});
