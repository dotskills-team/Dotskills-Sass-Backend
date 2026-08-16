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
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { ChangeSubscriptionPlanDto } from "./dto/change-subscription-plan.dto";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { UpdateAutoRenewDto } from "./dto/update-auto-renew.dto";
import { SubscriptionService } from "./subscription.service";


import { CompanyContextGuard } from "../../common/guards/company-context.guard";
import type { CompanyContext } from "../../common/types/company-context.type";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
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
@Controller("subscriptions")
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
)
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



  
  @Get("current") current(@Req() req: AuthenticatedRequest) {
    return this.service.getCurrent(this.context(req));
  }
  @Get() all(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(this.context(req));
  }
  @Get(":id") one(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, this.context(req));
  }
  @Patch(":id/auto-renew") autoRenew(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutoRenewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateAutoRenew(id, dto, this.context(req));
  }
  @Patch(":id/plan") plan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changePlan(id, dto, this.context(req));
  }
  @Post(":id/cancel") cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, this.context(req));
  }
  @Post(":id/reactivate") reactivate(
    @Param("id", ParseUUIDPipe) id: string,
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
