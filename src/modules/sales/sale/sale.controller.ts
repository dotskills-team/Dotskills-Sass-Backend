import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

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
import { SaleService } from './sale.service';
import {
  CreateSaleDto,
  CreateSaleReturnDto,
  ListSalesQueryDto,
  VoidSaleDto,
} from './dto/sale.dto';

@Controller('companies/:companyId/sales')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class SaleController {
  constructor(private readonly service: SaleService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.service.list(context, query);
  }

  @Get('returns')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_RETURN_READ)
  listReturns(
    @CurrentCompany() context: CompanyContext,
    @Query('saleId') saleId?: string,
  ) {
    return this.service.listReturns(context, saleId);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_READ)
  findOne(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateSaleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Post(':id/void')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_VOID)
  void(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidSaleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.void(context, id, dto, actor);
  }

  @Post(':id/returns')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SALE_RETURN_CREATE)
  createReturn(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSaleReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.createReturn(context, id, dto, actor);
  }
}
