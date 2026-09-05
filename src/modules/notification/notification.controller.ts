import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CompanyContext } from '../../common/types/company-context.type';
import { NotificationService } from './notification.service';
import { ListNotificationsQueryDto } from './dto/notification.dto';

@Controller('companies/:companyId/notifications')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.NOTIFICATION_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.service.listForCompany(context, query);
  }

  @Get('unread-count')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.NOTIFICATION_READ)
  getUnreadCount(@CurrentCompany() context: CompanyContext) {
    return this.service.getUnreadCount(context);
  }

  @Patch(':id/read')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.NOTIFICATION_READ)
  markRead(
    @CurrentCompany() context: CompanyContext,
    @Param('id') id: string,
  ) {
    return this.service.markRead(context, id);
  }
}
