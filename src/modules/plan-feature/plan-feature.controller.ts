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
} from '@nestjs/common';

import { AssignPlanFeatureDto } from './dto/assign-plan-feature.dto';
import { QueryPlanFeatureDto } from './dto/query-plan-feature.dto';
import { UpdatePlanFeatureDto } from './dto/update-plan-feature.dto';

import { PlanFeatureService } from './plan-feature.service';

@Controller('plans/:planId/features')
export class PlanFeatureController {
  constructor(
    private readonly planFeatureService: PlanFeatureService,
  ) {}

  /**
   * Assign feature to plan
   */
  @Post()
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
    return this.planFeatureService.assign(
      planId,
      dto,
      {
        actorUserId:
          req.user?.id,
        ipAddress,
        userAgent,
        requestId,
      },
    );
  }

  /**
   * Get all features of plan
   */
  @Get()
  findAll(
    @Param('planId') planId: string,

    @Query()
    query: QueryPlanFeatureDto,
  ) {
    return this.planFeatureService.findAll(
      planId,
      query,
    );
  }

  /**
   * Get one plan feature
   */
  @Get(':featureId')
  findOne(
    @Param('planId') planId: string,

    @Param('featureId')
    featureId: string,
  ) {
    return this.planFeatureService.findOne(
      planId,
      featureId,
    );
  }

  /**
   * Update plan feature
   */
  @Patch(':featureId')
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
    return this.planFeatureService.update(
      planId,
      featureId,
      dto,
      {
        actorUserId:
          req.user?.id,
        ipAddress,
        userAgent,
        requestId,
      },
    );
  }

  /**
   * Remove feature from plan
   */
  @Delete(':featureId')
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
    return this.planFeatureService.remove(
      planId,
      featureId,
      {
        actorUserId:
          req.user?.id,
        ipAddress,
        userAgent,
        requestId,
      },
    );
  }
}