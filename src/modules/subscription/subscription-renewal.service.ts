import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InvoiceStatus, SubscriptionStatus } from 'src/generated/phase-1-prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { InvoiceService } from '../invoice/invoice.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

/**
 * Generates (or resumes generating) the next Billing→Invoice(ISSUED) pair
 * for a Subscription's period right after its current one, reusing the
 * existing BillingService.create() / InvoiceService.create() / .issue()
 * unchanged — this is composition, not a parallel reimplementation.
 *
 * Idempotent by design, inside one shared transaction: if a prior call
 * already created the Billing (or even the Invoice) for this exact period
 * — whether from a previous renewal attempt or an Admin's own manual
 * Billing/Invoice actions — this picks up wherever it left off instead of
 * throwing a duplicate-conflict or creating a second one.
 */
@Injectable()
export class SubscriptionRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly invoiceService: InvoiceService,
    private readonly lifecycle: SubscriptionLifecycleService,
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
    const dueAt = periodStart;

    return this.prisma.$transaction(async (tx) => {
      let billing = await tx.billing.findUnique({
        where: {
          subscriptionId_periodStart_periodEnd: {
            subscriptionId,
            periodStart,
            periodEnd,
          },
        },
        include: { invoice: true },
      });

      if (!billing) {
        const created = await this.billingService.create(
          {
            subscriptionId,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            dueAt: dueAt.toISOString(),
          },
          actorUserId,
          tx,
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
    });
  }
}
