import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  AuditActorType,
  SubscriptionStatus,
} from 'src/generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SUBSCRIPTION_CONSTANTS } from './subscription.constants';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';

/**
 * Closes the gap found while building this: runDueTransitions() already
 * demotes ACTIVE -> PAST_DUE -> GRACE -> SUSPENDED -> EXPIRED purely on a
 * time clock, entirely independent of whether the next period's Billing/
 * Invoice was ever generated — so a company could slide toward suspension
 * having never even been given an Invoice to pay. This runs on the same
 * 10-minute cadence (own @Cron — SubscriptionModule structurally can't
 * depend on BillingModule, so this can't live in the existing
 * SubscriptionScheduler) and generates it proactively.
 */
@Injectable()
export class SubscriptionRenewalScheduler {
  private readonly logger = new Logger(SubscriptionRenewalScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renewalService: SubscriptionRenewalService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'subscription-auto-renewal',
    timeZone: 'UTC',
  })
  async autoRenewDue() {
    const now = new Date();
    const result = { renewed: 0, alreadyRenewed: 0, failed: 0 };

    const candidates = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        currentPeriodEnd: { lte: now },
        autoRenew: true,
      },
      take: SUBSCRIPTION_CONSTANTS.LIFECYCLE_BATCH_SIZE,
      orderBy: { currentPeriodEnd: 'asc' },
    });

    for (const subscription of candidates) {
      const periodStart = subscription.currentPeriodEnd;
      const periodEnd = this.lifecycle.calculatePeriodEnd(
        periodStart,
        subscription.billingCycle,
      );

      const existingBilling = await this.prisma.billing.findUnique({
        where: {
          subscriptionId_periodStart_periodEnd: {
            subscriptionId: subscription.id,
            periodStart,
            periodEnd,
          },
        },
        select: { id: true },
      });

      if (existingBilling) {
        // Already renewed this period, still awaiting payment — nothing to
        // do until the Owner pays or the existing degradation clock moves
        // them further; re-checking every tick would be pure noise.
        result.alreadyRenewed += 1;
        continue;
      }

      try {
        await this.renewalService.renewSubscription(subscription.id);
        result.renewed += 1;

        await this.prisma.auditLog.create({
          data: {
            tenantId: subscription.tenantId,
            companyId: subscription.companyId,
            actorUserId: null,
            actorType: AuditActorType.SYSTEM,
            action: 'AUTO_RENEWAL_SUCCEEDED',
            entityType: 'Subscription',
            entityId: subscription.id,
            afterData: { periodStart, periodEnd },
          },
        });
      } catch (error) {
        result.failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown renewal error';

        await this.prisma.auditLog.create({
          data: {
            tenantId: subscription.tenantId,
            companyId: subscription.companyId,
            actorUserId: null,
            actorType: AuditActorType.SYSTEM,
            action: 'AUTO_RENEWAL_FAILED',
            entityType: 'Subscription',
            entityId: subscription.id,
            afterData: { message },
          },
        });
        this.logger.error({
          event: 'auto_renewal_failed',
          subscriptionId: subscription.id,
          message,
        });

        /**
         * Fail-safe: an ACTIVE subscription whose renewal generation itself
         * failed is treated the same as a failed payment — moved to
         * PAST_DUE with the identical patch shape runDueTransitions()'s own
         * ACTIVE->PAST_DUE branch already uses, so the existing PAST_DUE->
         * GRACE timer starts correctly. If it's already PAST_DUE, there's
         * no valid PAST_DUE->PAST_DUE transition and no need for one — the
         * GRACE timer from the original demotion is already running; only
         * the audit record above matters here, for Part 7 to alert on.
         */
        if (subscription.status === SubscriptionStatus.ACTIVE) {
          try {
            await this.lifecycle.transition(
              subscription,
              SubscriptionStatus.PAST_DUE,
              {
                tenantId: subscription.tenantId,
                companyId: subscription.companyId,
                actorType: AuditActorType.SYSTEM,
              },
              {
                reason: 'AUTO_RENEWAL_FAILED',
                source: 'SCHEDULER',
                patch: {
                  pastDueEndsAt: this.lifecycle.addDays(
                    now,
                    SUBSCRIPTION_CONSTANTS.DEFAULT_PAST_DUE_DAYS,
                  ),
                },
              },
            );
          } catch (transitionError) {
            this.logger.error({
              event: 'auto_renewal_failsafe_transition_failed',
              subscriptionId: subscription.id,
              message:
                transitionError instanceof Error
                  ? transitionError.message
                  : 'Unknown transition error',
            });
          }
        }
      }
    }

    this.logger.log({ event: 'subscription_auto_renewal_completed', ...result });
    return result;
  }
}
