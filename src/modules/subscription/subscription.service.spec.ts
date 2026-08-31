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

describe('SubscriptionService.createTrialForNewCompany', () => {
  let service: SubscriptionService;

  const mockTx = {
    plan: { findFirst: jest.fn() },
    planPrice: { findFirst: jest.fn() },
    subscription: { create: jest.fn() },
    subscriptionEvent: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {};

  const mockLifecycle = {
    calculatePeriodEnd: jest.fn((start: Date) => start),
  };

  const company = {
    id: 'company-1',
    tenantId: 'tenant-1',
    baseCurrencyCode: 'BDT',
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
  });

  it('throws when no Plan is marked isDefaultTrial (loud failure, per confirmed decision)', async () => {
    mockTx.plan.findFirst.mockResolvedValue(null);

    await expect(
      service.createTrialForNewCompany(company, 'user-1', mockTx as any),
    ).rejects.toThrow(NotFoundException);

    expect(mockTx.subscription.create).not.toHaveBeenCalled();
  });

  it('throws when the default-trial Plan has no active MONTHLY price in the company currency', async () => {
    mockTx.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter',
      trialDays: 14,
    });
    mockTx.planPrice.findFirst.mockResolvedValue(null);

    await expect(
      service.createTrialForNewCompany(company, 'user-1', mockTx as any),
    ).rejects.toThrow(NotFoundException);

    expect(mockTx.subscription.create).not.toHaveBeenCalled();
  });

  it('creates a TRIALING subscription from the default-trial Plan, not isComplimentary by default', async () => {
    mockTx.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      code: 'STARTER',
      name: 'Starter',
      trialDays: 14,
    });
    mockTx.planPrice.findFirst.mockResolvedValue({
      currencyCode: 'BDT',
      amount: new Prisma.Decimal('999.0000'),
      billingCycle: BillingCycle.MONTHLY,
    });
    mockTx.subscription.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'sub-1', ...data }),
    );

    const result = await service.createTrialForNewCompany(
      company,
      'user-1',
      mockTx as any,
    );

    expect(mockTx.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isDefaultTrial: true, status: 'ACTIVE' },
      }),
    );
    expect(mockTx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
          status: SubscriptionStatus.TRIALING,
          billingCycle: BillingCycle.MONTHLY,
          isComplimentary: false,
        }),
      }),
    );
    expect(mockTx.subscriptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'AUTO_TRIAL_ON_COMPANY_CREATE',
        }),
      }),
    );
    expect(result.status).toBe(SubscriptionStatus.TRIALING);
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
