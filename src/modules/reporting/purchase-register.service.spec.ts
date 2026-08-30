import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseRegisterService } from './purchase-register.service';

describe('PurchaseRegisterService', () => {
  let service: PurchaseRegisterService;

  const mockPrisma: any = {
    purchaseOrder: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    $transaction: jest.fn((arg: any[]) => Promise.all(arg)),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseRegisterService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(PurchaseRegisterService);

    mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { totalAmount: null }, _count: 0 });
  });

  it('rejects an invalid date range', async () => {
    await expect(
      service.getPurchaseRegister(context, { dateFrom: '2026-02-01', dateTo: '2026-01-01' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('scopes by tenantId/companyId/orderDate range, and excludes CANCELLED from the summary only', async () => {
    await service.getPurchaseRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const listCall = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
    expect(listCall.where).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', companyId: 'company-1', orderDate: expect.any(Object) }),
    );
    // listing itself has no status filter — every status is shown
    expect(listCall.where.status).toBeUndefined();

    const aggregateCall = mockPrisma.purchaseOrder.aggregate.mock.calls[0][0];
    expect(aggregateCall.where.status).toEqual({ not: 'CANCELLED' });
  });

  it('includes receipts/returns counts in the listing select', async () => {
    await service.getPurchaseRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const listCall = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
    expect(listCall.select._count.select).toEqual({ receipts: true, returns: true });
  });

  it('returns pagination metadata', async () => {
    mockPrisma.purchaseOrder.count.mockResolvedValue(30);

    const result = await service.getPurchaseRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31', page: 1, limit: 10 } as any);

    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 30, totalPages: 3 });
  });
});
