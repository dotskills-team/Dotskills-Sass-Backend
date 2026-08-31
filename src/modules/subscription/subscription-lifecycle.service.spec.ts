import { Test, TestingModule } from '@nestjs/testing';

import {
  AuditActorType,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

const mockInvoiceService = { void: jest.fn() };

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
        { provide: InvoiceService, useValue: mockInvoiceService },
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

describe('SubscriptionLifecycleService.paymentSucceeded', () => {
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
    mockPrisma.subscriptionEvent.findUnique.mockResolvedValue(null);
    mockTx.subscriptionEvent.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceService, useValue: mockInvoiceService },
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
  });

  /**
   * Regression: a fresh subscription's very first successful payment used to
   * hit the "Payment recovery is allowed only for PAST_DUE, GRACE or
   * SUSPENDED subscriptions." throw, because ACTIVE/TRIALING were never
   * handled — and since this runs inside BillingService.markSucceeded()'s
   * transaction, the whole settlement (Payment→SUCCEEDED, Billing→SUCCEEDED,
   * Invoice→PAID) rolled back even though the gateway genuinely confirmed
   * payment. Now it renews in place instead of throwing.
   */
  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])(
    'renews in place (no throw, status unchanged) when payment succeeds while already %s',
    async (status) => {
      const subscription = subscriptionWith(status);
      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockTx.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockTx.subscription.findUniqueOrThrow.mockResolvedValue({
        ...subscription,
        status,
        currentPeriodEnd: new Date('2027-01-01'),
      });

      const result = await service.paymentSucceeded('sub-1', context, 'key-1');

      expect(result.status).toBe(status);
      expect(mockTx.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1', status },
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
            fromStatus: status,
            toStatus: status,
            reason: 'PAYMENT_SUCCEEDED',
          }),
        }),
      );
    },
  );

  it.each([
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.GRACE,
    SubscriptionStatus.SUSPENDED,
  ])(
    'recovers %s → ACTIVE on successful payment (existing behavior, unchanged)',
    async (status) => {
      const subscription = subscriptionWith(status);
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
          where: { id: 'sub-1', status },
          data: expect.objectContaining({ status: SubscriptionStatus.ACTIVE }),
        }),
      );
    },
  );

  it.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED])(
    'still rejects payment success while %s (not recoverable, not renewable)',
    async (status) => {
      const subscription = subscriptionWith(status);
      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      await expect(
        service.paymentSucceeded('sub-1', context, 'key-3'),
      ).rejects.toThrow(
        'Payment recovery is allowed only for PAST_DUE, GRACE or SUSPENDED subscriptions.',
      );
      expect(mockTx.subscription.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('SubscriptionLifecycleService.runDueTransitions — TRIALING fork', () => {
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
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
    jest.spyOn(service, 'transition').mockResolvedValue({} as any);
  });

  /**
   * Regression: runDueTransitions() used to move every TRIALING
   * subscription whose trialEndsAt had passed straight to ACTIVE, with no
   * check on which Plan it was on — so a trial that was never upgraded to
   * a paid Plan became a free ACTIVE subscription forever. Now it forks:
   * still on the isDefaultTrial Plan -> EXPIRED; already moved to a
   * different (paid) Plan during the trial -> today's existing ACTIVE
   * behavior, unchanged.
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
      ],
    }).compile();

    service = module.get(SubscriptionLifecycleService);
    jest.spyOn(service, 'transition').mockResolvedValue({} as any);
  });

  it('queries only ISSUED invoices under a struggling subscription, past the fixed 30-day cutoff', async () => {
    await service.voidStaleIssuedInvoices(new Date('2026-09-01T00:00:00Z'));

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ISSUED',
          issuedAt: { lte: new Date('2026-08-02T00:00:00Z') }, // 30 days back
          subscription: {
            status: { in: ['PAST_DUE', 'GRACE', 'SUSPENDED'] },
          },
        }),
      }),
    );
  });

  it('voids the stale invoice via the existing InvoiceService.void(), never reimplementing it', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        subscription: {
          id: 'sub-1',
          tenantId: 'tenant-1',
          companyId: 'company-1',
          status: SubscriptionStatus.PAST_DUE,
        },
      },
    ]);

    const result = await service.voidStaleIssuedInvoices();

    expect(mockInvoice.void).toHaveBeenCalledWith('invoice-1');
    expect(result.invoicesVoided).toBe(1);
    expect(service.transition).not.toHaveBeenCalled();
    expect(result.subscriptionsExpired).toBe(0);
  });

  /**
   * Confirmed decision: if the subscription is still SUSPENDED at the
   * exact moment its stale invoice voids, it moves straight to EXPIRED —
   * it never waits out its own independent suspension timer, since there
   * is no longer any payable invoice keeping it alive either way.
   */
  it('also expires the subscription immediately when it is still SUSPENDED at void time', async () => {
    const subscription = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      status: SubscriptionStatus.SUSPENDED,
    };
    mockPrisma.invoice.findMany.mockResolvedValue([
      { id: 'invoice-1', subscription },
    ]);

    const result = await service.voidStaleIssuedInvoices();

    expect(mockInvoice.void).toHaveBeenCalledWith('invoice-1');
    expect(service.transition).toHaveBeenCalledWith(
      subscription,
      SubscriptionStatus.EXPIRED,
      expect.objectContaining({ actorType: AuditActorType.SYSTEM }),
      expect.objectContaining({ reason: 'STALE_ISSUED_INVOICE_VOIDED' }),
    );
    expect(result.subscriptionsExpired).toBe(1);
  });

  it('does not expire the subscription when it is only PAST_DUE or GRACE (not SUSPENDED) at void time', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        subscription: {
          id: 'sub-1',
          tenantId: 'tenant-1',
          companyId: 'company-1',
          status: SubscriptionStatus.GRACE,
        },
      },
    ]);

    const result = await service.voidStaleIssuedInvoices();

    expect(service.transition).not.toHaveBeenCalled();
    expect(result.subscriptionsExpired).toBe(0);
  });

  it('records a per-invoice failure and continues, never letting one bad row block the batch', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        subscription: {
          id: 'sub-1',
          tenantId: 't',
          companyId: 'c',
          status: SubscriptionStatus.GRACE,
        },
      },
      {
        id: 'invoice-2',
        subscription: {
          id: 'sub-2',
          tenantId: 't',
          companyId: 'c',
          status: SubscriptionStatus.GRACE,
        },
      },
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
