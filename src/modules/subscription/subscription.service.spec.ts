import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  AuditActorType,
  BillingCycle,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';
import { Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService.create', () => {
  let service: SubscriptionService;

  const mockTx = {
    subscription: { create: jest.fn() },
    subscriptionEvent: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    company: { findUnique: jest.fn() },
    companyMember: { findFirst: jest.fn() },
    plan: { findFirst: jest.fn() },
    planPrice: { findFirst: jest.fn() },
    subscription: { findFirst: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const mockLifecycle = {
    calculatePeriodEnd: jest.fn((start: Date) => start),
  };

  const company = {
    id: 'company-1',
    tenantId: 'tenant-1',
    baseCurrencyCode: 'BDT',
  };

  const context = {
    userId: 'admin-1',
    companyId: 'company-1',
    roles: ['SUPER_ADMIN'],
  };

  const dto = {
    companyId: 'company-1',
    planId: 'plan-1',
    billingCycle: BillingCycle.MONTHLY,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionLifecycleService, useValue: mockLifecycle },
      ],
    }).compile();

    service = module.get(SubscriptionService);

    mockPrisma.company.findUnique.mockResolvedValue(company);
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockTx.subscription.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'sub-1', ...data }),
    );
  });

  /**
   * Regression: this is now the ONLY way a Company ever gets a
   * Subscription — Company creation itself never creates one any more
   * (CompanyManagementService.create() no longer calls into
   * SubscriptionService at all). This is the explicit Super Admin
   * "Start Trial" action.
   */
  it('creates a TRIALING subscription when the chosen Plan has real trial days ("Start Trial")', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter',
      trialDays: 14,
    });
    mockPrisma.planPrice.findFirst.mockResolvedValue({
      currencyCode: 'BDT',
      amount: new Prisma.Decimal('999.0000'),
      billingCycle: BillingCycle.MONTHLY,
    });

    const result = await service.create(dto, context);

    expect(mockTx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
          status: SubscriptionStatus.TRIALING,
          isComplimentary: false,
        }),
      }),
    );
    expect(result.status).toBe(SubscriptionStatus.TRIALING);
  });

  /**
   * Regression: a plan with no trial days (a genuine paid plan, the
   * "Select Paid Plan" action) must NOT activate immediately — no payment
   * has happened yet. It's created EXPIRED, which
   * SubscriptionStatusGuard already blocks and which
   * SubscriptionRenewalService.requestSubscriptionCheckout() already
   * treats as a valid first-subscription checkout target — the exact
   * same EXPIRED→ACTIVE recovery path used for resubscribing activates
   * it once payment succeeds. Never ACTIVE before payment.
   */
  it('creates an EXPIRED (pending-payment) subscription when the chosen Plan has no trial days ("Select Paid Plan")', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      code: 'PRO',
      name: 'Pro',
      trialDays: 0,
    });
    mockPrisma.planPrice.findFirst.mockResolvedValue({
      currencyCode: 'BDT',
      amount: new Prisma.Decimal('1999.0000'),
      billingCycle: BillingCycle.MONTHLY,
    });

    const result = await service.create(dto, context);

    expect(mockTx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubscriptionStatus.EXPIRED,
          trialEndsAt: null,
          isComplimentary: false,
        }),
      }),
    );
    expect(result.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('rejects when the Company already has an open (non-terminal) subscription', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      code: 'PRO',
      name: 'Pro',
      trialDays: 0,
    });
    mockPrisma.planPrice.findFirst.mockResolvedValue({
      currencyCode: 'BDT',
      amount: new Prisma.Decimal('1999.0000'),
      billingCycle: BillingCycle.MONTHLY,
    });
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'existing-sub' });

    await expect(service.create(dto, context)).rejects.toThrow(
      'Company already has an open subscription lifecycle.',
    );
    expect(mockTx.subscription.create).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.updateAutoRenewForPlatform', () => {
  let service: SubscriptionService;

  const mockTx = {
    subscription: { update: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    subscription: { findUnique: jest.fn() },
    $transaction: jest.fn((run: (tx: unknown) => unknown) => run(mockTx)),
  };

  const mockLifecycle = {};

  const context = {
    userId: 'platform-user-1',
    roles: ['SUPER_ADMIN'],
    actorType: AuditActorType.PLATFORM_MEMBER,
  };

  const activeSubscription = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    status: SubscriptionStatus.ACTIVE,
    autoRenew: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.subscription.findUnique.mockResolvedValue(activeSubscription);
    mockTx.subscription.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...activeSubscription, ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionLifecycleService, useValue: mockLifecycle },
      ],
    }).compile();

    service = module.get(SubscriptionService);
  });

  it('throws NotFoundException when the subscription does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(
      service.updateAutoRenewForPlatform(
        'missing-id',
        { autoRenew: false },
        context as any,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockTx.subscription.update).not.toHaveBeenCalled();
  });

  it.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED])(
    'rejects when the subscription is %s',
    async (status) => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...activeSubscription,
        status,
      });

      await expect(
        service.updateAutoRenewForPlatform(
          'sub-1',
          { autoRenew: false },
          context as any,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.subscription.update).not.toHaveBeenCalled();
    },
  );

  it('updates autoRenew and writes a PLATFORM_MEMBER-attributed AuditLog entry', async () => {
    const result = await service.updateAutoRenewForPlatform(
      'sub-1',
      { autoRenew: false },
      context,
    );

    expect(mockTx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { autoRenew: false },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
          actorUserId: 'platform-user-1',
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'SUBSCRIPTION_AUTO_RENEW_UPDATED',
          entityType: 'Subscription',
          entityId: 'sub-1',
          beforeData: { autoRenew: true },
          afterData: { autoRenew: false },
        }),
      }),
    );
    expect(result.autoRenew).toBe(false);
  });
});
