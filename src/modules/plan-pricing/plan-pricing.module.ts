import { Module } from '@nestjs/common';

import { PlanPricingController } from './plan-pricing.controller';
import { PlanPricingService } from './plan-pricing.service';

@Module({
  controllers: [
    PlanPricingController,
  ],
  providers: [
    PlanPricingService,
  ],
  exports: [
    PlanPricingService,
  ],
})
export class PlanPricingModule {}