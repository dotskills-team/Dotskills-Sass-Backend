// import {
//   Body,
//   Controller,
//   Get,
//   Param,
//   ParseUUIDPipe,
//   Patch,
//   Post,
//   Req,
//   UseGuards,
// } from "@nestjs/common";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateAutoRenewDto } from './dto/update-auto-renew.dto';
import { SubscriptionService } from './subscription.service';

import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../common/guards/subscription-status.guard';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import type { CompanyContext } from '../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// interface AuthenticatedRequest extends Request {
//   user: { id: string; tenantId: string; companyId: string };
// }
interface AuthenticatedRequest extends Request {
  // user: {
  //   id?: string;
  //   userId?: string;
  //   roles?: string[];
  //   tenantId?: string;
  //   companyId?: string;
  // };
  user: AuthenticatedUser;
  companyContext: CompanyContext;
}
// @Controller("subscriptions")
// @UseGuards(AuthGuard("jwt")) // Add your existing PermissionsGuard here.
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, CompanyContextGuard, CompanyPermissionsGuard)
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}
  // @Post() create(
  //   @Body() dto: CreateSubscriptionDto,
  //   @Req() req: AuthenticatedRequest,
  // ) {
  //   return this.service.create(dto, this.context(req));
  // }
  // @Post()
  // create(
  //   @Body() dto: CreateSubscriptionDto,
  //   @Headers("x-company-id") companyId: string,
  //   @Req() req: AuthenticatedRequest,
  // ) {
  //   return this.service.create(dto, {
  //     userId: req.user.userId ?? req.user.id!,
  //     companyId,
  //     roles: req.user.roles ?? [],
  //   });
  // }

  @Get('current') current(@Req() req: AuthenticatedRequest) {
    return this.service.getCurrent(this.context(req));
  }
  @Get() all(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(this.context(req));
  }
  /**
   * Company-safe plan catalog for Change Plan — must be registered before `:id` so
   * "plans" is never captured as a subscription UUID param.
   */
  @Get('plans') plans(@Req() req: AuthenticatedRequest) {
    return this.service.getEligiblePlans(this.context(req));
  }
  @Get(':id') one(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, this.context(req));
  }
  /**
   * SubscriptionStatusGuard applied only here and on `plan` — never on
   * `cancel`/`reactivate`/reads below. Cancel/reactivate ARE the self-
   * service recovery path (reactivate() undoes a still-in-period
   * cancellation for free — see subscription.service.ts), so gating them
   * on subscription health would block the exact routes a struggling
   * company needs most. Same exemption principle as Payment/Invoice.
   */
  @Patch(':id/auto-renew')
  @UseGuards(SubscriptionStatusGuard)
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUBSCRIPTION_AUTO_RENEW)
  autoRenew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutoRenewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateAutoRenew(id, dto, this.context(req));
  }
  @Patch(':id/plan')
  @UseGuards(SubscriptionStatusGuard)
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN)
  plan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changePlan(id, dto, this.context(req));
  }
  @Post(':id/cancel')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUBSCRIPTION_CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, this.context(req));
  }
  @Post(':id/reactivate')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUBSCRIPTION_REACTIVATE)
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reactivate(id, this.context(req));
  }
  // private context(req: AuthenticatedRequest) {
  //   return {
  //     userId: req.user.id,
  //     tenantId: req.user.tenantId,
  //     companyId: req.user.companyId,
  //   };
  // }
  //   private context(req: AuthenticatedRequest) {
  //   return {
  //     userId: req.user.userId ?? req.user.id!,
  //     tenantId: req.user.tenantId!,
  //     companyId: req.user.companyId!,
  //   };
  // }
  private context(req: AuthenticatedRequest) {
    return {
      userId: req.user.userId,
      tenantId: req.companyContext.tenantId,
      companyId: req.companyContext.companyId,
    };
  }
}
