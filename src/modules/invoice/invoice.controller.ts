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

import { QueryInvoiceDto } from './dto/query-invoice.dto';

import { InvoiceService } from './invoice.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

/**
 * Invoice is system-generated only — there is no manual "create an
 * Invoice" route (SubscriptionRenewalService.ensureBillingAndInvoice() is
 * the only caller of InvoiceService.create()/issue(), reached via
 * checkout/renewal/manual payment). `issue`/`void` stay as Platform Admin
 * correction tools for an Invoice that's already system-generated.
 */
@Controller('platform/invoices')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_READ)
  findAll(@Query() query: QueryInvoiceDto) {
    return this.invoiceService.findAll(query);
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceService.findOne(id);
  }

  @Post(':id/issue')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_ISSUE)
  issue(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.issue(id, user.userId);
  }

  @Post(':id/void')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_VOID)
  voidInvoice(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.void(id, user.userId);
  }
}
