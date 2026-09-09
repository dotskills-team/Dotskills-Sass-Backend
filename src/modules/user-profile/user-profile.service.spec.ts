import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { hashPassword } from '../../common/utils/password.util';
import { UserProfileService } from './user-profile.service';

describe('UserProfileService', () => {
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

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const actor = { userId: 'user-1', sessionId: 'session-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(UserProfileService);
  });

  describe('getProfile', () => {
    it('reads the profile fresh from the DB scoped by actor.userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        profileImageUrl: null,
      });

      const result = await service.getProfile(actor);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, fullName: true, email: true, profileImageUrl: true },
      });
      expect(result.data.userId).toBe('user-1');
    });

    it('throws NotFoundException when the user row is missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadProfileImage', () => {
    it('rejects a non-PNG/JPEG file before ever calling storage or touching the database', async () => {
      const file = { buffer: Buffer.from('x'), mimetype: 'image/gif' } as Express.Multer.File;

      await expect(service.uploadProfileImage(actor, file)).rejects.toThrow(BadRequestException);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('uploads under a user-namespaced key and updates User.profileImageUrl', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        profileImageUrl: null,
      });
      mockStorageService.uploadFile.mockResolvedValue(
        'https://res.cloudinary.com/test/user-avatars/user-1/new.png',
      );
      mockTx.user.update.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        profileImageUrl: 'https://res.cloudinary.com/test/user-avatars/user-1/new.png',
      });

      const file = { buffer: Buffer.from('fake-png'), mimetype: 'image/png' } as Express.Multer.File;
      const result = await service.uploadProfileImage(actor, file);

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(/^user-avatars\/user-1\/[0-9a-f-]+\.png$/),
        'image/png',
      );
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { profileImageUrl: 'https://res.cloudinary.com/test/user-avatars/user-1/new.png' },
        select: { id: true, fullName: true, email: true, profileImageUrl: true },
      });
      expect(result.data.profileImageUrl).toBe(
        'https://res.cloudinary.com/test/user-avatars/user-1/new.png',
      );
    });

    it('deletes the previous avatar object when one existed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        profileImageUrl: 'https://res.cloudinary.com/test/user-avatars/user-1/old.png',
      });
      mockStorageService.uploadFile.mockResolvedValue(
        'https://res.cloudinary.com/test/user-avatars/user-1/new.jpg',
      );
      mockTx.user.update.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
        profileImageUrl: 'https://res.cloudinary.com/test/user-avatars/user-1/new.jpg',
      });

      const file = { buffer: Buffer.from('fake-jpeg'), mimetype: 'image/jpeg' } as Express.Multer.File;
      await service.uploadProfileImage(actor, file);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('user-avatars/user-1/old.png');
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password without ever hashing/writing the new one', async () => {
      const existingHash = await hashPassword('the-real-current-password');
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: existingHash });

      await expect(
        service.changePassword(actor, {
          currentPassword: 'totally-wrong-password',
          newPassword: 'a-brand-new-password-123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.authSession.updateMany).not.toHaveBeenCalled();
    });

    it('accepts the correct current password, updates the hash, and revokes every OTHER session but leaves the current one untouched', async () => {
      const existingHash = await hashPassword('the-real-current-password');
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: existingHash });

      const result = await service.changePassword(actor, {
        currentPassword: 'the-real-current-password',
        newPassword: 'a-brand-new-password-123',
      });

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String), passwordChangedAt: expect.any(Date) },
      });
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', id: { not: 'session-1' }, revokedAt: null },
        data: { revokedAt: expect.any(Date), revokeReason: 'PASSWORD_CHANGED' },
      });
      expect(result.otherSessionsRevoked).toBe(2);
    });

    it('throws NotFoundException when the user row is missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(actor, {
          currentPassword: 'anything',
          newPassword: 'a-brand-new-password-123',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
