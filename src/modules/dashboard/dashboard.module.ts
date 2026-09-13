import { Module } from '@nestjs/common';

import { ReportingModule } from '../reporting/reporting.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReportingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
