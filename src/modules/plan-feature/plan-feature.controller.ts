import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AssignPlanFeatureDto } from './dto/assign-plan-feature.dto';
import { QueryPlanFeatureDto } from './dto/query-plan-feature.dto';
import { UpdatePlanFeatureDto } from './dto/update-plan-feature.dto';

import { PlanFeatureService } from './plan-feature.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('plans/:planId/features')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlanFeatureController {
  constructor(private readonly planFeatureService: PlanFeatureService) {}

  /**
   * Assign feature to plan
   */
  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_FEATURE_ASSIGN)
  assign(
    @Param('planId') planId: string,

    @Body()
    dto: AssignPlanFeatureDto,

    @Req() req: any,

    @Ip() ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,

    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planFeatureService.assign(planId, dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  /**
   * Get all features of plan
   */
  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_FEATURE_READ)
  findAll(
    @Param('planId') planId: string,

    @Query()
    query: QueryPlanFeatureDto,
  ) {
    return this.planFeatureService.findAll(planId, query);
  }

  /**
   * Get one plan feature
   */
  @Get(':featureId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_FEATURE_READ)
  findOne(
    @Param('planId') planId: string,

    @Param('featureId')
    featureId: string,
  ) {
    return this.planFeatureService.findOne(planId, featureId);
  }

  /**
   * Update plan feature
   */
  @Patch(':featureId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_FEATURE_UPDATE)
  update(
    @Param('planId') planId: string,

    @Param('featureId')
    featureId: string,

    @Body()
    dto: UpdatePlanFeatureDto,

    @Req() req: any,

    @Ip() ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,

    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planFeatureService.update(planId, featureId, dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  /**
   * Remove feature from plan
   */
  @Delete(':featureId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_FEATURE_REMOVE)
  remove(
    @Param('planId') planId: string,

    @Param('featureId')
    featureId: string,

    @Req() req: any,

    @Ip() ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,

    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planFeatureService.remove(planId, featureId, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }
}
