import {
  Body,
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

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';

import { InvoiceService } from './invoice.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('platform/invoices')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_CREATE)
  create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.create(dto, user.userId);
  }

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

  @Post(':id/cancel')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_CANCEL)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.cancel(id, user.userId);
  }

  @Post(':id/void')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_VOID)
  voidInvoice(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.void(id, user.userId);
  }

  @Post(':id/mark-paid')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INVOICE_MARK_PAID)
  markPaid(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.invoiceService.markPaid(id, user.userId);
  }
}
