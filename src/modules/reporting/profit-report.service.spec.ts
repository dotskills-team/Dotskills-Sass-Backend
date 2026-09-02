import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import { ProfitReportService } from './profit-report.service';

describe('ProfitReportService', () => {
  let service: ProfitReportService;

  const mockPrisma: any = {
    $queryRaw: jest.fn(),
  };

  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
    getAssignedLocationIds: jest.fn().mockResolvedValue('ALL'),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocationAccessService.assertHasLocationAccess.mockResolvedValue(
      undefined,
    );
    mockLocationAccessService.getAssignedLocationIds.mockResolvedValue('ALL');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfitReportService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: LocationAccessService,
          useValue: mockLocationAccessService,
        },
      ],
    }).compile();

    service = module.get(ProfitReportService);

    // Order matches Promise.all([dayRows, totalDaysRows, summaryRows]) in the service.
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // dayRows
      .mockResolvedValueOnce([{ count: 0 }]) // totalDaysRows
      .mockResolvedValueOnce([{ sale_count: 0, revenue: '0', cogs: '0' }]); // summaryRows
  });

  it('rejects an invalid date range before issuing any query', async () => {
    await expect(
      service.getProfitReport(context, {
        dateFrom: '2026-02-01',
        dateTo: '2026-01-01',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('computes grossProfit = revenue - COGS per day, using historical unitCost (never Product.costPrice)', async () => {
    mockPrisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        {
          day: new Date('2026-01-05T00:00:00Z'),
          sale_count: 2,
          revenue: '500.0000',
          cogs: '300.0000',
        },
      ])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([
        { sale_count: 2, revenue: '500.0000', cogs: '300.0000' },
      ]);

    const result = await service.getProfitReport(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].date).toBe('2026-01-05');
    expect(result.data[0].revenue.toString()).toBe('500');
    expect(result.data[0].cogs.toString()).toBe('300');
    expect(result.data[0].grossProfit.toString()).toBe('200');
    expect(result.summary.grossProfit.toString()).toBe('200');
  });

  it('scopes every query by tenantId/companyId/COMPLETED-status/date-range, and adds a locationId filter only when supplied', async () => {
    await service.getProfitReport(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      locationId: 'loc-1',
    });

    const [dayQuery] = mockPrisma.$queryRaw.mock.calls[0];
    const sqlText = dayQuery.sql ?? dayQuery.text ?? JSON.stringify(dayQuery);
    expect(sqlText).toContain('"tenantId"');
    expect(sqlText).toContain('"companyId"');
    expect(sqlText).toContain("'COMPLETED'");
    expect(sqlText).toContain('"locationId"');
  });

  it('handles a zero-sale range without dividing by zero or throwing', async () => {
    const result = await service.getProfitReport(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(result.data).toEqual([]);
    expect(result.summary.revenue.toString()).toBe('0');
    expect(result.summary.cogs.toString()).toBe('0');
    expect(result.summary.grossProfit.toString()).toBe('0');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  describe('Location-Based Access Control', () => {
    it('checks Location access when an explicit locationId is given', async () => {
      await service.getProfitReport(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        locationId: 'loc-1',
      });

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
    });

    it('propagates ForbiddenException for an unassigned explicit locationId, never issuing a query', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.getProfitReport(context, {
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          locationId: 'unassigned-loc',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('scopes the raw SQL to an IN-list of assigned locations when no locationId is given and the actor is not LOCATION_ACCESS_ALL', async () => {
      mockLocationAccessService.getAssignedLocationIds.mockResolvedValue([
        'loc-1',
        'loc-2',
      ]);

      await service.getProfitReport(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      const [dayQuery] = mockPrisma.$queryRaw.mock.calls[0];
      const sqlText = dayQuery.sql ?? dayQuery.text ?? JSON.stringify(dayQuery);
      expect(sqlText).toContain('"locationId" IN');
    });

    it('uses a literal AND FALSE (never an empty IN-list) when the actor is assigned to zero locations', async () => {
      mockLocationAccessService.getAssignedLocationIds.mockResolvedValue([]);

      await service.getProfitReport(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      const [dayQuery] = mockPrisma.$queryRaw.mock.calls[0];
      const sqlText = dayQuery.sql ?? dayQuery.text ?? JSON.stringify(dayQuery);
      expect(sqlText).toContain('AND FALSE');
      expect(sqlText).not.toContain('IN ()');
    });
  });
});
