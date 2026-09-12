import { Test, TestingModule } from '@nestjs/testing';

import {
  AuditActorType,
  NotificationType,
  NotificationRelatedEntityType,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { NotificationService } from '../notification/notification.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

const mockInvoiceService = { void: jest.fn() };
const mockNotificationService = { create: jest.fn() };

describe('SubscriptionLifecycleService.paymentFailed', () => {
  let service: SubscriptionLifecycleService;

  const mockPrisma = {
    subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  /**
   * PAST_DUE/GRACE removed entirely (business decision: a payment failure
   * no longer changes subscription status — the Billing/Payment rows
   * already record FAILED independently, and the period simply expires on
   * its own clock if never paid). paymentFailed() is now a pure
   * scope-check-and-return, for every remaining status.
   */
  it.each([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
  ])(
    'is a no-op (never throws, status unchanged) when payment fails while %s',
    async (status) => {
      const subscription = subscriptionWith(status);
      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      const result = await service.paymentFailed('sub-1', context);

      expect(result.status).toBe(status);
    },
  );

  it('throws NotFoundException when the subscription does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.paymentFailed('missing-id', context)).rejects.toThrow(
      'Subscription not found.',
    );
  });
});

describe('SubscriptionLifecycleService.transition — SUSPENDED notification', () => {
  let service: SubscriptionLifecycleService;

  const mockTx = {
    subscriptionEvent: { findUnique: jest.fn(), create: jest.fn() },
    subscription: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    company: { updateMany: jest.fn() },
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

  function subscriptionWith(
    status: SubscriptionStatus,
    companyId: string | null = 'company-1',
  ) {
    return {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId,
      status,
      billingCycle: 'MONTHLY',
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscriptionEvent.findUnique.mockResolvedValue(null);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  /**
   * SUSPENDED is now only reachable via manual Platform-Admin suspension
   * (SubscriptionService.suspendForPlatform()) — the company still gets
   * notified, reusing the existing SUBSCRIPTION_PAST_DUE category (no
   * dedicated SUSPENDED notification type exists in the schema).
   */
  it('fires when transitioning ACTIVE → SUSPENDED (manual Platform-Admin suspension)', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.ACTIVE);
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.SUSPENDED,
    });

    await service.transition(
      subscription as any,
      SubscriptionStatus.SUSPENDED,
      context,
      {
        reason: 'PLATFORM_ADMIN_SUSPENDED',
        source: 'API',
      },
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockTx,
      { tenantId: 'tenant-1', companyId: 'company-1' },
      {
        type: NotificationType.SUBSCRIPTION_PAST_DUE,
        relatedEntityType: NotificationRelatedEntityType.SUBSCRIPTION,
        relatedEntityId: 'sub-1',
        metadata: {
          status: SubscriptionStatus.SUSPENDED,
          reason: 'PLATFORM_ADMIN_SUSPENDED',
        },
      },
    );
  });

  it('does not fire when transitioning into a non-SUSPENDED status (e.g. recovering to ACTIVE)', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.SUSPENDED);
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.ACTIVE,
    });

    await service.transition(
      subscription as any,
      SubscriptionStatus.ACTIVE,
      context,
      {
        reason: 'PAYMENT_SUCCEEDED',
        source: 'PAYMENT',
      },
    );

    expect(mockNotificationService.create).not.toHaveBeenCalled();
  });

  it('does not fire for a platform-only subscription with no companyId', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.ACTIVE, null);
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.SUSPENDED,
    });

    await service.transition(
      subscription as any,
      SubscriptionStatus.SUSPENDED,
      context,
      {
        reason: 'PLATFORM_ADMIN_SUSPENDED',
        source: 'API',
      },
    );

    expect(mockNotificationService.create).not.toHaveBeenCalled();
  });

  it('does not fire again on an idempotent replay of an already-applied transition', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.ACTIVE);
    mockTx.subscriptionEvent.findUnique.mockResolvedValue({
      id: 'event-1',
    } as any);
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.SUSPENDED,
    });

    await service.transition(
      subscription as any,
      SubscriptionStatus.SUSPENDED,
      context,
      {
        reason: 'PLATFORM_ADMIN_SUSPENDED',
        source: 'API',
        idempotencyKey: 'already-used-key',
      },
    );

    expect(mockTx.subscription.updateMany).not.toHaveBeenCalled();
    expect(mockNotificationService.create).not.toHaveBeenCalled();
  });
});

describe('SubscriptionLifecycleService.paymentSucceeded', () => {
  let service: SubscriptionLifecycleService;

  const mockTx = {
    subscriptionEvent: { findUnique: jest.fn(), create: jest.fn() },
    subscription: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    company: { updateMany: jest.fn() },
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
    mockPrisma.subscriptionEvent.findUnique.mockResolvedValue(null);
    mockTx.subscriptionEvent.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  it('renews in place (no throw, status unchanged) when payment succeeds while already ACTIVE', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.ACTIVE);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      currentPeriodEnd: new Date('2027-01-01'),
    });

    const result = await service.paymentSucceeded('sub-1', context, 'key-1');

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.ACTIVE },
        data: expect.objectContaining({
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      }),
    );
    // status itself is never part of the update — this is a renewal, not a transition
    expect(
      mockTx.subscription.updateMany.mock.calls[0][0].data.status,
    ).toBeUndefined();
    expect(mockTx.subscriptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: SubscriptionStatus.ACTIVE,
          toStatus: SubscriptionStatus.ACTIVE,
          reason: 'PAYMENT_SUCCEEDED',
        }),
      }),
    );
  });

  /**
   * A company paying mid-trial must actually become ACTIVE (not stay
   * TRIALING) — renewInPlace() alone would leave status untouched, which
   * is wrong here, so this goes through the same non-backdated
   * transition() path as an EXPIRED resubscribe.
   */
  it('activates a TRIALING subscription (clears trialEndsAt, status → ACTIVE) on successful payment', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.TRIALING);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.ACTIVE,
    });

    const result = await service.paymentSucceeded('sub-1', context, 'key-2');

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.TRIALING },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          trialEndsAt: null,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      }),
    );
  });

  /**
   * The "no backdating" rule in practice: resubscribing after expiry
   * starts the new period at payment time, not at the old period's end —
   * calculatePeriodEnd() is always applied to `now`, never to any stored
   * date on the expired row.
   */
  it('recovers EXPIRED → ACTIVE on successful payment with a non-backdated period', async () => {
    const subscription = subscriptionWith(SubscriptionStatus.EXPIRED);
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.ACTIVE,
    });

    const before = new Date();
    const result = await service.paymentSucceeded('sub-1', context, 'key-3');
    const after = new Date();

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    const patch = mockTx.subscription.updateMany.mock.calls[0][0].data;
    expect(patch.status).toBe(SubscriptionStatus.ACTIVE);
    expect(patch.currentPeriodStart.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(patch.currentPeriodStart.getTime()).toBeLessThanOrEqual(
      after.getTime(),
    );
  });

  it.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.SUSPENDED])(
    'rejects payment success while %s (not a renewable or activatable state)',
    async (status) => {
      const subscription = subscriptionWith(status);
      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      await expect(
        service.paymentSucceeded('sub-1', context, 'key-4'),
      ).rejects.toThrow(
        'Payment can only activate a TRIALING or EXPIRED subscription (or renew an already-ACTIVE one).',
      );
      expect(mockTx.subscription.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('SubscriptionLifecycleService.planChangeSucceeded', () => {
  let service: SubscriptionLifecycleService;

  const mockTx = {
    subscriptionEvent: { findUnique: jest.fn(), create: jest.fn() },
    subscription: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    company: { updateMany: jest.fn() },
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

  const newPlan = {
    id: 'plan-2',
    billingCycle: 'YEARLY' as const,
    priceSnapshot: { planId: 'plan-2', amount: '999.0000' } as any,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscriptionEvent.findUnique.mockResolvedValue(null);
    mockTx.subscriptionEvent.findUnique.mockResolvedValue(null);
    mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  /**
   * Plan/cycle/price and the period reset are applied together, in the
   * same updateMany() call — a subscription is never left ACTIVE on the
   * old plan with a new period, or on the new plan with the old period.
   */
  it('atomically swaps plan/billingCycle/priceSnapshot and resets the period on success', async () => {
    const subscription = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: 'MONTHLY',
    };
    mockPrisma.subscription.findFirst.mockResolvedValue(subscription);
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
      ...subscription,
      planId: newPlan.id,
      billingCycle: newPlan.billingCycle,
    });

    const result = await service.planChangeSucceeded(
      'sub-1',
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        actorType: AuditActorType.COMPANY_MEMBER,
      },
      'plan-change-key-1',
      newPlan,
    );

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1', status: SubscriptionStatus.ACTIVE },
        data: expect.objectContaining({
          planId: newPlan.id,
          billingCycle: newPlan.billingCycle,
          priceSnapshot: newPlan.priceSnapshot,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      }),
    );
    // status was already ACTIVE — this is renewInPlace(), not a transition()
    expect(
      mockTx.subscription.updateMany.mock.calls[0][0].data.status,
    ).toBeUndefined();
    expect(mockTx.subscriptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'PLAN_CHANGE_PAYMENT_SUCCEEDED',
        }),
      }),
    );
  });

  it('replays idempotently without a second write for the same idempotency key', async () => {
    const subscription = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: 'MONTHLY',
    };
    mockPrisma.subscription.findFirst.mockResolvedValue(subscription);
    mockTx.subscriptionEvent.findUnique.mockResolvedValue({ id: 'event-1' });
    mockTx.subscription.findUniqueOrThrow.mockResolvedValue(subscription);

    await service.planChangeSucceeded(
      'sub-1',
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
        actorType: AuditActorType.COMPANY_MEMBER,
      },
      'already-used-key',
      newPlan,
    );

    expect(mockTx.subscription.updateMany).not.toHaveBeenCalled();
  });
});

describe('SubscriptionLifecycleService.runDueTransitions', () => {
  let service: SubscriptionLifecycleService;

  const mockPrisma = {
    subscription: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
    jest.spyOn(service, 'transition').mockResolvedValue({} as any);
  });

  /**
   * Regression: runDueTransitions() used to move every TRIALING
   * subscription whose trialEndsAt had passed straight to ACTIVE, with no
   * check on which Plan it was on — so a trial that was never upgraded to
   * a paid Plan became a free ACTIVE subscription forever. It forks:
   * still on the isDefaultTrial Plan -> EXPIRED; already moved to a
   * different (paid) Plan during the trial -> ACTIVE.
   */
  it('moves a still-on-default-trial-Plan subscription to EXPIRED, not ACTIVE', async () => {
    const stillOnTrialPlan = {
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.TRIALING,
    };

    mockPrisma.subscription.findMany.mockImplementation(({ where }: any) => {
      if (where.plan?.isDefaultTrial === true) {
        return Promise.resolve([stillOnTrialPlan]);
      }
      return Promise.resolve([]);
    });

    const result = await service.runDueTransitions();

    expect(service.transition).toHaveBeenCalledWith(
      stillOnTrialPlan,
      SubscriptionStatus.EXPIRED,
      expect.any(Object),
      expect.objectContaining({
        reason: 'SCHEDULED_LIFECYCLE',
        source: 'SCHEDULER',
      }),
    );
    expect(result.trialsExpired).toBe(1);
    expect(result.trialsActivated).toBe(0);
  });

  it('still moves a subscription already upgraded off the default-trial Plan to ACTIVE (existing behavior, unchanged)', async () => {
    const upgradedToRealPlan = {
      id: 'sub-2',
      companyId: 'company-2',
      status: SubscriptionStatus.TRIALING,
    };

    mockPrisma.subscription.findMany.mockImplementation(({ where }: any) => {
      if (where.plan?.isDefaultTrial === false) {
        return Promise.resolve([upgradedToRealPlan]);
      }
      return Promise.resolve([]);
    });

    const result = await service.runDueTransitions();

    expect(service.transition).toHaveBeenCalledWith(
      upgradedToRealPlan,
      SubscriptionStatus.ACTIVE,
      expect.any(Object),
      expect.any(Object),
    );
    expect(result.trialsActivated).toBe(1);
    expect(result.trialsExpired).toBe(0);
  });

  /**
   * The direct ACTIVE → EXPIRED replacement for the removed
   * PAST_DUE/GRACE/SUSPENDED cascade — a period ending with no successful
   * renewal payment by then simply expires, regardless of autoRenew.
   */
  it('moves an ACTIVE subscription past its currentPeriodEnd straight to EXPIRED', async () => {
    const duePeriod = {
      id: 'sub-3',
      companyId: 'company-3',
      status: SubscriptionStatus.ACTIVE,
    };

    mockPrisma.subscription.findMany.mockImplementation(({ where }: any) => {
      if (where.status === SubscriptionStatus.ACTIVE) {
        return Promise.resolve([duePeriod]);
      }
      return Promise.resolve([]);
    });

    const result = await service.runDueTransitions();

    expect(service.transition).toHaveBeenCalledWith(
      duePeriod,
      SubscriptionStatus.EXPIRED,
      expect.any(Object),
      expect.objectContaining({
        reason: 'SCHEDULED_LIFECYCLE',
        source: 'SCHEDULER',
      }),
    );
    expect(result.activeExpired).toBe(1);
  });
});

describe('SubscriptionLifecycleService.checkExpiringSoon', () => {
  let service: SubscriptionLifecycleService;

  const mockNotifyTx = { notification: { findFirst: jest.fn() } };

  const mockPrisma = {
    subscription: { findMany: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockNotifyTx);
      return Promise.all(arg);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    mockNotifyTx.notification.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  it('notifies for a TRIALING subscription whose trialEndsAt falls within the lookahead window', async () => {
    const subscription = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.TRIALING,
      startsAt: new Date('2026-08-01T00:00:00Z'),
      trialEndsAt: new Date('2026-09-07T00:00:00Z'),
      currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-09-07T00:00:00Z'),
    };
    mockPrisma.subscription.findMany.mockResolvedValue([subscription]);

    const result = await service.checkExpiringSoon(
      new Date('2026-09-05T00:00:00Z'),
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockNotifyTx,
      { tenantId: 'tenant-1', companyId: 'company-1' },
      expect.objectContaining({
        type: NotificationType.SUBSCRIPTION_EXPIRING_SOON,
        relatedEntityType: NotificationRelatedEntityType.SUBSCRIPTION,
        relatedEntityId: 'sub-1',
        metadata: expect.objectContaining({
          status: SubscriptionStatus.TRIALING,
        }),
      }),
    );
    expect(result.notified).toBe(1);
  });

  it('notifies for an ACTIVE subscription whose currentPeriodEnd falls within the lookahead window', async () => {
    const subscription = {
      id: 'sub-2',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      startsAt: new Date('2026-08-01T00:00:00Z'),
      trialEndsAt: null,
      currentPeriodStart: new Date('2026-08-07T00:00:00Z'),
      currentPeriodEnd: new Date('2026-09-07T00:00:00Z'),
    };
    mockPrisma.subscription.findMany.mockResolvedValue([subscription]);

    const result = await service.checkExpiringSoon(
      new Date('2026-09-05T00:00:00Z'),
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockNotifyTx,
      { tenantId: 'tenant-1', companyId: 'company-1' },
      expect.objectContaining({
        type: NotificationType.SUBSCRIPTION_EXPIRING_SOON,
        relatedEntityId: 'sub-2',
        metadata: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      }),
    );
    expect(result.notified).toBe(1);
  });

  it('does not re-notify when a SUBSCRIPTION_EXPIRING_SOON notification already exists since the current period started (duplicate-prevention proof)', async () => {
    const subscription = {
      id: 'sub-3',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      startsAt: new Date('2026-08-01T00:00:00Z'),
      trialEndsAt: null,
      currentPeriodStart: new Date('2026-08-07T00:00:00Z'),
      currentPeriodEnd: new Date('2026-09-07T00:00:00Z'),
    };
    mockPrisma.subscription.findMany.mockResolvedValue([subscription]);
    mockNotifyTx.notification.findFirst.mockResolvedValue({
      id: 'existing-notification',
    });

    const result = await service.checkExpiringSoon(
      new Date('2026-09-05T00:00:00Z'),
    );

    expect(mockNotificationService.create).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });

  it('skips a candidate with no companyId', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-4',
        tenantId: 'tenant-1',
        companyId: null,
        status: SubscriptionStatus.ACTIVE,
        startsAt: new Date('2026-08-01T00:00:00Z'),
        trialEndsAt: null,
        currentPeriodStart: new Date('2026-08-07T00:00:00Z'),
        currentPeriodEnd: new Date('2026-09-07T00:00:00Z'),
      },
    ]);

    const result = await service.checkExpiringSoon(
      new Date('2026-09-05T00:00:00Z'),
    );

    expect(mockNotificationService.create).not.toHaveBeenCalled();
    expect(result.notified).toBe(0);
  });
});

describe('SubscriptionLifecycleService.voidStaleIssuedInvoices', () => {
  let service: SubscriptionLifecycleService;

  const mockPrisma = {
    invoice: { findMany: jest.fn() },
  };

  const mockInvoice = { void: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoice },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  it('queries only ISSUED invoices under an EXPIRED subscription, past the fixed 30-day cutoff', async () => {
    await service.voidStaleIssuedInvoices(new Date('2026-09-01T00:00:00Z'));

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ISSUED',
          issuedAt: { lte: new Date('2026-08-02T00:00:00Z') }, // 30 days back
          subscription: { status: SubscriptionStatus.EXPIRED },
        }),
      }),
    );
  });

  it('voids the stale invoice via the existing InvoiceService.void(), never reimplementing it', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'invoice-1' }]);

    const result = await service.voidStaleIssuedInvoices();

    expect(mockInvoice.void).toHaveBeenCalledWith('invoice-1');
    expect(result.invoicesVoided).toBe(1);
  });

  it('records a per-invoice failure and continues, never letting one bad row block the batch', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'invoice-1' },
      { id: 'invoice-2' },
    ]);
    mockInvoice.void
      .mockRejectedValueOnce(new Error('already voided'))
      .mockResolvedValueOnce({});

    const result = await service.voidStaleIssuedInvoices();

    expect(result.invoicesVoided).toBe(1);
    expect(result.failures).toEqual([
      { invoiceId: 'invoice-1', message: 'already voided' },
    ]);
  });
});
