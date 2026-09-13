import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import { NotificationService } from '../notification/notification.service';
import { ProfitReportService } from '../reporting/profit-report.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService.getOverview', () => {
  let service: DashboardService;

  const zeroProfitReport = {
    success: true,
    data: [],
    pagination: { page: 1, limit: 200, total: 0, totalPages: 0 },
    summary: {
      saleCount: 0,
      revenue: new Prisma.Decimal(0),
      cogs: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(0),
    },
  };

  const mockPrisma: any = {
    location: { findMany: jest.fn().mockResolvedValue([]) },
    company: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ baseCurrencyCode: 'BDT' }),
    },
    customer: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { dueBalance: null }, _count: 0 }),
    },
    supplier: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { payableBalance: null }, _count: 0 }),
    },
    product: { count: jest.fn().mockResolvedValue(0) },
    inventory: { count: jest.fn().mockResolvedValue(0) },
    saleItem: { groupBy: jest.fn().mockResolvedValue([]) },
    purchaseOrder: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { totalAmount: null }, _count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sale: { findMany: jest.fn().mockResolvedValue([]) },
    cashDrawerSession: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { openingBalance: null }, _count: 0 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ value: 0 }]),
  };

  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
    getAssignedLocationIds: jest.fn().mockResolvedValue('ALL'),
  };

  const mockNotificationService = {
    listForCompany: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    }),
  };

  const mockProfitReportService = {
    getProfitReport: jest.fn().mockResolvedValue(zeroProfitReport),
  };

  const context = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    companyMemberId: 'member-1',
  } as any;
  const query = { dateFrom: '2026-09-01', dateTo: '2026-09-13' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocationAccessService.getAssignedLocationIds.mockResolvedValue('ALL');
    mockProfitReportService.getProfitReport.mockResolvedValue(zeroProfitReport);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocationAccessService, useValue: mockLocationAccessService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ProfitReportService, useValue: mockProfitReportService },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('reports hasBranches=false and no branch performance when the company has zero locations', async () => {
    mockPrisma.location.findMany.mockResolvedValue([]);

    const result = await service.getOverview(context, query);

    expect(result.data.scope.hasBranches).toBe(false);
    expect(result.data.branchPerformance).toBeNull();
  });

  it('never computes branch performance when a specific location is requested, even with multiple locations', async () => {
    mockPrisma.location.findMany.mockResolvedValue([
      { id: 'loc-1', name: 'Main' },
      { id: 'loc-2', name: 'Uttara' },
    ]);

    const result = await service.getOverview(context, {
      ...query,
      locationId: 'loc-1',
    });

    expect(result.data.scope.hasBranches).toBe(true);
    expect(result.data.branchPerformance).toBeNull();
  });

  it('computes branch performance only in All-Branches mode with more than one visible location', async () => {
    mockPrisma.location.findMany.mockResolvedValue([
      { id: 'loc-1', name: 'Main' },
      { id: 'loc-2', name: 'Uttara' },
    ]);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getOverview(context, query);

    expect(result.data.branchPerformance).toEqual([]);
  });

  it('derives grossMarginPercent from the reused profit-report summary, and returns null when revenue is zero', async () => {
    mockProfitReportService.getProfitReport.mockResolvedValue({
      ...zeroProfitReport,
      summary: {
        saleCount: 10,
        revenue: new Prisma.Decimal(1000),
        cogs: new Prisma.Decimal(600),
        grossProfit: new Prisma.Decimal(400),
      },
    });

    const result = await service.getOverview(context, query);

    expect(result.data.kpis.grossMarginPercent).toBe(40);
  });

  it('never fabricates non-zero receivable/payable when the underlying aggregate has no matching rows', async () => {
    const result = await service.getOverview(context, query);

    expect(result.data.kpis.receivable.total.toString()).toBe('0');
    expect(result.data.kpis.payable.total.toString()).toBe('0');
  });
});
