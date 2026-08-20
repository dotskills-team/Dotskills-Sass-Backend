import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

// import { BillingService } from './billing.service';

import { CreateBillingDto } from './dto/create-billing.dto';
import { QueryBillingDto } from './dto/query-billing.dto';
import { CancelBillingDto } from './dto/cancel-billing.dto';
import { MarkFailedBillingDto } from './dto/mark-failed-billing.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { BillingService } from './billing.service';

@Controller('platform/billings')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_CREATE)
  create(@Body() dto: CreateBillingDto, @Req() req: Request) {
    const user = req.user as any;

    return this.billingService.create(dto, user.userId);
  }

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_READ)
  findAll(@Query() query: QueryBillingDto) {
    return this.billingService.findAll(query);
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  @Post(':id/process')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_PROCESS)
  process(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.billingService.process(id, user.userId);
  }

  @Post(':id/retry')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_RETRY)
  retry(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.billingService.retry(id, user.userId);
  }

  @Post(':id/cancel')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBillingDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;

    return this.billingService.cancel(id, dto, user.userId);
  }

  @Post(':id/skip')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_SKIP)
  skip(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.billingService.skip(id, user.userId);
  }

  @Post(':id/mark-succeeded')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_MARK_SUCCEEDED)
  markSucceeded(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.billingService.markSucceeded(id, user.userId);
  }

  @Post(':id/mark-failed')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.BILLING_MARK_FAILED)
  markFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkFailedBillingDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;

    return this.billingService.markFailed(id, dto, user.userId);
  }
}
