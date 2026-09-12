import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import {
  CashDrawerSessionStatus,
  SaleStatus,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyPermissionResolverService } from '../../../common/services/company-permission-resolver.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import { NotificationService } from '../../notification/notification.service';
import { CashDrawerSessionService } from './cash-drawer.service';

describe('CashDrawerSessionService', () => {
  let service: CashDrawerSessionService;

  const mockTx = {
    cashDrawerSession: { create: jest.fn(), update: jest.fn() },
    salePayment: { aggregate: jest.fn() },
    auditLog: { create: jest.fn() },
    location: { findUnique: jest.fn() },
  };

  const mockPrisma = {
    location: { findFirst: jest.fn() },
    cashDrawerSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    companyMemberRole: { findMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  /** No CASH_DRAWER_SESSION_MANAGE_ALL grant by default — most tests model a Cashier acting on their own session. */
  function mockManageAll(canManageAll: boolean) {
    mockPrisma.companyMemberRole.findMany.mockResolvedValue(
      canManageAll
        ? [{ companyRole: { permissions: [{ effect: 'ALLOW' }] } }]
        : [],
    );
  }

  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
    getAssignedLocationIds: jest.fn().mockResolvedValue('ALL'),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'cashier-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocationAccessService.assertHasLocationAccess.mockResolvedValue(
      undefined,
    );
    mockLocationAccessService.getAssignedLocationIds.mockResolvedValue('ALL');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashDrawerSessionService,
        CompanyPermissionResolverService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: LocationAccessService,
          useValue: mockLocationAccessService,
        },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(CashDrawerSessionService);

    mockPrisma.location.findFirst.mockResolvedValue({ id: 'loc-1' });
    mockTx.location.findUnique.mockResolvedValue({ name: 'Main Branch' });
    mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(null);
    mockManageAll(false);
    mockTx.cashDrawerSession.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'session-1',
        status: CashDrawerSessionStatus.OPEN,
        ...data,
      }),
    );
  });

  describe('openSession', () => {
    it("requires openingBalance when this is the cashier's first session at this location", async () => {
      await expect(
        service.openSession(context, { locationId: 'loc-1' } as any, actor),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.cashDrawerSession.create).not.toHaveBeenCalled();
    });

    it('uses the client-supplied openingBalance for a first-ever session', async () => {
      const result = await service.openSession(
        context,
        { locationId: 'loc-1', openingBalance: 500 },
        actor,
      );

      expect(mockTx.cashDrawerSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            openingBalance: 500,
            cashierId: 'cashier-1',
          }),
        }),
      );
      expect(result.data.openingBalance).toBe(500);
    });

    it("derives openingBalance from the previous CLOSED session's actualClosingBalance, ignoring any client-supplied value", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        actualClosingBalance: new Prisma.Decimal(742.5),
      });

      await service.openSession(
        context,
        { locationId: 'loc-1', openingBalance: 999 },
        actor,
      );

      const createCall = mockTx.cashDrawerSession.create.mock.calls[0][0];
      expect(createCall.data.openingBalance).toBe(742.5);
    });

    it('translates a P2002 (partial unique index violation) into ConflictException', async () => {
      mockTx.cashDrawerSession.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2002',
          clientVersion: '0.0.0',
        }),
      );

      await expect(
        service.openSession(
          context,
          { locationId: 'loc-1', openingBalance: 500 } as any,
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a locationId that does not belong to this company', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.openSession(
          context,
          { locationId: 'other-loc', openingBalance: 500 } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('checks Location access for dto.locationId', async () => {
      await service.openSession(
        context,
        { locationId: 'loc-1', openingBalance: 500 },
        actor,
      );

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
    });

    it('propagates ForbiddenException from LocationAccessService and never creates a session', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.openSession(
          context,
          { locationId: 'unassigned-loc', openingBalance: 500 } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.cashDrawerSession.create).not.toHaveBeenCalled();
    });
  });

  describe('closeSession', () => {
    const openSessionRow = {
      id: 'session-1',
      status: CashDrawerSessionStatus.OPEN,
      openingBalance: new Prisma.Decimal(1000),
      cashierId: 'cashier-1', // same as `actor` — these tests model a cashier closing their own session
      locationId: 'location-1',
    };

    beforeEach(() => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(openSessionRow);
      mockTx.cashDrawerSession.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'session-1', ...data }),
      );
    });

    it('throws NotFoundException when the session does not exist in this company', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(null);

      await expect(
        service.closeSession(
          context,
          'missing',
          { actualClosingBalance: 100 } as any,
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects closing a session that is already CLOSED', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        ...openSessionRow,
        status: CashDrawerSessionStatus.CLOSED,
      });

      await expect(
        service.closeSession(
          context,
          'session-1',
          { actualClosingBalance: 100 } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes expectedClosingBalance = openingBalance + sum(CASH payments on COMPLETED sales only), and variance = actual - expected', async () => {
      mockTx.salePayment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(350) },
      });

      const result = await service.closeSession(
        context,
        'session-1',
        { actualClosingBalance: 1340 },
        actor,
      );

      expect(mockTx.salePayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            method: 'CASH',
            sale: {
              cashDrawerSessionId: 'session-1',
              status: SaleStatus.COMPLETED,
            },
          },
        }),
      );
      const updateCall = mockTx.cashDrawerSession.update.mock.calls[0][0];
      expect(updateCall.data.expectedClosingBalance).toBe(1350); // 1000 + 350
      expect(updateCall.data.actualClosingBalance).toBe(1340);
      expect(updateCall.data.variance).toBe(-10); // 1340 - 1350
      expect(updateCall.data.status).toBe(CashDrawerSessionStatus.CLOSED);
      expect(result.success).toBe(true);
    });

    it('never rejects on a non-zero variance — it still succeeds', async () => {
      mockTx.salePayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.closeSession(
        context,
        'session-1',
        { actualClosingBalance: 5000 },
        actor,
      );

      expect(result.success).toBe(true);
      const updateCall = mockTx.cashDrawerSession.update.mock.calls[0][0];
      expect(updateCall.data.variance).toBe(4000); // 5000 - 1000 (no cash sales)
    });

    describe('CASH_DRAWER_VARIANCE notification', () => {
      it('fires when the variance is non-zero', async () => {
        mockTx.salePayment.aggregate.mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(350) },
        });

        await service.closeSession(
          context,
          'session-1',
          { actualClosingBalance: 1340 }, // expected 1350, variance -10
          actor,
        );

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          context,
          expect.objectContaining({
            type: 'CASH_DRAWER_VARIANCE',
            relatedEntityType: 'CASH_DRAWER_SESSION',
            relatedEntityId: 'session-1',
            locationId: 'location-1',
            metadata: expect.objectContaining({
              locationName: 'Main Branch',
              variance: '-10',
            }),
          }),
        );
      });

      it('does not fire when the variance is exactly zero', async () => {
        mockTx.salePayment.aggregate.mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(350) },
        });

        await service.closeSession(
          context,
          'session-1',
          { actualClosingBalance: 1350 }, // expected 1350, variance 0
          actor,
        );

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });
    });

    it("rejects closing another cashier's session when the actor lacks CASH_DRAWER_SESSION_MANAGE_ALL", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        ...openSessionRow,
        cashierId: 'other-cashier',
      });

      await expect(
        service.closeSession(
          context,
          'session-1',
          { actualClosingBalance: 100 } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.cashDrawerSession.update).not.toHaveBeenCalled();
    });

    it("allows closing another cashier's session when the actor holds CASH_DRAWER_SESSION_MANAGE_ALL (Manager tier)", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        ...openSessionRow,
        cashierId: 'other-cashier',
      });
      mockManageAll(true);
      mockTx.salePayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.closeSession(
        context,
        'session-1',
        { actualClosingBalance: 1000 },
        actor,
      );

      expect(result.success).toBe(true);
      expect(mockTx.cashDrawerSession.update).toHaveBeenCalled();
    });

    it("checks Location access for the loaded session's own locationId", async () => {
      mockTx.salePayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      await service.closeSession(
        context,
        'session-1',
        { actualClosingBalance: 1000 },
        actor,
      );

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, openSessionRow.locationId);
    });

    it('propagates ForbiddenException from LocationAccessService and never updates the session', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.closeSession(
          context,
          'session-1',
          { actualClosingBalance: 1000 } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.cashDrawerSession.update).not.toHaveBeenCalled();
    });
  });

  describe('findOne — ownership scoping', () => {
    it('a non-elevated actor can read their own session', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        id: 'session-1',
        cashierId: 'cashier-1',
      });

      const result = await service.findOne(context, 'session-1', actor);
      expect(result.success).toBe(true);
    });

    it("a non-elevated actor cannot read another cashier's session", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        id: 'session-1',
        cashierId: 'other-cashier',
      });

      await expect(
        service.findOne(context, 'session-1', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('an actor with CASH_DRAWER_SESSION_MANAGE_ALL can read any session', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        id: 'session-1',
        cashierId: 'other-cashier',
      });
      mockManageAll(true);

      const result = await service.findOne(context, 'session-1', actor);
      expect(result.success).toBe(true);
    });

    it("checks Location access for the loaded session's own locationId", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        id: 'session-1',
        cashierId: 'cashier-1',
        locationId: 'location-1',
      });

      await service.findOne(context, 'session-1', actor);

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'location-1');
    });

    it('propagates ForbiddenException from LocationAccessService', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({
        id: 'session-1',
        cashierId: 'cashier-1',
        locationId: 'unassigned-loc',
      });
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.findOne(context, 'session-1', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('list — ownership scoping', () => {
    beforeEach(() => {
      mockPrisma.cashDrawerSession.findMany.mockResolvedValue([]);
      (mockPrisma.cashDrawerSession as any).count = jest
        .fn()
        .mockResolvedValue(0);
    });

    it("force-scopes to the actor's own cashierId when not elevated, ignoring any client-supplied cashierId", async () => {
      await service.list(context, { cashierId: 'someone-else' }, actor);

      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.cashierId).toBe('cashier-1');
    });

    it('respects the client-supplied cashierId (or shows all) when the actor holds CASH_DRAWER_SESSION_MANAGE_ALL', async () => {
      mockManageAll(true);

      await service.list(context, { cashierId: 'someone-else' }, actor);

      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.cashierId).toBe('someone-else');
    });

    it("an elevated actor with no cashierId filter sees every cashier's sessions", async () => {
      mockManageAll(true);

      await service.list(context, {}, actor);

      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.cashierId).toBeUndefined();
    });

    it('checks Location access when an explicit locationId filter is given', async () => {
      await service.list(context, { locationId: 'loc-1' }, actor);

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.locationId).toBe('loc-1');
    });

    it('propagates ForbiddenException when the explicit locationId is not assigned to the actor', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.list(context, { locationId: 'unassigned-loc' } as any, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.cashDrawerSession.findMany).not.toHaveBeenCalled();
    });

    it('implicitly scopes to the assigned-locations set when no locationId filter is given and the actor is not LOCATION_ACCESS_ALL', async () => {
      mockLocationAccessService.getAssignedLocationIds.mockResolvedValue([
        'loc-1',
        'loc-2',
      ]);

      await service.list(context, {}, actor);

      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.locationId).toEqual({ in: ['loc-1', 'loc-2'] });
    });

    it('applies no location filter at all when the actor holds LOCATION_ACCESS_ALL and no locationId was given', async () => {
      mockLocationAccessService.getAssignedLocationIds.mockResolvedValue('ALL');

      await service.list(context, {}, actor);

      const [findManyArgs] =
        mockPrisma.cashDrawerSession.findMany.mock.calls[0];
      expect(findManyArgs.where.locationId).toBeUndefined();
    });
  });
});
