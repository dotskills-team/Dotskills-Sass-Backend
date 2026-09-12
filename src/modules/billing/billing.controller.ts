import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { QueryBillingDto } from './dto/query-billing.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { BillingService } from './billing.service';

/**
 * Billing is system-generated only — there is no manual "create a Billing"
 * route (SubscriptionRenewalService.ensureBillingAndInvoice() is the only
 * caller of BillingService.create(), reached via checkout/renewal/manual
 * payment). `process`/`retry` stay as the Platform Admin's manual
 * re-attempt tools for a Billing that's already system-generated — they
 * don't create anything new, just advance an existing row through the
 * exact same settlement path a real payment attempt uses.
 */
@Controller('platform/billings')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
}
