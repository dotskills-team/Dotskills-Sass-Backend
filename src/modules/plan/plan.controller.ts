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

// import {
//   PlanStatus,
// } from '../../generated/phase-1-prisma';

import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlanDto } from './dto/query-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';

import { PlanService } from './plan.service';

@Controller('plans')
export class PlanController {
  constructor(
    private readonly planService: PlanService,
  ) {}

  @Post()
  create(
    @Body() dto: CreatePlanDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.create(
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

  @Get()
  findAll(
    @Query() query: QueryPlanDto,
  ) {
    return this.planService.findAll(
      query,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.planService.findOne(id);
  }

  @Patch(':id')
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
    return this.planService.update(
      id,
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

  @Patch(':id/status')
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
    return this.planService.updateStatus(
      id,
      dto.status,
      {
        actorUserId:
          req.user?.id,
        ipAddress,
        userAgent,
        requestId,
      },
    );
  }

  @Delete(':id')
  archive(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.planService.archive(
      id,
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