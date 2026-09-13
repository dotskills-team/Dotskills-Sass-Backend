import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformDashboardQueryDto } from './dto/platform-dashboard-query.dto';

/**
 * `PlatformPermissionsGuard` is a no-op when a route declares no required
 * permission codes — it would otherwise let ANY authenticated user (a
 * company user included, verified live) read platform-wide data. Gated on
 * `COMPANY_READ` specifically because every seeded platform role (down to
 * the base `PLATFORM_STAFF`) already carries it — the correct minimum for
 * "any real platform staff member," without inventing a new permission
 * code just for this one page.
 */
@Controller('platform/dashboard')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformDashboardController {
  constructor(private readonly service: PlatformDashboardService) {}

  @Get('overview')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_READ)
  getOverview(@Query() query: PlatformDashboardQueryDto) {
    return this.service.getOverview(query);
  }
}
