import { Module } from '@nestjs/common';
import { CompanyManagementController } from './company-management.controller';
import { CompanyManagementService } from './company-management.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [CompanyManagementController],
  providers: [CompanyManagementService],
  exports: [CompanyManagementService],
})
export class CompanyManagementModule {}
