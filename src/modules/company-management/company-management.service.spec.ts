import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CompanyManagementService } from './company-management.service';
import { CreateCompanyDto } from './dto/create-company.dto';

describe('CompanyManagementService.create', () => {
  let service: CompanyManagementService;

  const mockTx = {
    company: { create: jest.fn() },
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

  const mockSubscriptionService = {
    createTrialForNewCompany: jest.fn(),
  };

  const dto: CreateCompanyDto = {
    tenantId: 'tenant-1',
    industryId: 'industry-1',
    code: 'ACME',
    legalName: 'Acme Ltd',
  } as CreateCompanyDto;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyManagementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
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
   * Core new behavior: creating the Company and its auto-trial Subscription
   * must be atomic — if createTrialForNewCompany() throws (e.g. no
   * isDefaultTrial Plan configured), the whole Company creation must fail,
   * never leaving a subscription-less Company behind. $transaction here is
   * a plain jest.fn calling the callback directly, so a thrown error
   * propagates exactly as a real Prisma rollback would.
   */
  it('rolls back Company creation entirely when the auto-trial subscription cannot be created', async () => {
    mockTx.company.create.mockResolvedValue({
      id: 'company-1',
      tenantId: 'tenant-1',
      baseCurrencyCode: 'BDT',
    });
    mockSubscriptionService.createTrialForNewCompany.mockRejectedValue(
      new NotFoundException('No default-trial Plan is configured'),
    );

    await expect(service.create(dto, 'creator-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates the Company and its auto-trial Subscription together in one transaction', async () => {
    const createdCompany = {
      id: 'company-1',
      tenantId: 'tenant-1',
      baseCurrencyCode: 'BDT',
    };
    mockTx.company.create.mockResolvedValue(createdCompany);
    mockSubscriptionService.createTrialForNewCompany.mockResolvedValue({
      id: 'sub-1',
    });

    const result = await service.create(dto, 'creator-1');

    expect(mockSubscriptionService.createTrialForNewCompany).toHaveBeenCalledWith(
      createdCompany,
      'creator-1',
      mockTx,
    );
    expect(result).toBe(createdCompany);
  });
});
