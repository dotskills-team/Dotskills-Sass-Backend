import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { LedgerSummaryService } from './ledger-summary.service';

describe('LedgerSummaryService', () => {
  let service: LedgerSummaryService;

  const mockPrisma: any = {
    customer: { findMany: jest.fn(), count: jest.fn() },
    supplier: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((arg: any[]) => Promise.all(arg)),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerSummaryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(LedgerSummaryService);

    mockPrisma.customer.findMany.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.supplier.findMany.mockResolvedValue([]);
    mockPrisma.supplier.count.mockResolvedValue(0);
  });

  it('customer due summary filters to nonzero dueBalance only, scoped by tenant/company, sorted desc', async () => {
    await service.getCustomerDueSummary(context, {});

    const call = mockPrisma.customer.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      dueBalance: { not: 0 },
    });
    expect(call.orderBy).toEqual({ dueBalance: 'desc' });
  });

  it('supplier payable summary filters to nonzero payableBalance only, scoped by tenant/company, sorted desc', async () => {
    await service.getSupplierPayableSummary(context, {});

    const call = mockPrisma.supplier.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      payableBalance: { not: 0 },
    });
    expect(call.orderBy).toEqual({ payableBalance: 'desc' });
  });

  it('returns pagination metadata for both summaries', async () => {
    mockPrisma.customer.count.mockResolvedValue(42);
    const customerResult = await service.getCustomerDueSummary(context, {
      page: 1,
      limit: 20,
    });
    expect(customerResult.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
    });

    mockPrisma.supplier.count.mockResolvedValue(9);
    const supplierResult = await service.getSupplierPayableSummary(context, {
      page: 1,
      limit: 20,
    });
    expect(supplierResult.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 9,
      totalPages: 1,
    });
  });
});
