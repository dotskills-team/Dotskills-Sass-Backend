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
 * expires an ACTIVE subscription purely on a time clock, entirely
 * independent of whether the next period's Billing/Invoice was ever
 * generated — so a company could slide toward expiry having never even
 * been given an Invoice to pay. This runs on the same 10-minute cadence
 * (own @Cron — SubscriptionModule structurally can't depend on
 * BillingModule, so this can't live in the existing SubscriptionScheduler)
 * and generates it proactively.
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
        status: SubscriptionStatus.ACTIVE,
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
        /**
         * No fail-safe status transition anymore (PAST_DUE removed) — a
         * renewal-generation failure just logs (AUDIT_LOG entry above,
         * plus this error log for alerting). The subscription stays
         * ACTIVE; if its period genuinely ends before the next successful
         * renewal attempt, runDueTransitions()'s own ACTIVE→EXPIRED check
         * handles that independently, same as if this scheduler never ran
         * at all.
         */
        this.logger.error({
          event: 'auto_renewal_failed',
          subscriptionId: subscription.id,
          message,
        });
      }
    }

    this.logger.log({
      event: 'subscription_auto_renewal_completed',
      ...result,
    });
    return result;
  }
}
