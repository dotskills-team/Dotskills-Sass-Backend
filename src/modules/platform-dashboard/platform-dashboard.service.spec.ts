import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformDashboardService } from './platform-dashboard.service';

describe('PlatformDashboardService.getOverview', () => {
  let service: PlatformDashboardService;

  const mockPrisma: any = {
    company: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    subscription: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    subscriptionEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    payment: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoice: { groupBy: jest.fn().mockResolvedValue([]) },
    billing: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    plan: { findMany: jest.fn().mockResolvedValue([]) },
    industry: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn(),
  };

  const query = { dateFrom: '2026-09-01', dateTo: '2026-09-13' };

  /**
   * `$queryRaw` is called two ways here: `` $queryRaw`SELECT 1` `` passes a
   * plain `TemplateStringsArray` (itself an array of literal segments),
   * while `$queryRaw(Prisma.sql\`...\`)` passes a `Sql` object exposing
   * `.strings`. Handle both so mocks can branch on the query text instead
   * of executing real SQL.
   */
  function sqlText(sql: unknown): string {
    if (Array.isArray(sql)) return sql.join('');
    return (sql as { strings: string[] }).strings.join('');
  }

  /** `SELECT 1` (health check) resolves; the day-bucketed series queries return no rows by default — overridden per-test as needed. */
  function defaultQueryRawImpl(sql: unknown) {
    if (sqlText(sql).includes('SELECT 1')) {
      return Promise.resolve([{ '?column?': 1 }]);
    }
    return Promise.resolve([]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.company.groupBy.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockImplementation(defaultQueryRawImpl);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformDashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PlatformDashboardService);
  });

  it('defaults the reporting currency to BDT when no company has any subscription yet', async () => {
    const result = await service.getOverview(query);
    expect(result.data.currencyCode).toBe('BDT');
    expect(result.data.otherCurrencyCompanyCount).toBe(0);
  });

  it('picks the most common baseCurrencyCode as the reporting currency and reports the rest as "other"', async () => {
    mockPrisma.company.groupBy.mockResolvedValue([
      { baseCurrencyCode: 'BDT', _count: 8 },
      { baseCurrencyCode: 'USD', _count: 2 },
    ]);

    const result = await service.getOverview(query);

    expect(result.data.currencyCode).toBe('BDT');
    expect(result.data.otherCurrencyCompanyCount).toBe(2);
  });

  it('computes current MRR from active, non-complimentary subscriptions, normalizing YEARLY to monthly', async () => {
    mockPrisma.subscription.findMany.mockImplementation(({ select }: any) => {
      if (select?.priceSnapshot && select?.billingCycle && !select?.planId) {
        return Promise.resolve([
          { priceSnapshot: { amount: '1000' }, billingCycle: 'MONTHLY' },
          { priceSnapshot: { amount: '12000' }, billingCycle: 'YEARLY' },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getOverview(query);

    expect(new Prisma.Decimal(result.data.mrr.current).toString()).toBe('2000');
    expect(result.data.mrr.activeSubscriptionCount).toBe(2);
  });

  it('reports database health as true when the connectivity check succeeds, false when it throws', async () => {
    const okResult = await service.getOverview(query);
    expect(okResult.data.platformHealth.database).toBe(true);

    mockPrisma.$queryRaw.mockImplementation((sql: unknown) =>
      sqlText(sql).includes('SELECT 1')
        ? Promise.reject(new Error('connection refused'))
        : Promise.resolve([]),
    );
    const downResult = await service.getOverview(query);
    expect(downResult.data.platformHealth.database).toBe(false);
  });

  it('computes trial conversion rate only from converted+expired counts, and null when there is no data', async () => {
    const result = await service.getOverview(query);
    expect(result.data.trialOverview.conversionRate).toBeNull();
  });

  it('maps day-bucketed revenue and company-growth rows to date-keyed series', async () => {
    mockPrisma.$queryRaw.mockImplementation((sql: unknown) => {
      const text = sqlText(sql);
      if (text.includes('SELECT 1'))
        return Promise.resolve([{ '?column?': 1 }]);
      if (text.includes('FROM payments')) {
        return Promise.resolve([
          { day: new Date('2026-09-05T00:00:00.000Z'), revenue: '1500.0000' },
        ]);
      }
      if (text.includes('FROM companies')) {
        return Promise.resolve([
          { day: new Date('2026-09-05T00:00:00.000Z'), new_companies: 3 },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getOverview(query);

    expect(result.data.revenueSeries).toEqual([
      { date: '2026-09-05', revenue: '1500.0000' },
    ]);
    expect(result.data.companyGrowthSeries).toEqual([
      { date: '2026-09-05', newCompanies: 3 },
    ]);
  });

  it('computes expiry buckets from current ACTIVE/EXPIRED subscription snapshots', async () => {
    mockPrisma.subscription.count.mockResolvedValue(2);

    const result = await service.getOverview(query);

    expect(result.data.expiryBuckets).toEqual({
      within7: 2,
      within30: 2,
      within60: 2,
      expired: 2,
    });
  });
});
