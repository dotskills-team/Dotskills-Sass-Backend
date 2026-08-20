import { Module } from '@nestjs/common';

// import { PlanFeatureController } from './plan-feature.controller';
import { PlanFeatureService } from './plan-feature.service';
import { PlanFeatureController } from './plan-feature.controller';

@Module({
  controllers: [PlanFeatureController],

  providers: [PlanFeatureService],

  exports: [PlanFeatureService],
})
export class PlanFeatureModule {}
