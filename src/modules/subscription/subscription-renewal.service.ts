import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BillingCycle,
  BillingStatus,
  InvoiceStatus,
  SubscriptionStatus,
} from 'src/generated/phase-1-prisma/enums';
import { Prisma, Subscription } from 'src/generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { InvoiceService } from '../invoice/invoice.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionService } from './subscription.service';
import { PriceSnapshot } from './subscription.types';

type CheckoutIntent =
  | 'RENEWAL'
  | 'FIRST_SUBSCRIPTION'
  | 'PLAN_CHANGE'
  | 'MANUAL_PAYMENT';

interface PlanOverride {
  planId: string;
  billingCycle: BillingCycle;
  priceSnapshot: PriceSnapshot;
}

/**
 * Generates (or resumes generating) a Billing→Invoice(ISSUED) pair for a
 * Subscription, reusing the existing BillingService.create() /
 * InvoiceService.create() / .issue() unchanged — this is composition, not
 * a parallel reimplementation. Idempotent by design, inside one shared
 * transaction: if a prior call already created the Billing (or even the
 * Invoice) for this exact period — whether from a previous renewal
 * attempt or an Admin's own manual Billing/Invoice actions — this picks
 * up wherever it left off instead of throwing a duplicate-conflict or
 * creating a second one.
 */
@Injectable()
export class SubscriptionRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly invoiceService: InvoiceService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async renewSubscription(subscriptionId: string, actorUserId?: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Subscription cannot be renewed from ${subscription.status} state`,
      );
    }

    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = this.lifecycle.calculatePeriodEnd(
      periodStart,
      subscription.billingCycle,
    );

    return this.prisma.$transaction((tx) =>
      this.ensureBillingAndInvoice(
        tx,
        subscription,
        { start: periodStart, end: periodEnd, dueAt: periodStart },
        'RENEWAL',
        actorUserId,
      ),
    );
  }

  /**
   * Single entry point for "Company (or Platform Owner on its behalf)
   * wants to pay" — covers first paid subscription, resubscribing after
   * EXPIRED, renewing the current plan early, and Plan change, all
   * through the same Billing→Invoice generation this module already
   * proved out for renewal. Never backdates: the new Billing's period
   * always starts at request time (`now`), never at the subscription's
   * stale currentPeriodEnd — the authoritative Subscription period is
   * only ever written at actual payment settlement
   * (SubscriptionLifecycleService.paymentSucceeded()/planChangeSucceeded()),
   * which independently also always resets to the settlement moment.
   *
   * De-duplication: reuses an already-PENDING Billing for this
   * subscription with a matching intent/target (e.g. a double-click)
   * instead of creating a second one — see matchesIntent().
   */
  async requestSubscriptionCheckout(
    subscriptionId: string,
    options: { planId?: string; billingCycle?: BillingCycle } = {},
    actorUserId?: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException(
        'A cancelled subscription must be reactivated before checkout.',
      );
    }

    let planOverride: PlanOverride | undefined;
    let intent: CheckoutIntent;

    if (options.planId) {
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: subscription.companyId ?? undefined },
        select: { baseCurrencyCode: true },
      });
      const billingCycle = options.billingCycle ?? subscription.billingCycle;
      const plan = await this.subscriptionService.getPlan(options.planId);
      const price = await this.subscriptionService.getPrice(
        plan.id,
        billingCycle,
        company.baseCurrencyCode,
      );
      planOverride = {
        planId: plan.id,
        billingCycle,
        priceSnapshot: {
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          billingCycle,
          currencyCode: price.currencyCode,
          amount: price.amount.toString(),
          capturedAt: new Date().toISOString(),
        },
      };
      intent = 'PLAN_CHANGE';
    } else {
      intent =
        subscription.status === SubscriptionStatus.TRIALING ||
        subscription.status === SubscriptionStatus.EXPIRED
          ? 'FIRST_SUBSCRIPTION'
          : 'RENEWAL';
    }

    return this.prisma.$transaction(async (tx) => {
      const existingBilling = await tx.billing.findFirst({
        where: { subscriptionId: subscription.id, status: BillingStatus.PENDING },
        include: { invoice: true },
        orderBy: { createdAt: 'desc' },
      });

      if (existingBilling && this.matchesIntent(existingBilling, intent, planOverride)) {
        let invoice = existingBilling.invoice;
        if (!invoice) {
          invoice = await this.invoiceService.create(
            { billingId: existingBilling.id },
            actorUserId,
            tx,
          );
        }
        if (invoice.status === InvoiceStatus.DRAFT) {
          invoice = await this.invoiceService.issue(invoice.id, actorUserId, tx);
        }
        return { billing: existingBilling, invoice };
      }

      const now = new Date();
      const cycle = planOverride?.billingCycle ?? subscription.billingCycle;
      const periodEnd = this.lifecycle.calculatePeriodEnd(now, cycle);

      return this.ensureBillingAndInvoice(
        tx,
        subscription,
        { start: now, end: periodEnd, dueAt: now },
        intent,
        actorUserId,
        planOverride,
      );
    });
  }

  /**
   * Shared row-creation core — "create Billing if missing, create+issue
   * Invoice if missing, no-op if already issued". `intent` (and, for a
   * Plan change, the target plan) is stamped into Billing.metadata so
   * BillingService.markSucceeded() knows which SubscriptionLifecycleService
   * method to call on settlement.
   */
  private async ensureBillingAndInvoice(
    tx: Prisma.TransactionClient,
    subscription: Subscription,
    period: { start: Date; end: Date; dueAt: Date },
    intent: CheckoutIntent,
    actorUserId?: string,
    planOverride?: PlanOverride,
  ) {
    let billing = await tx.billing.findUnique({
      where: {
        subscriptionId_periodStart_periodEnd: {
          subscriptionId: subscription.id,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
      include: { invoice: true },
    });

    if (!billing) {
      const created = await this.billingService.create(
        {
          subscriptionId: subscription.id,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          dueAt: period.dueAt.toISOString(),
        },
        actorUserId,
        tx,
        {
          priceSnapshot: planOverride
            ? (planOverride.priceSnapshot as unknown as Record<string, unknown>)
            : undefined,
          billingCycle: planOverride?.billingCycle,
          metadata:
            intent === 'PLAN_CHANGE' && planOverride
              ? {
                  intent,
                  targetPlanId: planOverride.planId,
                  targetBillingCycle: planOverride.billingCycle,
                  targetPriceSnapshot: planOverride.priceSnapshot,
                }
              : { intent },
        },
      );
      billing = { ...created, invoice: null };
    }

    let invoice = billing.invoice;

    if (!invoice) {
      invoice = await this.invoiceService.create(
        { billingId: billing.id },
        actorUserId,
        tx,
      );
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      invoice = await this.invoiceService.issue(invoice.id, actorUserId, tx);
    }

    return { billing, invoice };
  }

  private matchesIntent(
    billing: { metadata: Prisma.JsonValue | null },
    intent: CheckoutIntent,
    planOverride?: PlanOverride,
  ): boolean {
    const metadata = (billing.metadata as Record<string, unknown> | null) ?? {};
    if (metadata.intent !== intent) return false;
    if (intent === 'PLAN_CHANGE') {
      return (
        metadata.targetPlanId === planOverride?.planId &&
        metadata.targetBillingCycle === planOverride?.billingCycle
      );
    }
    return true;
  }
}
