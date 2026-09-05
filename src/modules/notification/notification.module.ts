import { Global, Module } from '@nestjs/common';

import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * @Global() so every other module (Sale, Inventory, PurchaseOrder,
 * CashDrawerSession, Subscription, CompanyRbac — spanning both the
 * Business Ops and Billing sides) can inject NotificationService directly
 * without listing this module in their own `imports`, same precedent as
 * LocationAccessModule/PrismaModule.
 */
@Global()
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
