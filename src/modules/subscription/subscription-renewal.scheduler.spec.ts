import { Test, TestingModule } from '@nestjs/testing';

import {
  BillingCycle,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionRenewalScheduler } from './subscription-renewal.scheduler';
import { SubscriptionRenewalService } from './subscription-renewal.service';

describe('SubscriptionRenewalScheduler.autoRenewDue', () => {
  let scheduler: SubscriptionRenewalScheduler;

  const mockPrisma = {
    subscription: { findMany: jest.fn() },
    billing: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockRenewalService = { renewSubscription: jest.fn() };

  const mockLifecycle = {
    calculatePeriodEnd: jest.fn(
      (start: Date) => new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
    ),
    addDays: jest.fn(
      (date: Date, days: number) =>
        new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
    ),
    transition: jest.fn().mockResolvedValue({}),
  };

  const dueSubscription = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRenewalScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionRenewalService, useValue: mockRenewalService },
        { provide: SubscriptionLifecycleService, useValue: mockLifecycle },
      ],
    }).compile();

    scheduler = module.get(SubscriptionRenewalScheduler);
  });

  it('queries only ACTIVE/PAST_DUE subscriptions past their currentPeriodEnd', async () => {
    await scheduler.autoRenewDue();

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        }),
      }),
    );
  });

  /**
   * Regression guard for the audit finding: this query must never pick up a
   * subscription where the Owner explicitly turned auto-renew off — that
   * decision belongs to runDueTransitions()'s ACTIVE+autoRenew:false ->
   * EXPIRED branch, not to this proactive renewal generator.
   */
  it('only queries subscriptions with autoRenew: true', async () => {
    await scheduler.autoRenewDue();

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ autoRenew: true }),
      }),
    );
  });

  it('skips a subscription that already has a Billing for the next period, never calling renewSubscription', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([dueSubscription]);
    mockPrisma.billing.findUnique.mockResolvedValue({ id: 'billing-existing' });

    const result = await scheduler.autoRenewDue();

    expect(mockRenewalService.renewSubscription).not.toHaveBeenCalled();
    expect(result.alreadyRenewed).toBe(1);
    expect(result.renewed).toBe(0);
  });

  it('renews a due subscription and records a SYSTEM-attributed success audit', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([dueSubscription]);
    mockPrisma.billing.findUnique.mockResolvedValue(null);
    mockRenewalService.renewSubscription.mockResolvedValue({});

    const result = await scheduler.autoRenewDue();

    expect(mockRenewalService.renewSubscription).toHaveBeenCalledWith('sub-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'AUTO_RENEWAL_SUCCEEDED',
          actorType: 'SYSTEM',
          actorUserId: null,
        }),
      }),
    );
    expect(result.renewed).toBe(1);
    expect(mockLifecycle.transition).not.toHaveBeenCalled();
  });

  /**
   * Core fail-safe requirement: a technical failure while renewing an
   * ACTIVE subscription must demote it to PAST_DUE with the identical
   * patch shape runDueTransitions()'s own ACTIVE->PAST_DUE branch uses, so
   * the existing PAST_DUE->GRACE timer picks up correctly — and it must
   * never crash the batch for the other subscriptions in it.
   */
  it('demotes an ACTIVE subscription to PAST_DUE when renewal fails, and logs AUTO_RENEWAL_FAILED', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([dueSubscription]);
    mockPrisma.billing.findUnique.mockResolvedValue(null);
    mockRenewalService.renewSubscription.mockRejectedValue(
      new Error('DB unavailable'),
    );

    const result = await scheduler.autoRenewDue();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'AUTO_RENEWAL_FAILED',
          actorType: 'SYSTEM',
          afterData: expect.objectContaining({ message: 'DB unavailable' }),
        }),
      }),
    );
    expect(mockLifecycle.transition).toHaveBeenCalledWith(
      dueSubscription,
      SubscriptionStatus.PAST_DUE,
      expect.objectContaining({ actorType: 'SYSTEM' }),
      expect.objectContaining({
        reason: 'AUTO_RENEWAL_FAILED',
        source: 'SCHEDULER',
        patch: expect.objectContaining({ pastDueEndsAt: expect.any(Date) }),
      }),
    );
    expect(result.failed).toBe(1);
  });

  it('does not attempt a transition when renewal fails for an already-PAST_DUE subscription', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { ...dueSubscription, status: SubscriptionStatus.PAST_DUE },
    ]);
    mockPrisma.billing.findUnique.mockResolvedValue(null);
    mockRenewalService.renewSubscription.mockRejectedValue(new Error('boom'));

    const result = await scheduler.autoRenewDue();

    expect(mockLifecycle.transition).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTO_RENEWAL_FAILED' }),
      }),
    );
    expect(result.failed).toBe(1);
  });

  it('continues processing the rest of the batch when the fail-safe transition itself throws', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([dueSubscription]);
    mockPrisma.billing.findUnique.mockResolvedValue(null);
    mockRenewalService.renewSubscription.mockRejectedValue(new Error('boom'));
    mockLifecycle.transition.mockRejectedValueOnce(new Error('transition also failed'));

    await expect(scheduler.autoRenewDue()).resolves.toBeDefined();
  });
});
