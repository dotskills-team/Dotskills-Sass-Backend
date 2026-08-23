import { Test, TestingModule } from '@nestjs/testing';

import { AuditActorType, SubscriptionStatus } from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

describe('SubscriptionLifecycleService.paymentFailed', () => {
  let service: SubscriptionLifecycleService;

  const mockTx = {
    subscriptionEvent: { findUnique: jest.fn(), create: jest.fn() },
    subscription: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
    subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
    subscriptionEvent: { findUnique: jest.fn() },
  };

  const context = {
    userId: 'user-1',
    actorType: AuditActorType.PLATFORM_MEMBER,
  };

  function subscriptionWith(status: SubscriptionStatus) {
    return {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status,
      billingCycle: 'MONTHLY',
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscriptionEvent.findUnique.mockResolvedValue(null); // no idempotent replay by default

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  it('moves ACTIVE → PAST_DUE on first failure', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.ACTIVE);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.PAST_DUE,
    });

    const result = await service.paymentFailed('sub-1', context, 'key-1');

    expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.ACTIVE },
        data: expect.objectContaining({ status: SubscriptionStatus.PAST_DUE }),
      }),
    );
    expect(mockTx.subscriptionEvent.create).toHaveBeenCalled();
  });

  it('moves PAST_DUE → GRACE on continued failure', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.PAST_DUE);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.GRACE,
    });

    const result = await service.paymentFailed('sub-1', context, 'key-2');

    expect(result.status).toBe(SubscriptionStatus.GRACE);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.PAST_DUE },
        data: expect.objectContaining({ status: SubscriptionStatus.GRACE }),
      }),
    );
  });

  /**
   * Regression: this previously threw `BadRequestException` ("Payment failure
   * can only move ACTIVE→PAST_DUE or PAST_DUE→GRACE."), which — because
   * `paymentFailed()` runs inside `BillingService.markFailed()`'s transaction —
   * rolled back the caller's Billing/BillingAttempt FAILED bookkeeping and left
   * them stuck at PROCESSING/STARTED. GRACE→SUSPENDED mirrors the exact
   * transition `runDueTransitions()` already applies when `graceEndsAt` elapses.
   */
  it('moves GRACE → SUSPENDED on continued failure (mirrors the scheduler transition)', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.GRACE);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.SUSPENDED,
    });

    const result = await service.paymentFailed('sub-1', context, 'key-3');

    expect(result.status).toBe(SubscriptionStatus.SUSPENDED);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.GRACE },
        data: expect.objectContaining({
          status: SubscriptionStatus.SUSPENDED,
          suspendedAt: expect.any(Date),
          suspensionExpiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mockTx.subscriptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'PAYMENT_GRACE_EXHAUSTED' }),
      }),
    );
  });

  it.each([
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.TRIALING,
  ])(
    'is a no-op (never throws) when payment fails while already %s',
    async (status) => {
      const subscription = subscriptionWith(status);
      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      const result = await service.paymentFailed('sub-1', context, 'key-4');

      expect(result.status).toBe(status);
      expect(mockTx.subscription.updateMany).not.toHaveBeenCalled();
      expect(mockTx.subscriptionEvent.create).not.toHaveBeenCalled();
    },
  );
});
