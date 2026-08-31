import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentCompany } from '../../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireCompanyPermissions } from '../../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import type { CompanyContext } from '../../../common/types/company-context.type';
import { CustomerPaymentService } from './customer-payment.service';
import { RecordCustomerPaymentDto } from './dto/customer-payment.dto';

@Controller('companies/:companyId/customer-payments')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class CustomerPaymentController {
  constructor(private readonly service: CustomerPaymentService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.list(context, customerId);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_CREATE)
  recordPayment(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: RecordCustomerPaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.recordPayment(context, dto, actor);
  }
}
