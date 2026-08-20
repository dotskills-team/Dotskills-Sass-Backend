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

import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';

import { PaymentService } from './payment.service';

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
 * Payment হলো একমাত্র জায়গা যেখানে Company-side একটা mutation permission
 * পায় (Invoice/Billing-এর বিপরীতে) — পেমেন্ট করাটা inherently গ্রাহকের
 * নিজের action, Platform-controlled নয়।
 */
@Controller('payments')
@UseGuards(JwtAuthGuard, CompanyContextGuard, CompanyPermissionsGuard)
export class CompanyPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PAYMENT_CREATE)
  create(@Body() dto: CreatePaymentDto, @Req() req: AuthenticatedRequest) {
    return this.paymentService.create(dto, this.scope(req), {
      userId: req.user.userId,
      email: req.user.email,
      fullName: req.user.fullName,
    });
  }

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PAYMENT_READ)
  findAll(@Query() query: QueryPaymentDto, @Req() req: AuthenticatedRequest) {
    return this.paymentService.findAll(query, this.scope(req));
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PAYMENT_READ)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentService.findOne(id, this.scope(req));
  }

  private scope(req: AuthenticatedRequest) {
    return {
      tenantId: req.companyContext.tenantId,
      companyId: req.companyContext.companyId,
    };
  }
}
