import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import { CashDrawerSessionStatus, SaleStatus } from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { CashDrawerSessionService } from './cash-drawer.service';

describe('CashDrawerSessionService', () => {
  let service: CashDrawerSessionService;

  const mockTx = {
    cashDrawerSession: { create: jest.fn(), update: jest.fn() },
    salePayment: { aggregate: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    location: { findFirst: jest.fn() },
    cashDrawerSession: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(mockTx) : Promise.all(arg))),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'cashier-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CashDrawerSessionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CashDrawerSessionService);

    mockPrisma.location.findFirst.mockResolvedValue({ id: 'loc-1' });
    mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(null);
    mockTx.cashDrawerSession.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'session-1', status: CashDrawerSessionStatus.OPEN, ...data }),
    );
  });

  describe('openSession', () => {
    it('requires openingBalance when this is the cashier\'s first session at this location', async () => {
      await expect(
        service.openSession(context, { locationId: 'loc-1' } as any, actor),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.cashDrawerSession.create).not.toHaveBeenCalled();
    });

    it('uses the client-supplied openingBalance for a first-ever session', async () => {
      const result = await service.openSession(context, { locationId: 'loc-1', openingBalance: 500 } as any, actor);

      expect(mockTx.cashDrawerSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ openingBalance: 500, cashierId: 'cashier-1' }) }),
      );
      expect(result.data.openingBalance).toBe(500);
    });

    it("derives openingBalance from the previous CLOSED session's actualClosingBalance, ignoring any client-supplied value", async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({ actualClosingBalance: new Prisma.Decimal(742.5) });

      await service.openSession(context, { locationId: 'loc-1', openingBalance: 999 } as any, actor);

      const createCall = mockTx.cashDrawerSession.create.mock.calls[0][0];
      expect(createCall.data.openingBalance).toBe(742.5);
    });

    it('translates a P2002 (partial unique index violation) into ConflictException', async () => {
      mockTx.cashDrawerSession.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '0.0.0' }),
      );

      await expect(
        service.openSession(context, { locationId: 'loc-1', openingBalance: 500 } as any, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a locationId that does not belong to this company', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.openSession(context, { locationId: 'other-loc', openingBalance: 500 } as any, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeSession', () => {
    const openSessionRow = {
      id: 'session-1',
      status: CashDrawerSessionStatus.OPEN,
      openingBalance: new Prisma.Decimal(1000),
    };

    beforeEach(() => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(openSessionRow);
      mockTx.cashDrawerSession.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'session-1', ...data }));
    });

    it('throws NotFoundException when the session does not exist in this company', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue(null);

      await expect(service.closeSession(context, 'missing', { actualClosingBalance: 100 } as any, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects closing a session that is already CLOSED', async () => {
      mockPrisma.cashDrawerSession.findFirst.mockResolvedValue({ ...openSessionRow, status: CashDrawerSessionStatus.CLOSED });

      await expect(service.closeSession(context, 'session-1', { actualClosingBalance: 100 } as any, actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('computes expectedClosingBalance = openingBalance + sum(CASH payments on COMPLETED sales only), and variance = actual - expected', async () => {
      mockTx.salePayment.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(350) } });

      const result = await service.closeSession(context, 'session-1', { actualClosingBalance: 1340 } as any, actor);

      expect(mockTx.salePayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { method: 'CASH', sale: { cashDrawerSessionId: 'session-1', status: SaleStatus.COMPLETED } },
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
      mockTx.salePayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await service.closeSession(context, 'session-1', { actualClosingBalance: 5000 } as any, actor);

      expect(result.success).toBe(true);
      const updateCall = mockTx.cashDrawerSession.update.mock.calls[0][0];
      expect(updateCall.data.variance).toBe(4000); // 5000 - 1000 (no cash sales)
    });
  });
});
