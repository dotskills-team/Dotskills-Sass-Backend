import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { CompanyManagementService } from './company-management.service';
import { CreateCompanyDto } from './dto/create-company.dto';

describe('CompanyManagementService.create', () => {
  let service: CompanyManagementService;

  const mockTx = {
    company: { create: jest.fn() },
    companySettings: { create: jest.fn() },
  };

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
    industry: { findUnique: jest.fn() },
    company: { findFirst: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const dto: CreateCompanyDto = {
    tenantId: 'tenant-1',
    industryId: 'industry-1',
    code: 'ACME',
    legalName: 'Acme Ltd',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyManagementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CompanyManagementService);

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'creator-1' });
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    mockPrisma.industry.findUnique.mockResolvedValue({
      id: 'industry-1',
      status: 'ACTIVE',
    });
    mockPrisma.company.findFirst.mockResolvedValue(null);
  });

  /**
   * Core business rule: Company creation only ever creates the Company row
   * and its default CompanySettings — never a Subscription (nor Billing,
   * Invoice, or Payment). Subscription creation is now a separate,
   * explicit Super Admin action (SubscriptionService.create()) taken
   * afterwards. This is a regression test for a real bug where Company
   * creation used to auto-create a Subscription in the same transaction.
   */
  it('creates only the Company and its default CompanySettings — no Subscription is created', async () => {
    const createdCompany = {
      id: 'company-1',
      tenantId: 'tenant-1',
      baseCurrencyCode: 'BDT',
    };
    mockTx.company.create.mockResolvedValue(createdCompany);

    const result = await service.create(dto, 'creator-1');

    expect(mockTx.companySettings.create).toHaveBeenCalledWith({
      data: { tenantId: createdCompany.tenantId, companyId: createdCompany.id },
    });
    expect(result).toBe(createdCompany);
  });
});
