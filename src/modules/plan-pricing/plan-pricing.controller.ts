import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
@UseGuards(
  JwtAuthGuard,
  PlatformPermissionsGuard,
)
export class PlanPricingController {
  constructor(
    private readonly planPricingService: PlanPricingService,
  ) {}

  @Post()
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_CREATE,
  )
  create(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Body()
    dto: CreatePlanPriceDto,
  ) {
    return this.planPricingService.create(
      planId,
      dto,
    );
  }

  @Get()
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_READ,
  )
  findAll(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Query()
    query: PlanPriceQueryDto,
  ) {
    return this.planPricingService.findAll(
      planId,
      query,
    );
  }

  @Get(':priceId')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_READ,
  )
  findOne(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Param(
      'priceId',
      ParseUUIDPipe,
    )
    priceId: string,
  ) {
    return this.planPricingService.findOne(
      planId,
      priceId,
    );
  }

  @Patch(':priceId')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_UPDATE,
  )
  update(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Param(
      'priceId',
      ParseUUIDPipe,
    )
    priceId: string,
    @Body()
    dto: UpdatePlanPriceDto,
  ) {
    return this.planPricingService.update(
      planId,
      priceId,
      dto,
    );
  }

  @Patch(':priceId/activate')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS,
  )
  activate(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Param(
      'priceId',
      ParseUUIDPipe,
    )
    priceId: string,
  ) {
    return this.planPricingService.activate(
      planId,
      priceId,
    );
  }

  @Patch(':priceId/deactivate')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS,
  )
  deactivate(
    @Param(
      'planId',
      ParseUUIDPipe,
    )
    planId: string,
    @Param(
      'priceId',
      ParseUUIDPipe,
    )
    priceId: string,
  ) {
    return this.planPricingService.deactivate(
      planId,
      priceId,
    );
  }
}