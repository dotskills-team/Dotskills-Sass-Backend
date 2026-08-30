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
import { SubscriptionRenewalModule } from './modules/subscription/subscription-renewal.module';
import { BillingModule } from './modules/billing/billing.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PaymentModule } from './modules/payment/payment.module';
import { LocationModule } from './modules/master-data/location/location.module';
import { CategoryModule } from './modules/master-data/category/category.module';
import { UnitModule } from './modules/master-data/unit/unit.module';
import { ProductModule } from './modules/master-data/product/product.module';
import { CustomerModule } from './modules/master-data/customer/customer.module';
import { SupplierModule } from './modules/master-data/supplier/supplier.module';
import { CompanySettingsModule } from './modules/master-data/company-settings/company-settings.module';
import { InventoryModule } from './modules/master-data/inventory/inventory.module';
import { PurchaseOrderModule } from './modules/purchase/purchase-order/purchase-order.module';
import { StockTransferModule } from './modules/purchase/stock-transfer/stock-transfer.module';
import { SupplierPaymentModule } from './modules/purchase/supplier-payment/supplier-payment.module';
import { SaleModule } from './modules/sales/sale/sale.module';
import { CustomerPaymentModule } from './modules/sales/customer-payment/customer-payment.module';
import { CashDrawerSessionModule } from './modules/sales/cash-drawer/cash-drawer.module';
import { ReportingModule } from './modules/reporting/reporting.module';
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
    SubscriptionRenewalModule,
    BillingModule,
    InvoiceModule,
    PaymentModule,
    LocationModule,
    CategoryModule,
    UnitModule,
    ProductModule,
    CustomerModule,
    SupplierModule,
    CompanySettingsModule,
    InventoryModule,
    PurchaseOrderModule,
    StockTransferModule,
    SupplierPaymentModule,
    SaleModule,
    CustomerPaymentModule,
    CashDrawerSessionModule,
    ReportingModule,
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
