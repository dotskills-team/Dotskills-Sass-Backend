import { Module } from '@nestjs/common';
import { CompanyManagementController } from './company-management.controller';
import { CompanyManagementService } from './company-management.service';

// import { CompanyManagementController } from './company-management.controller';
// import { CompanyManagementService } from './company-management.service';

@Module({
  controllers: [CompanyManagementController],
  providers: [CompanyManagementService],
  exports: [CompanyManagementService],
})
export class CompanyManagementModule {}
