import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

import {
  AuditActorType,
  InvoiceStatus,
  SubscriptionStatus,
} from 'src/generated/phase-1-prisma/enums';
import { InvoiceService } from '../invoice/invoice.service';

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
     * ACTIVE/TRIALING subscription-এর normal billing cycle payment সফল
     * হওয়া কোনো "recovery" transition না (PAST_DUE/GRACE/SUSPENDED থেকে
     * ফেরা না) — এটাই একটা fresh subscription-এর সবচেয়ে সাধারণ, প্রথম
     * successful-payment case। আগে এই branch না থাকায় এটা সবসময় নিচের
     * "recoverableStatuses" guard-এ গিয়ে throw করত, এবং যেহেতু এই method
     * BillingService.markSucceeded()-এর একই transaction-এ চলে, পুরো
     * settlement (Payment→SUCCEEDED, Billing→SUCCEEDED, Invoice→PAID)
     * rollback হয়ে যেত — গেটওয়ে সত্যিই টাকা confirm করলেও।
     * renewInPlace() ইচ্ছাকৃতভাবে transition()/ALLOWED_SUBSCRIPTION_
     * TRANSITIONS ব্যবহার করে না (ACTIVE→ACTIVE কোনো status-এর নিজের
     * allowed-list-এ নেই, আর সেই shared map পরিবর্তন করলে transition()-এর
     * অন্য সব caller-ও প্রভাবিত হতো) — শুধু billing period refresh করে,
     * status অপরিবর্তিত রাখে, একই audit/event shape বজায় রেখে।
     */
    if (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIALING
    ) {
      return this.renewInPlace(subscription, context, idempotencyKey, tx);
    }

    const recoverableStatuses: readonly SubscriptionStatus[] = [
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.GRACE,
      SubscriptionStatus.SUSPENDED,
    ];

    if (!recoverableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        'Payment recovery is allowed only for PAST_DUE, GRACE or SUSPENDED subscriptions.',
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
          graceEndsAt: null,
          pastDueEndsAt: null,
          suspendedAt: null,
          suspensionExpiresAt: null,
          cancelledAt: null,
        },
      },
      tx,
    );
  }

  private async renewInPlace(
    subscription: Subscription,
    context: ActorContext,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
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
            subscription.billingCycle,
          ),
          graceEndsAt: null,
          pastDueEndsAt: null,
          suspendedAt: null,
          suspensionExpiresAt: null,
          cancelledAt: null,
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
          reason: 'PAYMENT_SUCCEEDED',
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
            reason: 'PAYMENT_SUCCEEDED',
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

  async paymentFailed(
    id: string,
    context: ActorContext,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
  ) {
    // Scope validation must happen before returning an idempotent replay.
    const subscription = await this.getScoped(id, context);

    const replay = await this.findIdempotentResult(id, idempotencyKey);
    if (replay) return replay;
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return this.transition(
        subscription,
        SubscriptionStatus.PAST_DUE,
        context,
        {
          reason: 'PAYMENT_FAILED',
          source: 'PAYMENT',
          idempotencyKey,
          patch: {
            pastDueEndsAt: this.addDays(
              new Date(),
              SUBSCRIPTION_CONSTANTS.DEFAULT_PAST_DUE_DAYS,
            ),
          },
        },
        tx,
      );
    }
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      return this.transition(
        subscription,
        SubscriptionStatus.GRACE,
        context,
        {
          reason: 'PAYMENT_RETRY_FAILED',
          source: 'PAYMENT',
          idempotencyKey,
          patch: {
            graceEndsAt: this.addDays(
              new Date(),
              SUBSCRIPTION_CONSTANTS.DEFAULT_GRACE_DAYS,
            ),
          },
        },
        tx,
      );
    }
    /**
     * Grace period exhausted by a further failed payment — mirrors the
     * exact GRACE→SUSPENDED transition `runDueTransitions()` already
     * applies when `graceEndsAt` elapses on its own (same patch shape),
     * so a failure-driven suspension and a time-driven one are identical.
     */
    if (subscription.status === SubscriptionStatus.GRACE) {
      const now = new Date();
      return this.transition(
        subscription,
        SubscriptionStatus.SUSPENDED,
        context,
        {
          reason: 'PAYMENT_GRACE_EXHAUSTED',
          source: 'PAYMENT',
          idempotencyKey,
          patch: {
            suspendedAt: now,
            suspensionExpiresAt: this.addDays(
              now,
              SUBSCRIPTION_CONSTANTS.DEFAULT_SUSPENSION_DAYS,
            ),
          },
        },
        tx,
      );
    }
    /**
     * No further payment-failure-driven degradation exists anywhere in this
     * codebase for SUSPENDED/CANCELLED/EXPIRED/TRIALING (the scheduler only
     * ever moves these by time, e.g. suspensionExpiresAt → EXPIRED) —
     * a failed retry against one of them is a safe no-op, not an error.
     * Throwing here previously rolled back the caller's Billing/BillingAttempt
     * bookkeeping (both run in the same transaction) and masked the real
     * gateway failure reason further up the call chain.
     */
    return subscription;
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
      activeMarkedPastDue: 0,
      pastDueMovedToGrace: 0,
      graceSuspended: 0,
      suspendedExpired: 0,
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
    await this.processDue(
      SubscriptionStatus.ACTIVE,
      { currentPeriodEnd: { lte: now }, autoRenew: true },
      SubscriptionStatus.PAST_DUE,
      result,
      'activeMarkedPastDue',
      () => ({
        pastDueEndsAt: this.addDays(
          now,
          SUBSCRIPTION_CONSTANTS.DEFAULT_PAST_DUE_DAYS,
        ),
      }),
    );
    await this.processDue(
      SubscriptionStatus.ACTIVE,
      { currentPeriodEnd: { lte: now }, autoRenew: false },
      SubscriptionStatus.EXPIRED,
      result,
      'cancelledExpired',
    );
    await this.processDue(
      SubscriptionStatus.PAST_DUE,
      { pastDueEndsAt: { lte: now } },
      SubscriptionStatus.GRACE,
      result,
      'pastDueMovedToGrace',
      () => ({
        pastDueEndsAt: null,
        graceEndsAt: this.addDays(
          now,
          SUBSCRIPTION_CONSTANTS.DEFAULT_GRACE_DAYS,
        ),
      }),
    );
    await this.processDue(
      SubscriptionStatus.GRACE,
      { graceEndsAt: { lte: now } },
      SubscriptionStatus.SUSPENDED,
      result,
      'graceSuspended',
      () => ({
        suspendedAt: now,
        suspensionExpiresAt: this.addDays(
          now,
          SUBSCRIPTION_CONSTANTS.DEFAULT_SUSPENSION_DAYS,
        ),
      }),
    );
    await this.processDue(
      SubscriptionStatus.SUSPENDED,
      { suspensionExpiresAt: { lte: now } },
      SubscriptionStatus.EXPIRED,
      result,
      'suspendedExpired',
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
   * An ISSUED Invoice sitting under a struggling (PAST_DUE/GRACE/SUSPENDED)
   * Subscription for more than STALE_ISSUED_INVOICE_DAYS (fixed at 30, not
   * configurable) auto-VOIDs — reuses the existing InvoiceService.void(),
   * never reimplements it. If the Subscription is still SUSPENDED at that
   * exact moment, it's moved straight to EXPIRED (via the existing
   * transition()) instead of waiting out its own independent suspension
   * timer — there is no longer a payable Invoice for it, so the lifecycle
   * is over either way, and Owner recovery goes through the self-service
   * Resubscribe flow with the Plan's *current* price, never the stale one.
   */
  async voidStaleIssuedInvoices(now = new Date()) {
    const result = { invoicesVoided: 0, subscriptionsExpired: 0, failures: [] as Array<{ invoiceId: string; message: string }> };

    const cutoff = new Date(
      now.getTime() -
        SUBSCRIPTION_CONSTANTS.STALE_ISSUED_INVOICE_DAYS * 24 * 60 * 60 * 1000,
    );

    const staleInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.ISSUED,
        issuedAt: { lte: cutoff },
        subscription: {
          status: {
            in: [
              SubscriptionStatus.PAST_DUE,
              SubscriptionStatus.GRACE,
              SubscriptionStatus.SUSPENDED,
            ],
          },
        },
      },
      include: { subscription: true },
      take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
      orderBy: { issuedAt: 'asc' },
    });

    for (const invoice of staleInvoices) {
      try {
        await this.invoiceService.void(invoice.id);
        result.invoicesVoided += 1;

        if (invoice.subscription.status === SubscriptionStatus.SUSPENDED) {
          await this.transition(
            invoice.subscription,
            SubscriptionStatus.EXPIRED,
            {
              tenantId: invoice.subscription.tenantId,
              companyId: invoice.subscription.companyId,
              actorType: AuditActorType.SYSTEM,
            },
            {
              reason: 'STALE_ISSUED_INVOICE_VOIDED',
              source: 'SCHEDULER',
            },
          );
          result.subscriptionsExpired += 1;
        }
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

// import {
//   BadRequestException,
//   Injectable,
//   Logger,
//   NotFoundException,
// } from "@nestjs/common";
// // import {
// //   AuditActorType,
// //   Prisma,
// //   Subscription,
// //   SubscriptionStatus,
// // } from "../../generated/phase-1-prisma";
// import { PrismaService } from "../../prisma/prisma.service";
// import {
//   ALLOWED_SUBSCRIPTION_TRANSITIONS,
//   SUBSCRIPTION_CONSTANTS,
// } from "./subscription.constants";
// import {
//   LifecycleRunResult,
//   SubscriptionContext,
//   SystemSubscriptionContext,
//   TransitionOptions,
// } from "./subscription.types";
// import { AuditActorType, SubscriptionStatus } from "src/generated/phase-1-prisma/enums";
// import { Prisma, Subscription } from "src/generated/phase-1-prisma/client";

// type ActorContext = SubscriptionContext | SystemSubscriptionContext;

// @Injectable()
// export class SubscriptionLifecycleService {
//   private readonly logger = new Logger(SubscriptionLifecycleService.name);

//   constructor(private readonly prisma: PrismaService) { }

//   async paymentSucceeded(
//     id: string,
//     context: ActorContext,
//     idempotencyKey: string,
//   ) {
//     const replay = await this.findIdempotentResult(id, idempotencyKey);
//     if (replay) return replay;
//     // const subscription = await this.getScoped(id, context);
//     // if (
//     //   ![
//     //     SubscriptionStatus.PAST_DUE,
//     //     SubscriptionStatus.GRACE,
//     //     SubscriptionStatus.SUSPENDED,
//     //   ].includes(subscription.status)
//     // ) {
//     //   throw new BadRequestException(
//     //     "Payment recovery is allowed only for PAST_DUE, GRACE or SUSPENDED subscriptions.",
//     //   );
//     // }
//     const subscription = await this.getScoped(id, context);

//     const recoverableStatuses: readonly SubscriptionStatus[] = [
//       SubscriptionStatus.PAST_DUE,
//       SubscriptionStatus.GRACE,
//       SubscriptionStatus.SUSPENDED,
//     ];

//     if (!recoverableStatuses.includes(subscription.status)) {
//       throw new BadRequestException(
//         "Payment recovery is allowed only for PAST_DUE, GRACE or SUSPENDED subscriptions.",
//       );
//     }
//     const now = new Date();
//     return this.transition(subscription, SubscriptionStatus.ACTIVE, context, {
//       reason: "PAYMENT_SUCCEEDED",
//       source: "PAYMENT",
//       idempotencyKey,
//       patch: {
//         currentPeriodStart: now,
//         currentPeriodEnd: this.calculatePeriodEnd(
//           now,
//           subscription.billingCycle,
//         ),
//         graceEndsAt: null,
//         pastDueEndsAt: null,
//         suspendedAt: null,
//         suspensionExpiresAt: null,
//         cancelledAt: null,
//       },
//     });
//   }

//   async paymentFailed(
//     id: string,
//     context: ActorContext,
//     idempotencyKey: string,
//   ) {
//     const replay = await this.findIdempotentResult(id, idempotencyKey);
//     if (replay) return replay;
//     const subscription = await this.getScoped(id, context);
//     if (subscription.status === SubscriptionStatus.ACTIVE) {
//       return this.transition(
//         subscription,
//         SubscriptionStatus.PAST_DUE,
//         context,
//         {
//           reason: "PAYMENT_FAILED",
//           source: "PAYMENT",
//           idempotencyKey,
//           patch: {
//             pastDueEndsAt: this.addDays(
//               new Date(),
//               SUBSCRIPTION_CONSTANTS.DEFAULT_PAST_DUE_DAYS,
//             ),
//           },
//         },
//       );
//     }
//     if (subscription.status === SubscriptionStatus.PAST_DUE) {
//       return this.transition(subscription, SubscriptionStatus.GRACE, context, {
//         reason: "PAYMENT_RETRY_FAILED",
//         source: "PAYMENT",
//         idempotencyKey,
//         patch: {
//           graceEndsAt: this.addDays(
//             new Date(),
//             SUBSCRIPTION_CONSTANTS.DEFAULT_GRACE_DAYS,
//           ),
//         },
//       });
//     }
//     throw new BadRequestException(
//       "Payment failure can only move ACTIVE→PAST_DUE or PAST_DUE→GRACE.",
//     );
//   }

//   async transition(
//     subscription: Subscription,
//     to: SubscriptionStatus,
//     context: ActorContext,
//     options: TransitionOptions,
//   ) {
//     if (!ALLOWED_SUBSCRIPTION_TRANSITIONS[subscription.status].includes(to)) {
//       throw new BadRequestException(
//         `Transition ${subscription.status} → ${to} is not allowed.`,
//       );
//     }

//     return this.prisma.$transaction(async (tx) => {
//       if (options.idempotencyKey) {
//         const prior = await tx.subscriptionEvent.findUnique({
//           where: { idempotencyKey: options.idempotencyKey },
//         });
//         if (prior)
//           return tx.subscription.findUniqueOrThrow({
//             where: { id: subscription.id },
//           });
//       }

//       // Optimistic compare-and-set prevents two workers from applying the same state change.
//       const changed = await tx.subscription.updateMany({
//         where: { id: subscription.id, status: subscription.status },
//         data: {
//           status: to,
//           ...(options.patch as
//             | Prisma.SubscriptionUpdateManyMutationInput
//             | undefined),
//         },
//       });
//       if (changed.count !== 1)
//         throw new BadRequestException(
//           "Subscription changed concurrently; retry the operation.",
//         );

//       await tx.subscriptionEvent.create({
//         data: {
//           subscriptionId: subscription.id,
//           tenantId: subscription.tenantId,
//           companyId: subscription.companyId,
//           fromStatus: subscription.status,
//           toStatus: to,
//           reason: options.reason,
//           source: options.source,
//           actorUserId: "userId" in context ? context.userId : null,
//           idempotencyKey: options.idempotencyKey,
//           metadata: options.metadata as Prisma.InputJsonValue | undefined,
//         },
//       });

//       await tx.auditLog.create({
//         data: {
//           tenantId: subscription.tenantId,
//           companyId: subscription.companyId,
//           actorUserId: "userId" in context ? context.userId : null,
//           actorType: context.actorType ?? AuditActorType.COMPANY_MEMBER,
//           action: `SUBSCRIPTION_${to}`,
//           entityType: "Subscription",
//           entityId: subscription.id,
//           beforeData: { status: subscription.status },
//           afterData: { status: to, reason: options.reason },
//         },
//       });
//       return tx.subscription.findUniqueOrThrow({
//         where: { id: subscription.id },
//       });
//     });
//   }

//   async runDueTransitions(now = new Date()): Promise<LifecycleRunResult> {
//     const result: LifecycleRunResult = {
//       trialsActivated: 0,
//       activeMarkedPastDue: 0,
//       pastDueMovedToGrace: 0,
//       graceSuspended: 0,
//       suspendedExpired: 0,
//       cancelledExpired: 0,
//       failures: [],
//     };
//     await this.processDue(
//       SubscriptionStatus.TRIALING,
//       { trialEndsAt: { lte: now } },
//       SubscriptionStatus.ACTIVE,
//       result,
//       "trialsActivated",
//       () => ({ trialEndsAt: null }),
//     );
//     await this.processDue(
//       SubscriptionStatus.ACTIVE,
//       { currentPeriodEnd: { lte: now }, autoRenew: true },
//       SubscriptionStatus.PAST_DUE,
//       result,
//       "activeMarkedPastDue",
//       () => ({
//         pastDueEndsAt: this.addDays(
//           now,
//           SUBSCRIPTION_CONSTANTS.DEFAULT_PAST_DUE_DAYS,
//         ),
//       }),
//     );
//     await this.processDue(
//       SubscriptionStatus.ACTIVE,
//       { currentPeriodEnd: { lte: now }, autoRenew: false },
//       SubscriptionStatus.EXPIRED,
//       result,
//       "cancelledExpired",
//     );
//     await this.processDue(
//       SubscriptionStatus.PAST_DUE,
//       { pastDueEndsAt: { lte: now } },
//       SubscriptionStatus.GRACE,
//       result,
//       "pastDueMovedToGrace",
//       () => ({
//         pastDueEndsAt: null,
//         graceEndsAt: this.addDays(
//           now,
//           SUBSCRIPTION_CONSTANTS.DEFAULT_GRACE_DAYS,
//         ),
//       }),
//     );
//     await this.processDue(
//       SubscriptionStatus.GRACE,
//       { graceEndsAt: { lte: now } },
//       SubscriptionStatus.SUSPENDED,
//       result,
//       "graceSuspended",
//       () => ({
//         suspendedAt: now,
//         suspensionExpiresAt: this.addDays(
//           now,
//           SUBSCRIPTION_CONSTANTS.DEFAULT_SUSPENSION_DAYS,
//         ),
//       }),
//     );
//     await this.processDue(
//       SubscriptionStatus.SUSPENDED,
//       { suspensionExpiresAt: { lte: now } },
//       SubscriptionStatus.EXPIRED,
//       result,
//       "suspendedExpired",
//     );
//     await this.processDue(
//       SubscriptionStatus.CANCELLED,
//       { currentPeriodEnd: { lte: now } },
//       SubscriptionStatus.EXPIRED,
//       result,
//       "cancelledExpired",
//     );
//     return result;
//   }

//   private async processDue(
//     from: SubscriptionStatus,
//     due: Prisma.SubscriptionWhereInput,
//     to: SubscriptionStatus,
//     result: LifecycleRunResult,
//     counter: keyof Omit<LifecycleRunResult, "failures">,
//     patch: (subscription: Subscription) => Record<string, unknown> = () => ({}),
//   ) {
//     const rows = await this.prisma.subscription.findMany({
//       where: { status: from, ...due },
//       take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
//       orderBy: { updatedAt: "asc" },
//     });
//     for (const row of rows) {
//       try {
//         await this.transition(
//           row,
//           to,
//           {
//             tenantId: row.tenantId,
//             companyId: row.companyId,
//             actorType: AuditActorType.SYSTEM,
//           },
//           {
//             reason: "SCHEDULED_LIFECYCLE",
//             source: "SCHEDULER",
//             patch: patch(row),
//           },
//         );
//         result[counter] += 1;
//       } catch (error) {
//         const message =
//           error instanceof Error ? error.message : "Unknown lifecycle error";
//         result.failures.push({ subscriptionId: row.id, from, message });
//         this.logger.error({ subscriptionId: row.id, from, to, message });
//       }
//     }
//   }

//   private async getScoped(id: string, context: ActorContext) {
//     const subscription = await this.prisma.subscription.findFirst({
//       where: { id, tenantId: context.tenantId, companyId: context.companyId },
//     });
//     if (!subscription) throw new NotFoundException("Subscription not found.");
//     return subscription;
//   }

//   private async findIdempotentResult(
//     subscriptionId: string,
//     idempotencyKey: string,
//   ) {
//     const event = await this.prisma.subscriptionEvent.findUnique({
//       where: { idempotencyKey },
//     });
//     if (!event) return null;
//     if (event.subscriptionId !== subscriptionId) {
//       throw new BadRequestException(
//         "Idempotency key was already used for another subscription.",
//       );
//     }
//     return this.prisma.subscription.findUniqueOrThrow({
//       where: { id: subscriptionId },
//     });
//   }

//   calculatePeriodEnd(start: Date, cycle: "MONTHLY" | "YEARLY") {
//     const result = new Date(start);
//     if (cycle === "MONTHLY") result.setUTCMonth(result.getUTCMonth() + 1);
//     else result.setUTCFullYear(result.getUTCFullYear() + 1);
//     return result;
//   }

//   private addDays(date: Date, days: number) {
//     const result = new Date(date);
//     result.setUTCDate(result.getUTCDate() + days);
//     return result;
//   }
// }
