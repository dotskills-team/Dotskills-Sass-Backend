import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-query.dto';

@Controller('companies/:companyId/dashboard')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getOverview(
    @CurrentCompany() context: CompanyContext,
    @Query() query: DashboardOverviewQueryDto,
  ) {
    return this.service.getOverview(context, query);
  }
}
