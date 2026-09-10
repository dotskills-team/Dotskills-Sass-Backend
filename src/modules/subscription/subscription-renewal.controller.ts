import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  COMPANY_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from '../../common/constants/permission.constants';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import type { CompanyContext } from '../../common/types/company-context.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { SubscriptionRenewalService } from './subscription-renewal.service';

interface AuthenticatedRequest extends Request {
  user: {
    id?: string;
    userId?: string;
    roles?: string[];
  };
}

interface CompanyAuthenticatedRequest extends Request {
  user: { userId: string };
  companyContext: CompanyContext;
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

/**
 * Company-side "Subscribe / Pay Now" / Plan-change entry point — covers
 * first paid subscription, resubscribing after EXPIRED, renewing the
 * current plan early, and Plan change, all via
 * SubscriptionRenewalService.requestSubscriptionCheckout(). Separate
 * controller (same reason as SubscriptionRenewalController above): this
 * needs BillingService/InvoiceService transitively, and SubscriptionModule
 * (which owns the company-scoped SubscriptionController) cannot depend on
 * BillingModule without creating a cycle. Deliberately no
 * SubscriptionStatusGuard — checkout must stay reachable regardless of
 * subscription health, since paying is itself the recovery action (same
 * exemption already applied to cancel/reactivate in SubscriptionController).
 */
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, CompanyContextGuard, CompanyPermissionsGuard)
export class CompanySubscriptionCheckoutController {
  constructor(private readonly renewalService: SubscriptionRenewalService) {}

  @Post(':id/checkout')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN)
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutSubscriptionDto,
    @Req() req: CompanyAuthenticatedRequest,
  ) {
    return this.renewalService.requestSubscriptionCheckout(
      id,
      { planId: dto.planId, billingCycle: dto.billingCycle },
      req.user.userId,
    );
  }
}
