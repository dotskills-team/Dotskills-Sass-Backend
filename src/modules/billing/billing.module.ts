import { Module } from '@nestjs/common';

import { SubscriptionModule } from '../subscription/subscription.module';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [SubscriptionModule],

  controllers: [BillingController],

  providers: [BillingService],

  exports: [BillingService],
})
export class BillingModule {}
