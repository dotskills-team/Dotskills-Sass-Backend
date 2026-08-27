import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionRenewalService } from './subscription-renewal.service';

interface AuthenticatedRequest extends Request {
  user: {
    id?: string;
    userId?: string;
    roles?: string[];
  };
}

/**
 * "Renew Now" — the manual/exception override sitting alongside the
 * automatic renewal in subscription-renewal.scheduler.ts. Lives in its own
 * module (not platform-subscription.controller.ts) because it needs
 * BillingService, and SubscriptionModule cannot depend on BillingModule —
 * BillingModule already depends on SubscriptionModule (for
 * SubscriptionLifecycleService), so the reverse would be circular.
 */
@Controller('platform/subscriptions')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class SubscriptionRenewalController {
  constructor(private readonly renewalService: SubscriptionRenewalService) {}

  @Post(':id/renew')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SUBSCRIPTION_RENEW)
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId ?? req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is missing.');
    }

    return this.renewalService.renewSubscription(id, userId);
  }
}
