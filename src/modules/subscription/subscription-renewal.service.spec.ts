import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  BillingCycle,
  InvoiceStatus,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { InvoiceService } from '../invoice/invoice.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionRenewalService.renewSubscription', () => {
  let service: SubscriptionRenewalService;

  const mockTx = {
    billing: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  const mockPrisma = {
    subscription: { findUnique: jest.fn() },
    company: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const mockBillingService = { create: jest.fn() };
  const mockInvoiceService = { create: jest.fn(), issue: jest.fn() };
  const mockLifecycle = {
    calculatePeriodEnd: jest.fn(
      (start: Date) => new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
    ),
  };
  const mockSubscriptionService = { getPlan: jest.fn(), getPrice: jest.fn() };

  const subscription = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodEnd: new Date('2026-09-28T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRenewalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingService, useValue: mockBillingService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: SubscriptionLifecycleService, useValue: mockLifecycle },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
      ],
    }).compile();

    service = module.get(SubscriptionRenewalService);
  });

  it('throws when the subscription does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.renewSubscription('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED])(
    'rejects renewing a %s subscription',
    async (status) => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...subscription,
        status,
      });

      await expect(service.renewSubscription('sub-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockBillingService.create).not.toHaveBeenCalled();
    },
  );

  it('creates a fresh Billing + Invoice(ISSUED) when nothing exists yet for the period', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.billing.findUnique.mockResolvedValue(null);
    mockBillingService.create.mockResolvedValue({
      id: 'billing-1',
      periodStart: subscription.currentPeriodEnd,
    });
    mockInvoiceService.create.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.DRAFT,
    });
    mockInvoiceService.issue.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.ISSUED,
    });

    const result = await service.renewSubscription('sub-1', 'admin-1');

    expect(mockBillingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
      'admin-1',
      mockTx,
      expect.objectContaining({ metadata: { intent: 'RENEWAL' } }),
    );
    expect(mockInvoiceService.create).toHaveBeenCalledWith(
      { billingId: 'billing-1' },
      'admin-1',
      mockTx,
    );
    expect(mockInvoiceService.issue).toHaveBeenCalledWith(
      'invoice-1',
      'admin-1',
      mockTx,
    );
    expect(result.invoice.status).toBe(InvoiceStatus.ISSUED);
  });

  /**
   * Core idempotency requirement: a Billing already existing for this exact
   * period (from a prior renewal attempt, or an Admin's own manual action)
   * must never trigger a duplicate — and never even call billingService.create().
   */
  it('reuses an existing Billing for the period instead of creating a duplicate', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.billing.findUnique.mockResolvedValue({
      id: 'billing-existing',
      invoice: null,
    });
    mockInvoiceService.create.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.DRAFT,
    });
    mockInvoiceService.issue.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.ISSUED,
    });

    await service.renewSubscription('sub-1');

    expect(mockBillingService.create).not.toHaveBeenCalled();
    expect(mockInvoiceService.create).toHaveBeenCalledWith(
      { billingId: 'billing-existing' },
      undefined,
      mockTx,
    );
  });

  it('reuses an existing DRAFT Invoice and just issues it, never creating a second one', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.billing.findUnique.mockResolvedValue({
      id: 'billing-existing',
      invoice: { id: 'invoice-existing', status: InvoiceStatus.DRAFT },
    });
    mockInvoiceService.issue.mockResolvedValue({
      id: 'invoice-existing',
      status: InvoiceStatus.ISSUED,
    });

    await service.renewSubscription('sub-1');

    expect(mockInvoiceService.create).not.toHaveBeenCalled();
    expect(mockInvoiceService.issue).toHaveBeenCalledWith(
      'invoice-existing',
      undefined,
      mockTx,
    );
  });

  it('is a full no-op (no writes at all) when the Invoice is already ISSUED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
    mockTx.billing.findUnique.mockResolvedValue({
      id: 'billing-existing',
      invoice: { id: 'invoice-existing', status: InvoiceStatus.ISSUED },
    });

    const result = await service.renewSubscription('sub-1');

    expect(mockBillingService.create).not.toHaveBeenCalled();
    expect(mockInvoiceService.create).not.toHaveBeenCalled();
    expect(mockInvoiceService.issue).not.toHaveBeenCalled();
    expect(result.invoice.status).toBe(InvoiceStatus.ISSUED);
  });
});

describe('SubscriptionRenewalService.requestSubscriptionCheckout', () => {
  let service: SubscriptionRenewalService;

  const mockTx = {
    billing: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  const mockPrisma = {
    subscription: { findUnique: jest.fn() },
    company: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
  };

  const mockBillingService = { create: jest.fn() };
  const mockInvoiceService = { create: jest.fn(), issue: jest.fn() };
  const mockLifecycle = {
    calculatePeriodEnd: jest.fn(
      (start: Date) => new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
    ),
  };
  const mockSubscriptionService = { getPlan: jest.fn(), getPrice: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRenewalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingService, useValue: mockBillingService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: SubscriptionLifecycleService, useValue: mockLifecycle },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
      ],
    }).compile();

    service = module.get(SubscriptionRenewalService);

    mockTx.billing.findFirst.mockResolvedValue(null);
    mockBillingService.create.mockResolvedValue({ id: 'billing-1' });
    mockInvoiceService.create.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.DRAFT,
    });
    mockInvoiceService.issue.mockResolvedValue({
      id: 'invoice-1',
      status: InvoiceStatus.ISSUED,
    });
  });

  it('throws when the subscription does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(
      service.requestSubscriptionCheckout('missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects checkout for a CANCELLED subscription (must reactivate first)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.CANCELLED,
      billingCycle: BillingCycle.MONTHLY,
    });

    await expect(service.requestSubscriptionCheckout('sub-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockBillingService.create).not.toHaveBeenCalled();
  });

  it('tags a TRIALING subscription checking out (no plan override) as FIRST_SUBSCRIPTION', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.TRIALING,
      billingCycle: BillingCycle.MONTHLY,
    });

    await service.requestSubscriptionCheckout('sub-1', {}, 'user-1');

    expect(mockBillingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
      'user-1',
      mockTx,
      expect.objectContaining({ metadata: { intent: 'FIRST_SUBSCRIPTION' } }),
    );
  });

  it('tags an EXPIRED subscription resubscribing (no plan override) as FIRST_SUBSCRIPTION', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.EXPIRED,
      billingCycle: BillingCycle.MONTHLY,
    });

    await service.requestSubscriptionCheckout('sub-1');

    expect(mockBillingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
      undefined,
      mockTx,
      expect.objectContaining({ metadata: { intent: 'FIRST_SUBSCRIPTION' } }),
    );
  });

  it('tags an ACTIVE subscription checking out (no plan override) as RENEWAL', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
    });

    await service.requestSubscriptionCheckout('sub-1');

    expect(mockBillingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
      undefined,
      mockTx,
      expect.objectContaining({ metadata: { intent: 'RENEWAL' } }),
    );
  });

  /**
   * Never backdates: the new Billing's period always starts "now", never the
   * subscription's stale currentPeriodEnd — this is the structural mechanism
   * the plan relies on for the no-backdating rule (see planChangeSucceeded()/
   * paymentSucceeded() which only ever reset the authoritative period at
   * actual settlement time, always from "now" at that moment).
   */
  it('never uses the stale currentPeriodEnd as the new Billing period start', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.EXPIRED,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodEnd: new Date('2020-01-01T00:00:00Z'),
    });

    const before = Date.now();
    await service.requestSubscriptionCheckout('sub-1');

    const createArgs = mockBillingService.create.mock.calls[0][0];
    expect(new Date(createArgs.periodStart).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  it('resolves the target plan/price and stashes it in Billing.metadata when planId is given', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
    });
    mockPrisma.company.findUniqueOrThrow.mockResolvedValue({
      baseCurrencyCode: 'BDT',
    });
    mockSubscriptionService.getPlan.mockResolvedValue({
      id: 'plan-2',
      code: 'PRO',
      name: 'Pro',
    });
    mockSubscriptionService.getPrice.mockResolvedValue({
      currencyCode: 'BDT',
      amount: { toString: () => '999.0000' },
    });

    await service.requestSubscriptionCheckout(
      'sub-1',
      { planId: 'plan-2', billingCycle: BillingCycle.YEARLY },
      'user-1',
    );

    expect(mockSubscriptionService.getPlan).toHaveBeenCalledWith('plan-2');
    expect(mockSubscriptionService.getPrice).toHaveBeenCalledWith(
      'plan-2',
      BillingCycle.YEARLY,
      'BDT',
    );
    expect(mockBillingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-1' }),
      'user-1',
      mockTx,
      expect.objectContaining({
        billingCycle: BillingCycle.YEARLY,
        metadata: expect.objectContaining({
          intent: 'PLAN_CHANGE',
          targetPlanId: 'plan-2',
          targetBillingCycle: BillingCycle.YEARLY,
        }),
      }),
    );
  });

  /**
   * Double-click / retry protection for the checkout path specifically:
   * unlike renewal, the period is `[now, ...]` on every call and so isn't
   * naturally stable across attempts — matchesIntent() must reuse an
   * already-PENDING Billing for the same subscription+intent instead of
   * creating a second one.
   */
  it('reuses an existing PENDING Billing matching the same intent instead of creating a duplicate', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.EXPIRED,
      billingCycle: BillingCycle.MONTHLY,
    });
    mockTx.billing.findFirst.mockResolvedValue({
      id: 'billing-existing',
      metadata: { intent: 'FIRST_SUBSCRIPTION' },
      invoice: null,
    });

    const result = await service.requestSubscriptionCheckout('sub-1');

    expect(mockBillingService.create).not.toHaveBeenCalled();
    expect(mockInvoiceService.create).toHaveBeenCalledWith(
      { billingId: 'billing-existing' },
      undefined,
      mockTx,
    );
    expect(result.billing.id).toBe('billing-existing');
  });

  it('does not reuse an existing PENDING Billing whose intent/target does not match', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      companyId: 'company-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
    });
    mockPrisma.company.findUniqueOrThrow.mockResolvedValue({
      baseCurrencyCode: 'BDT',
    });
    mockSubscriptionService.getPlan.mockResolvedValue({
      id: 'plan-2',
      code: 'PRO',
      name: 'Pro',
    });
    mockSubscriptionService.getPrice.mockResolvedValue({
      currencyCode: 'BDT',
      amount: { toString: () => '999.0000' },
    });
    mockTx.billing.findFirst.mockResolvedValue({
      id: 'billing-existing',
      metadata: { intent: 'RENEWAL' },
      invoice: null,
    });

    await service.requestSubscriptionCheckout(
      'sub-1',
      { planId: 'plan-2' },
      'user-1',
    );

    expect(mockBillingService.create).toHaveBeenCalled();
  });
});
