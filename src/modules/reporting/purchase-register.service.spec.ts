import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import { PurchaseRegisterService } from './purchase-register.service';

describe('PurchaseRegisterService', () => {
  let service: PurchaseRegisterService;

  const mockPrisma: any = {
    purchaseOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn((arg: any[]) => Promise.all(arg)),
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
        PurchaseRegisterService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: LocationAccessService,
          useValue: mockLocationAccessService,
        },
      ],
    }).compile();

    service = module.get(PurchaseRegisterService);

    mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: null },
      _count: 0,
    });
  });

  it('rejects an invalid date range', async () => {
    await expect(
      service.getPurchaseRegister(context, {
        dateFrom: '2026-02-01',
        dateTo: '2026-01-01',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('scopes by tenantId/companyId/orderDate range, and excludes CANCELLED from the summary only', async () => {
    await service.getPurchaseRegister(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    const listCall = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
    expect(listCall.where).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        orderDate: expect.any(Object),
      }),
    );
    // listing itself has no status filter — every status is shown
    expect(listCall.where.status).toBeUndefined();

    const aggregateCall = mockPrisma.purchaseOrder.aggregate.mock.calls[0][0];
    expect(aggregateCall.where.status).toEqual({ not: 'CANCELLED' });
  });

  it('includes receipts/returns counts in the listing select', async () => {
    await service.getPurchaseRegister(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    const listCall = mockPrisma.purchaseOrder.findMany.mock.calls[0][0];
    expect(listCall.select._count.select).toEqual({
      receipts: true,
      returns: true,
    });
  });

  it('returns pagination metadata', async () => {
    mockPrisma.purchaseOrder.count.mockResolvedValue(30);

    const result = await service.getPurchaseRegister(context, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 1,
      limit: 10,
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 30,
      totalPages: 3,
    });
  });

  describe('Location-Based Access Control', () => {
    it('checks Location access when an explicit locationId is given', async () => {
      await service.getPurchaseRegister(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        locationId: 'loc-1',
      });

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
      expect(
        mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where.locationId,
      ).toBe('loc-1');
    });

    it('propagates ForbiddenException for an unassigned explicit locationId', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.getPurchaseRegister(context, {
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          locationId: 'unassigned-loc',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    });

    it('implicitly scopes to the assigned-locations set when no locationId is given and the actor is not LOCATION_ACCESS_ALL', async () => {
      mockLocationAccessService.getAssignedLocationIds.mockResolvedValue([
        'loc-1',
        'loc-2',
      ]);

      await service.getPurchaseRegister(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(
        mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where.locationId,
      ).toEqual({ in: ['loc-1', 'loc-2'] });
    });

    it('applies no location filter when the actor holds LOCATION_ACCESS_ALL and no locationId was given', async () => {
      await service.getPurchaseRegister(context, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(
        mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where.locationId,
      ).toBeUndefined();
    });
  });
});
