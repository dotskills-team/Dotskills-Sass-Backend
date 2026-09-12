import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;

  const mockTx = {
    platformSettings: { upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    platformSettings: { findUnique: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(PlatformSettingsService);
  });

  describe('get', () => {
    it('returns null logoUrl when no row exists yet', async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue(null);

      const result = await service.get();

      expect(result.data.logoUrl).toBeNull();
    });
  });

  describe('uploadLogo', () => {
    it('rejects a non-PNG/JPEG file before ever calling storage or touching the database', async () => {
      const file = { buffer: Buffer.from('x'), mimetype: 'image/gif' } as Express.Multer.File;

      await expect(service.uploadLogo(file, actor)).rejects.toThrow(BadRequestException);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockPrisma.platformSettings.findUnique).not.toHaveBeenCalled();
    });

    it('upserts the fixed singleton row (id=1) and deletes the previous logo file', async () => {
      mockPrisma.platformSettings.findUnique.mockResolvedValue({
        id: 1,
        logoUrl: 'https://res.cloudinary.com/test/platform-settings/logo/old.png',
      });
      mockStorageService.uploadFile.mockResolvedValue(
        'https://res.cloudinary.com/test/platform-settings/logo/new.png',
      );
      mockTx.platformSettings.upsert.mockResolvedValue({
        id: 1,
        logoUrl: 'https://res.cloudinary.com/test/platform-settings/logo/new.png',
        updatedAt: new Date(),
      });

      const file = { buffer: Buffer.from('fake-png'), mimetype: 'image/png' } as Express.Multer.File;
      const result = await service.uploadLogo(file, actor);

      expect(mockTx.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: expect.objectContaining({ id: 1 }),
        update: expect.objectContaining({
          logoUrl: 'https://res.cloudinary.com/test/platform-settings/logo/new.png',
        }),
      });
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'platform-settings/logo/old.png',
      );
      expect(result.data.logoUrl).toBe(
        'https://res.cloudinary.com/test/platform-settings/logo/new.png',
      );
    });
  });
});
