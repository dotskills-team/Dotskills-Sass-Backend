import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BillingStatus, BillingAttemptStatus } from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleService } from '../subscription/subscription-lifecycle.service';
import { BillingService } from './billing.service';

describe('BillingService.markFailed', () => {
  let service: BillingService;

  const mockTx = {
    billing: { findUnique: jest.fn(), update: jest.fn() },
    billingAttempt: { findFirst: jest.fn(), update: jest.fn() },
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

    await expect(
      service.markFailed('billing-1', {}, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when there is no active STARTED attempt to settle', async () => {
    mockTx.billing.findUnique.mockResolvedValue(processingBilling);
    mockTx.billingAttempt.findFirst.mockResolvedValue(null);

    await expect(
      service.markFailed('billing-1', {}, 'user-1'),
    ).rejects.toThrow(NotFoundException);
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
      expect.objectContaining({ data: expect.objectContaining({ status: BillingStatus.FAILED }) }),
    );
    expect(mockTx.billingAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BillingAttemptStatus.FAILED }),
      }),
    );
  });
});
