import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CompanySettingsService } from './company-settings.service';

/**
 * Scoped to `uploadLogo()` only — the pre-existing `get()`/`update()`
 * methods are mechanical field-mapping with no dedicated spec before this
 * change either (same precedent as every other simple settings
 * passthrough this project has). `uploadLogo()` has real conditional
 * logic (mimetype gate, previous-logo cleanup) worth a focused spec.
 */
describe('CompanySettingsService.uploadLogo', () => {
  let service: CompanySettingsService;

  const mockTx = {
    company: { update: jest.fn() },
    companySettings: { findUniqueOrThrow: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    companySettings: { findFirst: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  function settingsRow(logoUrl: string | null) {
    return {
      id: 'settings-1',
      enableMultiUnit: true,
      enableCustomerDue: true,
      enableBarcode: true,
      enableProductVariant: false,
      enableComboOffer: false,
      enableMultiLocation: false,
      allowNegativeStock: false,
      maxCustomerDueLimit: null,
      maxSupplierPayableLimit: null,
      enableTax: false,
      defaultTaxRate: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { logoUrl },
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(CompanySettingsService);
  });

  it('rejects a non-PNG/JPEG file before ever calling storage or touching the database', async () => {
    const file = { buffer: Buffer.from('x'), mimetype: 'image/gif' } as Express.Multer.File;

    await expect(service.uploadLogo(context, file, actor)).rejects.toThrow(BadRequestException);
    expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    expect(mockPrisma.companySettings.findFirst).not.toHaveBeenCalled();
  });

  it('uploads under a company-namespaced key with the correct extension/content-type, and updates Company.logoUrl', async () => {
    mockPrisma.companySettings.findFirst.mockResolvedValue(settingsRow(null));
    mockStorageService.uploadFile.mockResolvedValue('https://pub-test.r2.dev/company-logos/company-1/new.png');
    mockTx.companySettings.findUniqueOrThrow.mockResolvedValue(settingsRow('https://pub-test.r2.dev/company-logos/company-1/new.png'));

    const file = { buffer: Buffer.from('fake-png'), mimetype: 'image/png' } as Express.Multer.File;
    const result = await service.uploadLogo(context, file, actor);

    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
      file.buffer,
      expect.stringMatching(/^company-logos\/company-1\/[0-9a-f-]+\.png$/),
      'image/png',
    );
    expect(mockTx.company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: { logoUrl: 'https://pub-test.r2.dev/company-logos/company-1/new.png' },
    });
    expect(result.data.logoUrl).toBe('https://pub-test.r2.dev/company-logos/company-1/new.png');
  });

  it('deletes the previous logo object when one existed', async () => {
    mockPrisma.companySettings.findFirst.mockResolvedValue(
      settingsRow('https://pub-test.r2.dev/company-logos/company-1/old.png'),
    );
    mockStorageService.uploadFile.mockResolvedValue('https://pub-test.r2.dev/company-logos/company-1/new.jpg');
    mockTx.companySettings.findUniqueOrThrow.mockResolvedValue(settingsRow('https://pub-test.r2.dev/company-logos/company-1/new.jpg'));

    const file = { buffer: Buffer.from('fake-jpeg'), mimetype: 'image/jpeg' } as Express.Multer.File;
    await service.uploadLogo(context, file, actor);

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith('company-logos/company-1/old.png');
  });

  it('does not call deleteFile when there was no previous logo', async () => {
    mockPrisma.companySettings.findFirst.mockResolvedValue(settingsRow(null));
    mockStorageService.uploadFile.mockResolvedValue('https://pub-test.r2.dev/company-logos/company-1/new.png');
    mockTx.companySettings.findUniqueOrThrow.mockResolvedValue(settingsRow('https://pub-test.r2.dev/company-logos/company-1/new.png'));

    const file = { buffer: Buffer.from('fake-png'), mimetype: 'image/png' } as Express.Multer.File;
    await service.uploadLogo(context, file, actor);

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
  });
});
