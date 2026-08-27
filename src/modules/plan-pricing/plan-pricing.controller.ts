import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PlanPricingService } from './plan-pricing.service';

import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { PlanPriceQueryDto } from './dto/plan-price-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('plans/:planId/prices')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlanPricingController {
  constructor(private readonly planPricingService: PlanPricingService) {}

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_CREATE)
  create(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Body()
    dto: CreatePlanPriceDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.planPricingService.create(planId, dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_READ)
  findAll(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Query()
    query: PlanPriceQueryDto,
  ) {
    return this.planPricingService.findAll(planId, query);
  }

  @Get(':priceId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_READ)
  findOne(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Param('priceId', ParseUUIDPipe)
    priceId: string,
  ) {
    return this.planPricingService.findOne(planId, priceId);
  }

  @Patch(':priceId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_UPDATE)
  update(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Param('priceId', ParseUUIDPipe)
    priceId: string,
    @Body()
    dto: UpdatePlanPriceDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.planPricingService.update(planId, priceId, dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Patch(':priceId/activate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS)
  activate(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Param('priceId', ParseUUIDPipe)
    priceId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.planPricingService.activate(planId, priceId, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Patch(':priceId/deactivate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS)
  deactivate(
    @Param('planId', ParseUUIDPipe)
    planId: string,
    @Param('priceId', ParseUUIDPipe)
    priceId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.planPricingService.deactivate(planId, priceId, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }
}
