import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaleRegisterService } from './sale-register.service';

describe('SaleRegisterService', () => {
  let service: SaleRegisterService;

  const mockPrisma: any = {
    sale: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    salePayment: { groupBy: jest.fn() },
    $transaction: jest.fn((arg: any[]) => Promise.all(arg)),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SaleRegisterService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(SaleRegisterService);

    mockPrisma.sale.findMany.mockResolvedValue([]);
    mockPrisma.sale.count.mockResolvedValue(0);
    mockPrisma.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: null }, _count: 0 });
    mockPrisma.salePayment.groupBy.mockResolvedValue([]);
  });

  it('rejects a missing/invalid date range with BadRequestException', async () => {
    await expect(service.getSaleRegister(context, { dateFrom: 'not-a-date', dateTo: '2026-01-31' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects dateFrom after dateTo', async () => {
    await expect(
      service.getSaleRegister(context, { dateFrom: '2026-02-01', dateTo: '2026-01-01' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('scopes the listing and summary queries by tenantId/companyId/saleDate range, and filters the summary to COMPLETED only', async () => {
    await service.getSaleRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31', page: 1, limit: 50 } as any);

    const listCall = mockPrisma.sale.findMany.mock.calls[0][0];
    expect(listCall.where).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', companyId: 'company-1', saleDate: expect.any(Object) }),
    );

    const aggregateCall = mockPrisma.sale.aggregate.mock.calls[0][0];
    expect(aggregateCall.where.status).toBe('COMPLETED');

    const groupByCall = mockPrisma.salePayment.groupBy.mock.calls[0][0];
    expect(groupByCall.where.sale.status).toBe('COMPLETED');
  });

  it('applies the optional locationId filter to both listing and summary', async () => {
    await service.getSaleRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31', locationId: 'loc-1' } as any);

    expect(mockPrisma.sale.findMany.mock.calls[0][0].where.locationId).toBe('loc-1');
    expect(mockPrisma.sale.aggregate.mock.calls[0][0].where.locationId).toBe('loc-1');
  });

  it('returns pagination metadata computed from total/limit', async () => {
    mockPrisma.sale.count.mockResolvedValue(125);

    const result = await service.getSaleRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31', page: 2, limit: 50 } as any);

    expect(result.pagination).toEqual({ page: 2, limit: 50, total: 125, totalPages: 3 });
  });

  it('surfaces the payment-method breakdown from salePayment.groupBy', async () => {
    mockPrisma.salePayment.groupBy.mockResolvedValue([
      { method: 'CASH', _sum: { amount: new Prisma.Decimal(500) } },
      { method: 'DUE', _sum: { amount: new Prisma.Decimal(80) } },
    ]);

    const result = await service.getSaleRegister(context, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    expect(result.summary.paymentBreakdown).toEqual([
      { method: 'CASH', amount: new Prisma.Decimal(500) },
      { method: 'DUE', amount: new Prisma.Decimal(80) },
    ]);
  });
});
