import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { InvoiceStatus } from '../../generated/phase-1-prisma/enums';
import { Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  let service: InvoiceService;

  const mockTx = {
    billing: { findUnique: jest.fn() },
    invoice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
    invoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  const baseBilling = {
    id: 'billing-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    subscriptionId: 'sub-1',
    currencyCode: 'BDT',
    amount: new Prisma.Decimal('999.0000'),
    dueAt: new Date('2026-09-01T00:00:00Z'),
    priceSnapshot: { planCode: 'PRO', amount: '999.0000', currencyCode: 'BDT' },
    invoice: null,
  };

  describe('create', () => {
    it('throws NotFoundException when billing does not exist', async () => {
      mockTx.billing.findUnique.mockResolvedValue(null);

      await expect(service.create({ billingId: 'missing' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when billing already has an invoice', async () => {
      mockTx.billing.findUnique.mockResolvedValue({
        ...baseBilling,
        invoice: { id: 'existing-invoice' },
      });

      await expect(
        service.create({ billingId: baseBilling.id }),
      ).rejects.toThrow(ConflictException);
    });

    it('derives amount/currency/priceSnapshot strictly from the billing row, never from client input', async () => {
      mockTx.billing.findUnique.mockResolvedValue(baseBilling);
      mockTx.$queryRaw.mockResolvedValue([{ lastNumber: 1 }]);
      mockTx.invoice.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'invoice-1', ...data }),
      );

      const result = await service.create(
        { billingId: baseBilling.id },
        'actor-1',
      );

      expect(mockTx.invoice.create).toHaveBeenCalledTimes(1);
      const createArgs = mockTx.invoice.create.mock.calls[0][0].data;

      expect(createArgs.currencyCode).toBe(baseBilling.currencyCode);
      expect(createArgs.subtotal.toString()).toBe(
        baseBilling.amount.toString(),
      );
      expect(createArgs.totalAmount.toString()).toBe(
        baseBilling.amount.toString(),
      );
      expect(createArgs.priceSnapshot).toEqual(baseBilling.priceSnapshot);
      expect(createArgs.status).toBe(InvoiceStatus.DRAFT);
      expect(result.invoiceNumber).toBe('INV-2026-000001');
      expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('maps a unique-constraint race (P2002) to ConflictException', async () => {
      mockTx.billing.findUnique.mockResolvedValue(baseBilling);
      mockTx.$queryRaw.mockResolvedValue([{ lastNumber: 1 }]);
      mockTx.invoice.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create({ billingId: baseBilling.id }),
      ).rejects.toThrow(ConflictException);
    });
  });

  const baseInvoice = {
    id: 'invoice-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    status: InvoiceStatus.DRAFT,
  };

  describe('issue', () => {
    it('rejects issuing a non-DRAFT invoice', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });

      await expect(service.issue('invoice-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('moves DRAFT -> ISSUED and writes an audit log', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(baseInvoice);
      mockTx.invoice.update.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });

      const result = await service.issue('invoice-1', 'actor-1');

      expect(result.status).toBe(InvoiceStatus.ISSUED);
      expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a non-DRAFT invoice', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });

      await expect(service.cancel('invoice-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('void', () => {
    it('rejects voiding a non-ISSUED invoice', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(baseInvoice); // DRAFT

      await expect(service.void('invoice-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects voiding an already PAID invoice (financial history immutable)', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.PAID,
      });

      await expect(service.void('invoice-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    /**
     * void() is now also called by the scheduler (voidStaleIssuedInvoices)
     * with no actorUserId — the audit trail must correctly attribute that
     * as a SYSTEM action, not silently record it as a human Platform Admin.
     */
    it('records actorType SYSTEM when called with no actorUserId (scheduler-triggered)', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });
      mockTx.invoice.update.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.VOID,
      });

      await service.void('invoice-1');

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: null,
            actorType: 'SYSTEM',
            action: 'INVOICE_VOIDED',
          }),
        }),
      );
    });

    it('records actorType PLATFORM_MEMBER when an actorUserId is given (Admin-triggered)', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });
      mockTx.invoice.update.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.VOID,
      });

      await service.void('invoice-1', 'admin-1');

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: 'admin-1',
            actorType: 'PLATFORM_MEMBER',
          }),
        }),
      );
    });
  });

  describe('markPaid', () => {
    it('rejects marking a non-ISSUED invoice as paid', async () => {
      mockTx.invoice.findUnique.mockResolvedValue(baseInvoice); // DRAFT

      await expect(service.markPaid('invoice-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('moves ISSUED -> PAID and writes an audit log', async () => {
      mockTx.invoice.findUnique.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.ISSUED,
      });
      mockTx.invoice.update.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.PAID,
      });

      const result = await service.markPaid('invoice-1', 'actor-1');

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('reuses an externally supplied tx instead of opening its own transaction', async () => {
      const externalTx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseInvoice,
            status: InvoiceStatus.ISSUED,
          }),
          update: jest.fn().mockResolvedValue({
            ...baseInvoice,
            status: InvoiceStatus.PAID,
          }),
        },
        auditLog: { create: jest.fn() },
      } as any;

      mockPrisma.$transaction.mockClear();

      const result = await service.markPaid('invoice-1', 'actor-1', externalTx);

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(externalTx.invoice.update).toHaveBeenCalledTimes(1);
    });
  });
});
