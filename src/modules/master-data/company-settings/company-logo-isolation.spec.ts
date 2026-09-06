import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyManagementService } from '../../company-management/company-management.service';
import { CompanyRbacService } from '../../company-rbac/company-rbac.service';
import { StorageService } from '../../storage/storage.service';
import { CompanySettingsService } from './company-settings.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';

/**
 * Mandatory multi-tenant isolation proof for Company Logo upload — same
 * real-DB, service-layer approach as every prior isolation spec this
 * session. `StorageService` is mocked (no real R2 credentials configured
 * in this environment yet) — the concern under test is authorization/
 * scoping, not the storage call itself, which is already covered by
 * `storage.service.spec.ts`'s own mocked-SDK unit tests.
 */
describe('Company Logo — multi-tenant isolation (integration)', () => {
  const TENANT_1 = '65b4d86b-9ce6-4d78-901c-440b0c0fd721';
  const TENANT_2 = '632bb8a8-f9f9-4093-a903-351e3614fc88';
  const INDUSTRY_ID = '5c961a18-af13-4638-b93d-b7faa4c502b7';
  const CREATOR_USER_ID = '774bb094-6628-422a-beaf-dc0ae9e50984';

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let companyManagementService: CompanyManagementService;
  let companyRbacService: CompanyRbacService;
  let companySettingsService: CompanySettingsService;

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'company-logo-isolation-spec',
    email: 'admin@dotskills.com',
    fullName: 'Test Actor',
    preferredLocale: 'en',
    timezone: 'Asia/Dhaka',
    roles: [],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();

    prisma = moduleRef.get(PrismaService);
    companyManagementService = moduleRef.get(CompanyManagementService);
    companyRbacService = moduleRef.get(CompanyRbacService);
    companySettingsService = moduleRef.get(CompanySettingsService);

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'LOGOISOA',
        legalName: 'Logo Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'LOGOISOB',
        legalName: 'Logo Isolation B (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bootstrapA = await companyRbacService.bootstrap(
      companyAId,
      { ownerUserId: CREATOR_USER_ID },
      actor,
    );
    const bootstrapB = await companyRbacService.bootstrap(
      companyBId,
      { ownerUserId: CREATOR_USER_ID },
      actor,
    );

    contextA = {
      tenantId: TENANT_1,
      companyId: companyAId,
      companyMemberId: bootstrapA.data.ownerMemberId!,
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
    contextB = {
      tenantId: TENANT_2,
      companyId: companyBId,
      companyMemberId: bootstrapB.data.ownerMemberId!,
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      await prisma.companyOwnership.deleteMany({ where: { companyId } });
      await prisma.companyMember.deleteMany({ where: { companyId } });
      await prisma.companyRole.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await moduleRef.close();
  }, 30000);

  it("uploading a logo for Company B never touches Company A's Company row, even though both were created back-to-back with identical shapes", async () => {
    mockStorageService.uploadFile.mockResolvedValue(
      'https://pub-test.r2.dev/company-logos/company-b/fake.png',
    );

    const fakeFile = {
      buffer: Buffer.from('fake-png-bytes'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    const result = await companySettingsService.uploadLogo(contextB, fakeFile, actor);

    expect(result.data.logoUrl).toBe(
      'https://pub-test.r2.dev/company-logos/company-b/fake.png',
    );
    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
      fakeFile.buffer,
      expect.stringContaining(`company-logos/${companyBId}/`),
      'image/png',
    );

    const companyARow = await prisma.company.findUniqueOrThrow({
      where: { id: companyAId },
      select: { logoUrl: true },
    });
    expect(companyARow.logoUrl).toBeNull();

    const companyBRow = await prisma.company.findUniqueOrThrow({
      where: { id: companyBId },
      select: { logoUrl: true },
    });
    expect(companyBRow.logoUrl).toBe(
      'https://pub-test.r2.dev/company-logos/company-b/fake.png',
    );
  }, 30000);

  it("Company A's own logo upload is scoped strictly to its own row, and a second upload deletes exactly Company A's previous object, never Company B's", async () => {
    mockStorageService.uploadFile
      .mockResolvedValueOnce('https://pub-test.r2.dev/company-logos/company-a/first.png')
      .mockResolvedValueOnce('https://pub-test.r2.dev/company-logos/company-a/second.png');
    mockStorageService.deleteFile.mockResolvedValue(undefined);

    const fakeFile = {
      buffer: Buffer.from('fake-png-bytes'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    await companySettingsService.uploadLogo(contextA, fakeFile, actor);
    await companySettingsService.uploadLogo(contextA, fakeFile, actor);

    expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(1);
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
      'company-logos/company-a/first.png',
    );

    const companyARow = await prisma.company.findUniqueOrThrow({
      where: { id: companyAId },
      select: { logoUrl: true },
    });
    expect(companyARow.logoUrl).toBe('https://pub-test.r2.dev/company-logos/company-a/second.png');

    const companyBRow = await prisma.company.findUniqueOrThrow({
      where: { id: companyBId },
      select: { logoUrl: true },
    });
    expect(companyBRow.logoUrl).toBe(
      'https://pub-test.r2.dev/company-logos/company-b/fake.png',
    );
  }, 30000);
});
