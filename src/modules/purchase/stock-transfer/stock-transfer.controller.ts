import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

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
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';

@Controller('companies/:companyId/stock-transfers')
@UseGuards(JwtAuthGuard, CompanyContextGuard, SubscriptionStatusGuard, CompanyPermissionsGuard)
export class StockTransferController {
  constructor(private readonly service: StockTransferService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_TRANSFER_READ)
  list(@CurrentCompany() context: CompanyContext) {
    return this.service.list(context);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_TRANSFER_READ)
  findOne(@CurrentCompany() context: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_TRANSFER_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateStockTransferDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Post(':id/dispatch')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_TRANSFER_DISPATCH)
  dispatch(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.dispatch(context, id, actor);
  }

  @Post(':id/receive')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_TRANSFER_RECEIVE)
  receive(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.receive(context, id, actor);
  }
}
