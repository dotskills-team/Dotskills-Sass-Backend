import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  BillingStatus,
  BillingAttemptStatus,
  PaymentStatus,
} from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleService } from '../subscription/subscription-lifecycle.service';
import { BillingService } from './billing.service';

describe('BillingService.markFailed', () => {
  let service: BillingService;

  const mockTx = {
    billing: { findUnique: jest.fn(), update: jest.fn() },
    billingAttempt: { findFirst: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn() },
    payment: { updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const mockSubscriptionLifecycleService = {
    paymentFailed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: SubscriptionLifecycleService,
          useValue: mockSubscriptionLifecycleService,
        },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  const processingBilling = {
    id: 'billing-1',
    subscriptionId: 'sub-1',
    status: BillingStatus.PROCESSING,
    attemptCount: 1,
    metadata: null,
  };

  const startedAttempt = {
    id: 'attempt-1',
    billingId: 'billing-1',
    attemptNumber: 1,
    status: BillingAttemptStatus.STARTED,
    idempotencyKey: 'billing:sub-1:attempt:1',
  };

  it('rejects marking a non-PROCESSING billing as failed', async () => {
    mockTx.billing.findUnique.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.PENDING,
    });

    await expect(service.markFailed('billing-1', {}, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when there is no active STARTED attempt to settle', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(null);

    await expect(service.markFailed('billing-1', {}, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks Billing and BillingAttempt FAILED, preserving failureCode/failureMessage', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(startedAttempt);
    mockSubscriptionLifecycleService.paymentFailed.mockResolvedValue({
      id: 'sub-1',
    });
    mockTx.billing.update.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.FAILED,
    });

    await service.markFailed(
      'billing-1',
      { failureCode: 'GATEWAY_INIT_FAILED', failureMessage: 'network down' },
      'user-1',
    );

    expect(mockTx.billing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'billing-1' },
        data: expect.objectContaining({
          status: BillingStatus.FAILED,
          metadata: expect.objectContaining({
            failureCode: 'GATEWAY_INIT_FAILED',
            failureMessage: 'network down',
          }),
        }),
      }),
    );
    expect(mockTx.billingAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-1' },
        data: expect.objectContaining({
          status: BillingAttemptStatus.FAILED,
          failureCode: 'GATEWAY_INIT_FAILED',
          failureMessage: 'network down',
        }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BILLING_FAILED',
          entityType: 'Billing',
        }),
      }),
    );
  });

  /**
   * Regression: a subscription already in GRACE used to make
   * `subscriptionLifecycleService.paymentFailed()` throw, which — running
   * inside this same transaction — rolled back before Billing/BillingAttempt
   * were ever marked FAILED, leaving them stuck at PROCESSING/STARTED. Now
   * `paymentFailed()` handles GRACE (→ SUSPENDED) instead of throwing, so
   * this transaction always completes.
   */
  it('still completes and marks Billing/BillingAttempt FAILED when the subscription is in GRACE', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(startedAttempt);
    mockSubscriptionLifecycleService.paymentFailed.mockResolvedValue({
      id: 'sub-1',
      status: 'SUSPENDED',
    });
    mockTx.billing.update.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.FAILED,
    });

    await service.markFailed(
      'billing-1',
      { failureCode: 'GATEWAY_INIT_FAILED', failureMessage: 'still failing' },
      'user-1',
    );

    expect(mockSubscriptionLifecycleService.paymentFailed).toHaveBeenCalled();
    expect(mockTx.billing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BillingStatus.FAILED }),
      }),
    );
    expect(mockTx.billingAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BillingAttemptStatus.FAILED }),
      }),
    );
  });

  /**
   * Regression: markFailed() reached directly (e.g. Platform Admin's "Mark
   * billing failed" action) never touched the Payment table at all, so a
   * Payment left PENDING/PROCESSING for this Billing's Invoice became a
   * permanent orphan — forever tripping PaymentService.create()'s
   * duplicate-active-payment guard ("A payment is already in progress")
   * with no way to retry. markFailed() must now sync any such Payment to
   * FAILED in the same transaction.
   */
  it("syncs a still-PENDING/PROCESSING Payment on this Billing's Invoice to FAILED", async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(startedAttempt);
    mockSubscriptionLifecycleService.paymentFailed.mockResolvedValue({
      id: 'sub-1',
    });
    mockTx.billing.update.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.FAILED,
    });
    mockTx.invoice.findUnique.mockResolvedValue({ id: 'invoice-1' });

    await service.markFailed(
      'billing-1',
      { failureMessage: 'Admin marked as failed' },
      'user-1',
    );

    expect(mockTx.invoice.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { billingId: 'billing-1' } }),
    );
    expect(mockTx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          invoiceId: 'invoice-1',
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
          failureReason: 'Admin marked as failed',
        }),
      }),
    );
  });

  it('skips the Payment sync (no-op) when this Billing has no Invoice yet', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(startedAttempt);
    mockSubscriptionLifecycleService.paymentFailed.mockResolvedValue({
      id: 'sub-1',
    });
    mockTx.billing.update.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.FAILED,
    });
    mockTx.invoice.findUnique.mockResolvedValue(null);

    await service.markFailed('billing-1', {}, 'user-1');

    expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
  });
});

describe('BillingService.releaseCancelledAttempt', () => {
  let service: BillingService;

  const mockTx = {
    billing: { findUnique: jest.fn(), update: jest.fn() },
    billingAttempt: { findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const mockSubscriptionLifecycleService = {
    paymentFailed: jest.fn(),
    paymentSucceeded: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: SubscriptionLifecycleService,
          useValue: mockSubscriptionLifecycleService,
        },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  const processingBilling = {
    id: 'billing-1',
    subscriptionId: 'sub-1',
    status: BillingStatus.PROCESSING,
    attemptCount: 2,
    metadata: { retryBy: 'owner-1' },
  };

  const startedAttempt = {
    id: 'attempt-2',
    billingId: 'billing-1',
    attemptNumber: 2,
    status: BillingAttemptStatus.STARTED,
    idempotencyKey: 'billing-1:attempt:2',
  };

  it('rejects releasing a non-PROCESSING billing', async () => {
    mockTx.billing.findUnique.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.PENDING,
    });

    await expect(
      service.releaseCancelledAttempt('billing-1', 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when there is no active STARTED attempt to release', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(null);

    await expect(
      service.releaseCancelledAttempt('billing-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  /**
   * Core regression this method exists to fix: a customer cancelling
   * checkout is not a gateway decline. Billing must return to PENDING
   * (immediately payable again by create()'s existing PENDING → process()
   * branch) — never FAILED (that label means a real decline and would
   * route through markFailed(), which unconditionally degrades the
   * subscription) and never CANCELLED (that's the Platform Admin's own
   * separate, deliberate whole-billing-period cancel() action).
   * attemptCount must be left untouched so MAX_ATTEMPTS keeps counting
   * correctly across the cancellation.
   */
  it('releases the attempt to CANCELLED and the billing to PENDING, without touching the subscription', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(startedAttempt);
    mockTx.billing.update.mockResolvedValue({
      ...processingBilling,
      status: BillingStatus.PENDING,
    });

    const result = await service.releaseCancelledAttempt('billing-1', 'user-1');

    expect(mockTx.billingAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-2' },
        data: expect.objectContaining({
          status: BillingAttemptStatus.CANCELLED,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockTx.billing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'billing-1' },
        data: expect.objectContaining({
          status: BillingStatus.PENDING,
          metadata: expect.objectContaining({
            retryBy: 'owner-1', // prior metadata preserved, not overwritten
            lastCancelledBy: 'user-1',
          }),
        }),
      }),
    );
    // attemptCount is never part of this update — MAX_ATTEMPTS counting is untouched
    expect(
      mockTx.billing.update.mock.calls[0][0].data.attemptCount,
    ).toBeUndefined();
    expect(result.status).toBe(BillingStatus.PENDING);

    expect(
      mockSubscriptionLifecycleService.paymentFailed,
    ).not.toHaveBeenCalled();
    expect(
      mockSubscriptionLifecycleService.paymentSucceeded,
    ).not.toHaveBeenCalled();

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BILLING_ATTEMPT_RELEASED',
          entityType: 'Billing',
        }),
      }),
    );
  });
});
