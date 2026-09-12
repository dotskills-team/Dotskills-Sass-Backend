import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

import {
  AuditActorType,
  BillingCycle,
  CompanyStatus,
  InvoiceStatus,
  SubscriptionStatus,
  NotificationType,
  NotificationRelatedEntityType,
} from 'src/generated/phase-1-prisma/enums';
import { InvoiceService } from '../invoice/invoice.service';
import { NotificationService } from '../notification/notification.service';

import {
  LifecycleRunResult,
  PlatformSubscriptionContext,
  SubscriptionContext,
  SystemSubscriptionContext,
  TransitionOptions,
} from './subscription.types';
import { Prisma, Subscription } from 'src/generated/phase-1-prisma/client';

import {
  ALLOWED_SUBSCRIPTION_TRANSITIONS,
  SUBSCRIPTION_CONSTANTS,
} from './subscription.constants';

// type ActorContext = SubscriptionContext | SystemSubscriptionContext;
type ActorContext =
  SubscriptionContext | SystemSubscriptionContext | PlatformSubscriptionContext;

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly notificationService: NotificationService,
  ) {}

  async paymentSucceeded(
    id: string,
    context: ActorContext,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
  ) {
    // Scope validation must happen before returning an idempotent replay.
    const subscription = await this.getScoped(id, context);

    const replay = await this.findIdempotentResult(id, idempotencyKey);
    if (replay) return replay;

    /**
     * ACTIVE subscription-এর normal billing cycle payment সফল হওয়া কোনো
     * "recovery" transition না — এটাই একটা fresh subscription-এর সবচেয়ে
     * সাধারণ, প্রথম successful-payment case। renewInPlace()
     * ইচ্ছাকৃতভাবে transition()/ALLOWED_SUBSCRIPTION_TRANSITIONS ব্যবহার
     * করে না (ACTIVE→ACTIVE কোনো status-এর নিজের allowed-list-এ নেই, আর
     * সেই shared map পরিবর্তন করলে transition()-এর অন্য সব caller-ও
     * প্রভাবিত হতো) — শুধু billing period refresh করে, status
     * অপরিবর্তিত রাখে, একই audit/event shape বজায় রেখে।
     */
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return this.renewInPlace(subscription, context, idempotencyKey, tx);
    }

    /**
     * TRIALING subscription-এ payment সফল হলে (trial শেষ হওয়ার আগেই
     * company pay করে ফেলেছে) — renewInPlace() ব্যবহার করা যাবে না,
     * কারণ সেটা status অপরিবর্তিত রাখে (TRIALING-ই থেকে যাবে)। এখানে
     * সত্যিকারের transition() লাগবে: ACTIVE-এ যাওয়া + trialEndsAt
     * clear করা, ঠিক নিচের EXPIRED-recovery path-এর মতোই non-backdated
     * period reset সহ।
     */
    const recoverableStatuses: readonly SubscriptionStatus[] = [
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.EXPIRED,
    ];

    if (!recoverableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        'Payment can only activate a TRIALING or EXPIRED subscription (or renew an already-ACTIVE one).',
      );
    }
    const now = new Date();
    return this.transition(
      subscription,
      SubscriptionStatus.ACTIVE,
      context,
      {
        reason: 'PAYMENT_SUCCEEDED',
        source: 'PAYMENT',
        idempotencyKey,
        patch: {
          currentPeriodStart: now,
          currentPeriodEnd: this.calculatePeriodEnd(
            now,
            subscription.billingCycle,
          ),
          trialEndsAt: null,
          cancelledAt: null,
        },
      },
      tx,
    );
  }

  /**
   * Mirrors paymentSucceeded()'s own ACTIVE-vs-TRIALING/EXPIRED split (see
   * its comments) — plan change requires the exact same branching, since
   * "already ACTIVE, paying to switch plans" is the most common case and
   * ACTIVE→ACTIVE is not a valid transition() target. Either way the new
   * plan/cycle/price and the period reset are applied together, atomically,
   * so a subscription is never left ACTIVE on a half-applied plan.
   */
  async planChangeSucceeded(
    id: string,
    context: ActorContext,
    idempotencyKey: string,
    newPlan: {
      id: string;
      billingCycle: BillingCycle;
      priceSnapshot: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const subscription = await this.getScoped(id, context);

    const replay = await this.findIdempotentResult(id, idempotencyKey);
    if (replay) return replay;

    const planPatch = {
      planId: newPlan.id,
      billingCycle: newPlan.billingCycle,
      priceSnapshot: newPlan.priceSnapshot,
    };

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return this.renewInPlace(
        subscription,
        context,
        idempotencyKey,
        tx,
        'PLAN_CHANGE_PAYMENT_SUCCEEDED',
        planPatch,
      );
    }

    const now = new Date();
    return this.transition(
      subscription,
      SubscriptionStatus.ACTIVE,
      context,
      {
        reason: 'PLAN_CHANGE_PAYMENT_SUCCEEDED',
        source: 'PAYMENT',
        idempotencyKey,
        patch: {
          ...planPatch,
          currentPeriodStart: now,
          currentPeriodEnd: this.calculatePeriodEnd(now, newPlan.billingCycle),
          trialEndsAt: null,
          cancelledAt: null,
        },
      },
      tx,
    );
  }

  /**
   * Status-unchanged period refresh — deliberately bypasses transition()/
   * ALLOWED_SUBSCRIPTION_TRANSITIONS entirely (ACTIVE→ACTIVE isn't, and was
   * never meant to be, a valid entry in that map). `extraPatch` lets
   * planChangeSucceeded() reuse this exact same in-place path for an
   * already-ACTIVE subscription paying to change plans — same period
   * reset, plus the plan/cycle/price swap applied in the same update.
   */
  private async renewInPlace(
    subscription: Subscription,
    context: ActorContext,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
    reason: string = 'PAYMENT_SUCCEEDED',
    extraPatch: Record<string, unknown> = {},
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const prior = await tx.subscriptionEvent.findUnique({
        where: { idempotencyKey },
      });
      if (prior) {
        return tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
        });
      }

      const now = new Date();

      const changed = await tx.subscription.updateMany({
        where: { id: subscription.id, status: subscription.status },
        data: {
          currentPeriodStart: now,
          currentPeriodEnd: this.calculatePeriodEnd(
            now,
            (extraPatch.billingCycle as BillingCycle) ??
              subscription.billingCycle,
          ),
          graceEndsAt: null,
          pastDueEndsAt: null,
          suspendedAt: null,
          suspensionExpiresAt: null,
          cancelledAt: null,
          ...extraPatch,
        },
      });
      if (changed.count !== 1) {
        throw new BadRequestException(
          'Subscription changed concurrently; retry the operation.',
        );
      }

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          companyId: subscription.companyId,
          fromStatus: subscription.status,
          toStatus: subscription.status,
          reason,
          source: 'PAYMENT',
          actorUserId: 'userId' in context ? context.userId : null,
          idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: subscription.tenantId,
          companyId: subscription.companyId,
          actorUserId: 'userId' in context ? context.userId : null,
          actorType: context.actorType ?? AuditActorType.COMPANY_MEMBER,
          action: `SUBSCRIPTION_${subscription.status}`,
          entityType: 'Subscription',
          entityId: subscription.id,
          beforeData: { status: subscription.status },
          afterData: {
            status: subscription.status,
            reason,
          },
        },
      });

      return tx.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
      });
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  /**
   * A failed payment attempt no longer degrades subscription status
   * (PAST_DUE/GRACE removed — business decision: a subscription simply
   * expires at its own period end, no intermediate punishment states).
   * Billing/BillingAttempt/Payment already correctly record FAILED
   * independently of this call (BillingService.markFailed()), and the
   * Owner can simply retry payment on the same still-payable Invoice —
   * there is nothing left for the Subscription row itself to do here.
   * Kept as a real method (not deleted) since BillingService.markFailed()
   * already calls it inside its own settlement transaction; removing the
   * call site there would be a larger, riskier change for no behavioral
   * gain over simply no-op'ing here.
   */
  paymentFailed(id: string, context: ActorContext) {
    return this.getScoped(id, context);
  }

  async transition(
    subscription: Subscription,
    to: SubscriptionStatus,
    context: ActorContext,
    options: TransitionOptions,
    tx?: Prisma.TransactionClient,
  ) {
    if (!ALLOWED_SUBSCRIPTION_TRANSITIONS[subscription.status].includes(to)) {
      throw new BadRequestException(
        `Transition ${subscription.status} → ${to} is not allowed.`,
      );
    }

    const run = async (tx: Prisma.TransactionClient) => {
      if (options.idempotencyKey) {
        const prior = await tx.subscriptionEvent.findUnique({
          where: { idempotencyKey: options.idempotencyKey },
        });
        if (prior)
          return tx.subscription.findUniqueOrThrow({
            where: { id: subscription.id },
          });
      }

      // Optimistic compare-and-set prevents two workers from applying the same state change.
      const changed = await tx.subscription.updateMany({
        where: { id: subscription.id, status: subscription.status },
        data: {
          status: to,
          ...(options.patch as
            Prisma.SubscriptionUpdateManyMutationInput | undefined),
        },
      });
      if (changed.count !== 1)
        throw new BadRequestException(
          'Subscription changed concurrently; retry the operation.',
        );

      /**
       * A Company only ever goes LIVE the moment its subscription first
       * becomes ACTIVE via a real payment — this is the single place that
       * happens (paymentSucceeded()/planChangeSucceeded() both funnel a
       * TRIALING/EXPIRED→ACTIVE recovery through this exact transition()).
       * Guarded by `status: { not: LIVE }` so it's a no-op (no extra write,
       * no re-triggered activation email) once a company has already gone
       * live — an already-LIVE company simply stays LIVE across renewals,
       * plan changes, or resubscribes.
       */
      if (subscription.companyId && to === SubscriptionStatus.ACTIVE) {
        await tx.company.updateMany({
          where: {
            id: subscription.companyId,
            status: { not: CompanyStatus.LIVE },
          },
          data: { status: CompanyStatus.LIVE, goLiveAt: new Date() },
        });
      }

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          companyId: subscription.companyId,
          fromStatus: subscription.status,
          toStatus: to,
          reason: options.reason,
          source: options.source,
          actorUserId: 'userId' in context ? context.userId : null,
          idempotencyKey: options.idempotencyKey,
          metadata: options.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: subscription.tenantId,
          companyId: subscription.companyId,
          actorUserId: 'userId' in context ? context.userId : null,
          actorType: context.actorType ?? AuditActorType.COMPANY_MEMBER,
          action: `SUBSCRIPTION_${to}`,
          entityType: 'Subscription',
          entityId: subscription.id,
          beforeData: { status: subscription.status },
          afterData: { status: to, reason: options.reason },
        },
      });

      /**
       * SUSPENDED is now only reachable via manual Platform-Admin
       * suspension (the automatic PAST_DUE/GRACE degradation chain that
       * used to also land here was removed) — the company still needs to
       * be told. No dedicated "SUBSCRIPTION_SUSPENDED" NotificationType
       * exists in the schema; reusing SUBSCRIPTION_PAST_DUE (the closest
       * existing "your subscription needs attention" category) rather
       * than adding a new enum value for this one case.
       */
      if (subscription.companyId && to === SubscriptionStatus.SUSPENDED) {
        await this.notificationService.create(
          tx,
          {
            tenantId: subscription.tenantId,
            companyId: subscription.companyId,
          },
          {
            type: NotificationType.SUBSCRIPTION_PAST_DUE,
            relatedEntityType: NotificationRelatedEntityType.SUBSCRIPTION,
            relatedEntityId: subscription.id,
            metadata: { status: to, reason: options.reason },
          },
        );
      }

      return tx.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
      });
    };

    // যদি caller ইতিমধ্যে একটি transaction client দিয়ে থাকে (যেমন BillingService,
    // যাতে Billing + Subscription আপডেট একসাথে atomic থাকে), সেটাই reuse করা হয় —
    // নতুন করে $transaction() খোলা হয় না।
    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  async runDueTransitions(now = new Date()): Promise<LifecycleRunResult> {
    const result: LifecycleRunResult = {
      trialsActivated: 0,
      trialsExpired: 0,
      activeExpired: 0,
      cancelledExpired: 0,
      failures: [],
    };
    /**
     * A trial ending is only "graduation to a real subscription" if the
     * company actually moved off the default-trial Plan during the trial
     * (via the existing change-plan flow) — otherwise nobody ever chose to
     * pay, and the subscription must lapse to EXPIRED, not silently become
     * ACTIVE forever. Known accepted edge case: if Admin re-points
     * isDefaultTrial to a different Plan mid-flight, an older trial still
     * on the *old* default-trial Plan will look "upgraded" here and go
     * ACTIVE instead — not worth a historical-tracking column for this
     * rare admin action.
     */
    await this.processDue(
      SubscriptionStatus.TRIALING,
      { trialEndsAt: { lte: now }, plan: { isDefaultTrial: true } },
      SubscriptionStatus.EXPIRED,
      result,
      'trialsExpired',
    );
    await this.processDue(
      SubscriptionStatus.TRIALING,
      { trialEndsAt: { lte: now }, plan: { isDefaultTrial: false } },
      SubscriptionStatus.ACTIVE,
      result,
      'trialsActivated',
      () => ({ trialEndsAt: null }),
    );
    /**
     * A period ending with no successful renewal payment by then simply
     * expires — no PAST_DUE/GRACE/SUSPENDED staging (business decision).
     * autoRenew no longer changes this outcome (it still governs whether
     * SubscriptionRenewalScheduler pre-generates the next Billing ahead of
     * time, a separate concern) — either way, an unpaid ACTIVE period past
     * its end date is EXPIRED.
     */
    await this.processDue(
      SubscriptionStatus.ACTIVE,
      { currentPeriodEnd: { lte: now } },
      SubscriptionStatus.EXPIRED,
      result,
      'activeExpired',
    );
    await this.processDue(
      SubscriptionStatus.CANCELLED,
      { currentPeriodEnd: { lte: now } },
      SubscriptionStatus.EXPIRED,
      result,
      'cancelledExpired',
    );
    return result;
  }

  /**
   * The one inherently time-based (not action-triggered) notification type —
   * hooked into this same 10-minute scheduler tick rather than a new poll.
   * Looks ahead EXPIRING_SOON_DAYS from trialEndsAt (TRIALING) or
   * currentPeriodEnd (ACTIVE). Dedup is state-based like every other
   * Notification hook this phase: skip a subscription that already has a
   * SUBSCRIPTION_EXPIRING_SOON notification created since its current
   * trial/period started — so a renewed period or a freshly-extended trial
   * is eligible for its own, later notification.
   */
  async checkExpiringSoon(now = new Date()): Promise<{ notified: number }> {
    const cutoff = this.addDays(now, SUBSCRIPTION_CONSTANTS.EXPIRING_SOON_DAYS);
    let notified = 0;

    const candidates = await this.prisma.subscription.findMany({
      where: {
        companyId: { not: null },
        OR: [
          {
            status: SubscriptionStatus.TRIALING,
            trialEndsAt: { gte: now, lte: cutoff },
          },
          {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { gte: now, lte: cutoff },
          },
        ],
      },
      take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
    });

    for (const subscription of candidates) {
      if (!subscription.companyId) continue;

      const periodStart =
        subscription.status === SubscriptionStatus.TRIALING
          ? subscription.startsAt
          : subscription.currentPeriodStart;
      const expiresAt =
        subscription.status === SubscriptionStatus.TRIALING &&
        subscription.trialEndsAt
          ? subscription.trialEndsAt
          : subscription.currentPeriodEnd;

      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.notification.findFirst({
          where: {
            type: NotificationType.SUBSCRIPTION_EXPIRING_SOON,
            relatedEntityId: subscription.id,
            createdAt: { gte: periodStart },
          },
        });
        if (existing) return;

        await this.notificationService.create(
          tx,
          {
            tenantId: subscription.tenantId,
            companyId: subscription.companyId!,
          },
          {
            type: NotificationType.SUBSCRIPTION_EXPIRING_SOON,
            relatedEntityType: NotificationRelatedEntityType.SUBSCRIPTION,
            relatedEntityId: subscription.id,
            metadata: {
              status: subscription.status,
              expiresAt: expiresAt.toISOString(),
            },
          },
        );
        notified += 1;
      });
    }

    return { notified };
  }

  /**
   * An ISSUED Invoice under an EXPIRED subscription that's gone unpaid for
   * STALE_ISSUED_INVOICE_DAYS auto-VOIDs, reusing InvoiceService.void()
   * unchanged. There is no further subscription-status transition to
   * apply — EXPIRED is already the terminal-until-resubscribe state — so
   * this is purely Invoice hygiene, not a lifecycle-driving step.
   */
  async voidStaleIssuedInvoices(now = new Date()) {
    const result = {
      invoicesVoided: 0,
      failures: [] as Array<{ invoiceId: string; message: string }>,
    };

    const cutoff = new Date(
      now.getTime() -
        SUBSCRIPTION_CONSTANTS.STALE_ISSUED_INVOICE_DAYS * 24 * 60 * 60 * 1000,
    );

    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.ISSUED,
        issuedAt: { lte: cutoff },
        subscription: { status: SubscriptionStatus.EXPIRED },
      },
      take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
      orderBy: { issuedAt: 'asc' },
    });

    for (const invoice of staleInvoices) {
      try {
        await this.invoiceService.void(invoice.id);
        result.invoicesVoided += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown lifecycle error';
        result.failures.push({ invoiceId: invoice.id, message });
        this.logger.error({ invoiceId: invoice.id, message });
      }
    }

    return result;
  }

  private async processDue(
    from: SubscriptionStatus,
    due: Prisma.SubscriptionWhereInput,
    to: SubscriptionStatus,
    result: LifecycleRunResult,
    counter: keyof Omit<LifecycleRunResult, 'failures'>,
    patch: (subscription: Subscription) => Record<string, unknown> = () => ({}),
  ) {
    const rows = await this.prisma.subscription.findMany({
      where: { status: from, ...due },
      take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
      orderBy: { updatedAt: 'asc' },
    });
    for (const row of rows) {
      try {
        if (!row.companyId) {
          throw new BadRequestException(
            'Company-scoped subscription is missing companyId.',
          );
        }

        await this.transition(
          row,
          to,
          {
            tenantId: row.tenantId,
            companyId: row.companyId,
            actorType: AuditActorType.SYSTEM,
          },
          {
            reason: 'SCHEDULED_LIFECYCLE',
            source: 'SCHEDULER',
            patch: patch(row),
          },
        );
        result[counter] += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown lifecycle error';
        result.failures.push({ subscriptionId: row.id, from, message });
        this.logger.error({ subscriptionId: row.id, from, to, message });
      }
    }
  }

  // private async getScoped(id: string, context: ActorContext) {
  //   const subscription = await this.prisma.subscription.findFirst({
  //     where: { id, tenantId: context.tenantId, companyId: context.companyId },
  //   });
  //   if (!subscription) throw new NotFoundException("Subscription not found.");
  //   return subscription;
  // }
  private async getScoped(id: string, context: ActorContext) {
    if ('tenantId' in context && 'companyId' in context) {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found.');
      }

      return subscription;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    return subscription;
  }
  private async findIdempotentResult(
    subscriptionId: string,
    idempotencyKey: string,
  ) {
    const event = await this.prisma.subscriptionEvent.findUnique({
      where: { idempotencyKey },
    });
    if (!event) return null;
    if (event.subscriptionId !== subscriptionId) {
      throw new BadRequestException(
        'Idempotency key was already used for another subscription.',
      );
    }
    return this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });
  }

  calculatePeriodEnd(start: Date, cycle: 'MONTHLY' | 'YEARLY') {
    const result = new Date(start);
    if (cycle === 'MONTHLY') result.setUTCMonth(result.getUTCMonth() + 1);
    else result.setUTCFullYear(result.getUTCFullYear() + 1);
    return result;
  }

  addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
