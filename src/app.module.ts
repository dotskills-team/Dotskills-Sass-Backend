// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';

// @Module({
//   imports: [],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}
// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { HealthModule } from './health/health.module';
// import { PrismaModule } from './prisma/prisma.module';

// @Module({
//   imports: [
//     PrismaModule,
//     HealthModule,
//   ],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { validateEnvironment } from './config/env.validation';

import { AccessControlSetupModule } from './modules/access-control-setup/access-control-setup.module';
import { PlatformStaffModule } from './modules/platform-staff/platform-staff.module';
import { PlatformRoleModule } from './modules/platform-role/platform-role.module';
import { CompanyRbacModule } from './modules/company-rbac/company-rbac.module';
import { CompanyManagementModule } from './modules/company-management/company-management.module';
import { CompanyOwnerModule } from './modules/company-owner/company-owner.module';
import { TenantManagementModule } from './modules/tenant-management/tenant-management.module';
import { IndustryManagementModule } from './modules/industry-management/industry-management.module';
import { PlanModule } from './modules/plan/plan.module';
import { PlanFeatureModule } from './modules/plan-feature/plan-feature.module';
import { PlanPricingModule } from './modules/plan-pricing/plan-pricing.module';
// import { SubscriptionModule } from './modules/subscription-management/subscription.module';
import { FeatureModule } from './modules/features-list/feature.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { BillingModule } from './modules/billing/billing.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PaymentModule } from './modules/payment/payment.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: seconds(60),
        limit: 100,
      },
    ]),

    PrismaModule,
    AuthModule,
    AccessControlSetupModule,
    PlatformStaffModule,
    PlatformRoleModule,
    CompanyRbacModule,
    CompanyManagementModule,
    CompanyOwnerModule,
    TenantManagementModule,
    IndustryManagementModule,
    PlanModule,
    PlanFeatureModule,
    PlanPricingModule,
    FeatureModule,
    SubscriptionModule,
    BillingModule,
    InvoiceModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
