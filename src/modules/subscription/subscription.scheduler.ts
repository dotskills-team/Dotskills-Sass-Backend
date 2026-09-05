import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);
  constructor(private readonly lifecycle: SubscriptionLifecycleService) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'subscription-lifecycle',
    timeZone: 'UTC',
  })
  async processLifecycle() {
    const result = await this.lifecycle.runDueTransitions();
    this.logger.log({ event: 'subscription_lifecycle_completed', ...result });

    const staleInvoiceResult = await this.lifecycle.voidStaleIssuedInvoices();
    this.logger.log({
      event: 'stale_issued_invoices_completed',
      ...staleInvoiceResult,
    });

    const expiringSoonResult = await this.lifecycle.checkExpiringSoon();
    this.logger.log({
      event: 'subscription_expiring_soon_completed',
      ...expiringSoonResult,
    });
  }
}
