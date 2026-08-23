import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  BillingStatus,
  InvoiceStatus,
  PaymentStatus,
} from '../../generated/phase-1-prisma/enums';
import { Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { BillingService } from '../billing/billing.service';
import { PaymentService } from './payment.service';
import { PAYMENT_GATEWAY_ADAPTERS } from './gateways/payment-gateway.tokens';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockTx = {
    payment: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    invoice: { findUniqueOrThrow: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockInvoiceService = {
    findOne: jest.fn(),
    markPaid: jest.fn(),
  };

  const mockBillingService = {
    process: jest.fn(),
    retry: jest.fn(),
    markSucceeded: jest.fn(),
    markFailed: jest.fn(),
  };

  const mockAdapter = {
    provider: 'SSLCOMMERZ',
    initiate: jest.fn(),
    verifyTransaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: BillingService, useValue: mockBillingService },
        {
          provide: PAYMENT_GATEWAY_ADAPTERS,
          useValue: { SSLCOMMERZ: mockAdapter },
        },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  const baseInvoice = {
    id: 'invoice-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    subscriptionId: 'sub-1',
    invoiceNumber: 'INV-2026-000001',
    status: InvoiceStatus.ISSUED,
    currencyCode: 'BDT',
    totalAmount: new Prisma.Decimal('999.0000'),
    billing: { id: 'billing-1', status: BillingStatus.PENDING },
  };

  const actor = {
    userId: 'user-1',
    email: 'owner@test.com',
    fullName: 'Test Owner',
  };
  const scope = { tenantId: 'tenant-1', companyId: 'company-1' };

  describe('create', () => {
    it('rejects creating a payment for a non-ISSUED invoice', async () => {
      mockInvoiceService.findOne.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.DRAFT,
      });

      await expect(
        service.create({ invoiceId: 'invoice-1' }, scope, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when an active payment already exists for the invoice', async () => {
      mockInvoiceService.findOne.mockResolvedValue(baseInvoice);
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'existing-payment',
      });

      await expect(
        service.create({ invoiceId: 'invoice-1' }, scope, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('calls billingService.process when billing is PENDING, and derives amount/currency strictly from the invoice', async () => {
      mockInvoiceService.findOne.mockResolvedValue(baseInvoice);
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockBillingService.process.mockResolvedValue({ attemptCount: 1 });
      mockTx.payment.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'payment-1', ...data }),
      );
      mockPrisma.payment.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'payment-1',
          tenantId: 'tenant-1',
          companyId: 'company-1',
          ...data,
        }),
      );
      mockAdapter.initiate.mockResolvedValue({
        gatewayPageUrl: 'https://sandbox.sslcommerz.com/pay/xyz',
        rawResponse: { status: 'SUCCESS' },
      });

      const result = await service.create(
        { invoiceId: 'invoice-1' },
        scope,
        actor,
      );

      expect(mockBillingService.process).toHaveBeenCalledWith(
        'billing-1',
        'user-1',
        mockTx,
      );
      expect(mockBillingService.retry).not.toHaveBeenCalled();

      const createArgs = mockTx.payment.create.mock.calls[0][0].data;
      expect(createArgs.amount.toString()).toBe(
        baseInvoice.totalAmount.toString(),
      );
      expect(createArgs.currencyCode).toBe(baseInvoice.currencyCode);

      expect(result.gatewayPageUrl).toBe(
        'https://sandbox.sslcommerz.com/pay/xyz',
      );
    });

    it('calls billingService.retry when billing is FAILED', async () => {
      mockInvoiceService.findOne.mockResolvedValue({
        ...baseInvoice,
        billing: { id: 'billing-1', status: BillingStatus.FAILED },
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockBillingService.retry.mockResolvedValue({ attemptCount: 2 });
      mockTx.payment.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'payment-1', ...data }),
      );
      mockPrisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        tenantId: 't',
        companyId: 'c',
      });
      mockAdapter.initiate.mockResolvedValue({
        gatewayPageUrl: 'https://x',
        rawResponse: {},
      });

      await service.create({ invoiceId: 'invoice-1' }, scope, actor);

      expect(mockBillingService.retry).toHaveBeenCalledWith(
        'billing-1',
        'user-1',
        mockTx,
      );
      expect(mockBillingService.process).not.toHaveBeenCalled();
    });

    it('rejects when billing is already PROCESSING (settlement already in flight)', async () => {
      mockInvoiceService.findOne.mockResolvedValue({
        ...baseInvoice,
        billing: { id: 'billing-1', status: BillingStatus.PROCESSING },
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ invoiceId: 'invoice-1' }, scope, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('marks payment FAILED and compensates billing when gateway initiation throws', async () => {
      mockInvoiceService.findOne.mockResolvedValue(baseInvoice);
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockBillingService.process.mockResolvedValue({ attemptCount: 1 });
      mockTx.payment.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'payment-1',
          providerTransactionId: 'DS123',
          amount: baseInvoice.totalAmount,
          currencyCode: 'BDT',
          provider: 'SSLCOMMERZ',
          ...data,
        }),
      );
      mockAdapter.initiate.mockRejectedValue(new Error('network down'));

      await expect(
        service.create({ invoiceId: 'invoice-1' }, scope, actor),
      ).rejects.toThrow('network down');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(mockBillingService.markFailed).toHaveBeenCalledWith(
        'billing-1',
        expect.objectContaining({ failureCode: 'GATEWAY_INIT_FAILED' }),
        'user-1',
      );
    });

    /**
     * Regression: if the compensating `billingService.markFailed()` call
     * itself throws (e.g. an unrelated DB error), that must never replace
     * the real gateway failure ("network down" here) in the response —
     * it's logged and swallowed, and the original error is always re-thrown.
     */
    it('still surfaces the original gateway error even if billing compensation itself throws', async () => {
      mockInvoiceService.findOne.mockResolvedValue(baseInvoice);
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockBillingService.process.mockResolvedValue({ attemptCount: 1 });
      mockTx.payment.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'payment-1',
          providerTransactionId: 'DS123',
          amount: baseInvoice.totalAmount,
          currencyCode: 'BDT',
          provider: 'SSLCOMMERZ',
          ...data,
        }),
      );
      mockAdapter.initiate.mockRejectedValue(new Error('network down'));
      mockBillingService.markFailed.mockRejectedValueOnce(
        new Error('unrelated compensation failure'),
      );

      await expect(
        service.create({ invoiceId: 'invoice-1' }, scope, actor),
      ).rejects.toThrow('network down');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
    });
  });

  describe('verifyAndSettle', () => {
    const processingPayment = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      status: PaymentStatus.PROCESSING,
      providerTransactionId: 'DS123',
      amount: new Prisma.Decimal('999.0000'),
      currencyCode: 'BDT',
      provider: 'SSLCOMMERZ',
      metadata: { initiatedByUserId: 'user-1' },
    };

    it('short-circuits (no gateway call) when the payment is already terminal', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...processingPayment,
        status: PaymentStatus.SUCCEEDED,
      });

      const result = await service.verifyAndSettle('payment-1', 'val-1');

      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockAdapter.verifyTransaction).not.toHaveBeenCalled();
    });

    it('settles as SUCCEEDED and calls invoice.markPaid + billing.markSucceeded with the shared tx', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(processingPayment);
      mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue({
        billingId: 'billing-1',
      });
      mockAdapter.verifyTransaction.mockResolvedValue({
        verified: true,
        amount: '999.0000',
        currencyCode: 'BDT',
        gatewayReference: 'val-1',
        rawResponse: { status: 'VALID' },
      });
      mockTx.payment.update.mockResolvedValue({
        ...processingPayment,
        status: PaymentStatus.SUCCEEDED,
      });

      await service.verifyAndSettle('payment-1', 'val-1');

      expect(mockInvoiceService.markPaid).toHaveBeenCalledWith(
        'invoice-1',
        'user-1',
        mockTx,
      );
      expect(mockBillingService.markSucceeded).toHaveBeenCalledWith(
        'billing-1',
        'user-1',
        mockTx,
      );
      expect(mockBillingService.markFailed).not.toHaveBeenCalled();
    });

    it('treats an amount mismatch as a failure, never as success', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(processingPayment);
      mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue({
        billingId: 'billing-1',
      });
      mockAdapter.verifyTransaction.mockResolvedValue({
        verified: true,
        amount: '1.0000', // gateway reports a different amount than stored
        currencyCode: 'BDT',
        gatewayReference: 'val-1',
        rawResponse: { status: 'VALID' },
      });
      mockTx.payment.update.mockResolvedValue({
        ...processingPayment,
        status: PaymentStatus.FAILED,
      });

      await service.verifyAndSettle('payment-1', 'val-1');

      expect(mockInvoiceService.markPaid).not.toHaveBeenCalled();
      expect(mockBillingService.markSucceeded).not.toHaveBeenCalled();
      expect(mockBillingService.markFailed).toHaveBeenCalledWith(
        'billing-1',
        expect.any(Object),
        'user-1',
        mockTx,
      );
    });

    it('settles as FAILED when the gateway reports verification failure', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(processingPayment);
      mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue({
        billingId: 'billing-1',
      });
      mockAdapter.verifyTransaction.mockResolvedValue({
        verified: false,
        amount: null,
        currencyCode: null,
        gatewayReference: 'val-1',
        rawResponse: { status: 'FAILED' },
      });
      mockTx.payment.update.mockResolvedValue({
        ...processingPayment,
        status: PaymentStatus.FAILED,
      });

      await service.verifyAndSettle('payment-1', 'val-1');

      expect(mockBillingService.markFailed).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a non-active payment', async () => {
      mockTx.payment.findUnique.mockResolvedValue({
        id: 'p1',
        status: PaymentStatus.SUCCEEDED,
      });

      await expect(service.cancel('p1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when the payment does not exist', async () => {
      mockTx.payment.findUnique.mockResolvedValue(null);

      await expect(service.cancel('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
