// import { Module } from "@nestjs/common";
// import { SubscriptionController } from "./subscription.controller";
// import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";
// import { SubscriptionScheduler } from "./subscription.scheduler";
// import { SubscriptionService } from "./subscription.service";

// @Module({
//   controllers: [SubscriptionController],
//   providers: [
//     SubscriptionService,
//     SubscriptionLifecycleService,
//     SubscriptionScheduler,
//   ],
//   exports: [SubscriptionService, SubscriptionLifecycleService],
// })
// export class SubscriptionModule {}

// import { Module } from "@nestjs/common";

// import { CompanyContextGuard } from "../../common/guards/company-context.guard";
// import { PlatformPermissionsGuard } from "../../common/guards/platform-permissions.guard";

// import { PlatformSubscriptionController } from "./platform-subscription.controller";
// import { SubscriptionController } from "./subscription.controller";
// import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";
// import { SubscriptionScheduler } from "./subscription.scheduler";
// import { SubscriptionService } from "./subscription.service";

// @Module({
//   controllers: [
//     SubscriptionController,
//     PlatformSubscriptionController,
//   ],

//   providers: [
//     SubscriptionService,
//     SubscriptionLifecycleService,
//     SubscriptionScheduler,
//     CompanyContextGuard,
//     PlatformPermissionsGuard,
//   ],

//   exports: [
//     SubscriptionService,
//     SubscriptionLifecycleService,
//   ],
// })
// export class SubscriptionModule {}

import { Module } from '@nestjs/common';

import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { PlatformSubscriptionController } from './platform-subscription.controller';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionScheduler } from './subscription.scheduler';
import { SubscriptionService } from './subscription.service';

@Module({
  controllers: [SubscriptionController, PlatformSubscriptionController],

  providers: [
    SubscriptionService,
    SubscriptionLifecycleService,
    SubscriptionScheduler,
    CompanyContextGuard,
    CompanyPermissionsGuard,
    PlatformPermissionsGuard,
  ],

  exports: [SubscriptionService, SubscriptionLifecycleService],
})
export class SubscriptionModule {}
