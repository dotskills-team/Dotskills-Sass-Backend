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

  it('queries only ACTIVE subscriptions past their currentPeriodEnd', async () => {
    await scheduler.autoRenewDue();

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: SubscriptionStatus.ACTIVE }),
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
   * PAST_DUE fail-safe removed (business decision: a renewal-generation
   * failure no longer degrades subscription status) — the subscription
   * stays ACTIVE; only the AUDIT_LOG entry + error log record the failure
   * for alerting. If the period genuinely ends before the next successful
   * attempt, runDueTransitions()'s own ACTIVE→EXPIRED check handles that
   * independently.
   */
  it('logs AUTO_RENEWAL_FAILED without touching subscription status when renewal fails', async () => {
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
    expect(mockLifecycle.transition).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('continues processing the rest of the batch when one subscription in it fails to renew', async () => {
    const secondSubscription = { ...dueSubscription, id: 'sub-2' };
    mockPrisma.subscription.findMany.mockResolvedValue([
      dueSubscription,
      secondSubscription,
    ]);
    mockPrisma.billing.findUnique.mockResolvedValue(null);
    mockRenewalService.renewSubscription
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});

    const result = await scheduler.autoRenewDue();

    expect(result.failed).toBe(1);
    expect(result.renewed).toBe(1);
  });
});
