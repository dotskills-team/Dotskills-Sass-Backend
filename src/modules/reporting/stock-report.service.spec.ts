import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockReportService } from './stock-report.service';

describe('StockReportService', () => {
  let service: StockReportService;

  const mockPrisma: any = {
    inventory: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((arg: any[]) => Promise.all(arg)),
    $queryRaw: jest.fn(),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockReportService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(StockReportService);

    mockPrisma.inventory.findMany.mockResolvedValue([]);
    mockPrisma.inventory.count.mockResolvedValue(0);
  });

  it('computes belowReorderLevel per row in the normal (unfiltered) listing mode', async () => {
    mockPrisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        productId: 'p-1',
        locationId: 'loc-1',
        quantity: new Prisma.Decimal(3),
        product: { name: 'Rice', sku: 'RICE', reorderLevel: new Prisma.Decimal(10), status: 'ACTIVE' },
        location: { name: 'Main' },
      },
      {
        id: 'inv-2',
        productId: 'p-2',
        locationId: 'loc-1',
        quantity: new Prisma.Decimal(50),
        product: { name: 'Oil', sku: 'OIL', reorderLevel: new Prisma.Decimal(10), status: 'ACTIVE' },
        location: { name: 'Main' },
      },
    ]);

    const result = await service.getStockReport(context, {} as any);

    expect(result.data[0].belowReorderLevel).toBe(true); // 3 < 10
    expect(result.data[1].belowReorderLevel).toBe(false); // 50 >= 10
  });

  it('applies the optional locationId filter', async () => {
    await service.getStockReport(context, { locationId: 'loc-1' } as any);

    expect(mockPrisma.inventory.findMany.mock.calls[0][0].where.locationId).toBe('loc-1');
  });

  it('uses a raw-SQL query (not the normal findMany path) when belowReorderOnly is set, and never calls findMany', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);

    await service.getStockReport(context, { belowReorderOnly: true } as any);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mockPrisma.inventory.findMany).not.toHaveBeenCalled();
  });

  it('returns pagination metadata in the belowReorderOnly path', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'inv-1', productId: 'p-1', locationId: 'loc-1', quantity: '3', productName: 'Rice', sku: 'RICE', reorderLevel: '10', locationName: 'Main' },
      ])
      .mockResolvedValueOnce([{ count: 7 }]);

    const result = await service.getStockReport(context, { belowReorderOnly: true, page: 1, limit: 5 } as any);

    expect(result.pagination).toEqual({ page: 1, limit: 5, total: 7, totalPages: 2 });
    expect(result.data[0].belowReorderLevel).toBe(true);
    expect(result.data[0].quantity.toString()).toBe('3');
  });
});
