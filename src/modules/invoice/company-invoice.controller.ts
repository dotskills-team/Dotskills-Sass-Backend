import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { QueryInvoiceDto } from './dto/query-invoice.dto';

import { InvoiceService } from './invoice.service';

import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import type { CompanyContext } from '../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  companyContext: CompanyContext;
}

/**
 * নিজের Company-এর Invoice দেখার জন্য — read-only। Invoice lifecycle
 * (create/issue/cancel/void/mark-paid) সম্পূর্ণ Platform-controlled,
 * ঠিক Billing module-এর মতো — Company user-দের কোনো mutation route নেই।
 */
@Controller('invoices')
@UseGuards(JwtAuthGuard, CompanyContextGuard, CompanyPermissionsGuard)
export class CompanyInvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.INVOICE_READ)
  findAll(@Query() query: QueryInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.invoiceService.findAll(query, this.scope(req));
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.INVOICE_READ)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoiceService.findOne(id, this.scope(req));
  }

  private scope(req: AuthenticatedRequest) {
    return {
      tenantId: req.companyContext.tenantId,
      companyId: req.companyContext.companyId,
    };
  }
}
