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
    billing: { findUnique: jest.fn() },
  };

  const mockPrisma = {
    subscription: { findUnique: jest.fn() },
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
