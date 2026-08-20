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

// import {
//   PlanStatus,
// } from '../../generated/phase-1-prisma';

import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlanDto } from './dto/query-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';

import { PlanService } from './plan.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('plans')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_CREATE)
  create(
    @Body() dto: CreatePlanDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.create(dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_READ)
  findAll(@Query() query: QueryPlanDto) {
    return this.planService.findAll(query);
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_READ)
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.update(id, dto, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Patch(':id/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_STATUS)
  updateStatus(
    @Param('id') id: string,
    @Body()
    dto: UpdatePlanStatusDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.updateStatus(id, dto.status, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  @Delete(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLAN_ARCHIVE)
  archive(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.archive(id, {
      actorUserId: req.user?.userId,
      ipAddress,
      userAgent,
      requestId,
    });
  }
}
