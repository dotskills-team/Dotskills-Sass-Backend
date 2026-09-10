import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { SubscriptionModule } from './subscription.module';

import {
  CompanySubscriptionCheckoutController,
  SubscriptionRenewalController,
} from './subscription-renewal.controller';
import { SubscriptionRenewalScheduler } from './subscription-renewal.scheduler';
import { SubscriptionRenewalService } from './subscription-renewal.service';

/**
 * Sits above SubscriptionModule + BillingModule + InvoiceModule (one-
 * directional imports only) — cannot live inside SubscriptionModule
 * itself, since BillingModule already imports SubscriptionModule (for
 * SubscriptionLifecycleService), and the reverse would be circular.
 */
@Module({
  imports: [SubscriptionModule, BillingModule, InvoiceModule],
  controllers: [SubscriptionRenewalController],
  providers: [SubscriptionRenewalService, SubscriptionRenewalScheduler],
  exports: [SubscriptionRenewalService],
})
export class SubscriptionRenewalModule {}
