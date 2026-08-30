import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

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
import { PurchaseOrderService } from './purchase-order.service';
import {
  CreatePurchaseOrderDto,
  ReceiveGoodsDto,
  ReturnGoodsDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';

@Controller('companies/:companyId/purchase-orders')
@UseGuards(JwtAuthGuard, CompanyContextGuard, SubscriptionStatusGuard, CompanyPermissionsGuard)
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_READ)
  list(@CurrentCompany() context: CompanyContext) {
    return this.service.list(context);
  }

  @Get('returns')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_RETURN_READ)
  listReturns(@CurrentCompany() context: CompanyContext, @Query('purchaseOrderId') purchaseOrderId?: string) {
    return this.service.listReturns(context, purchaseOrderId);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_READ)
  findOne(@CurrentCompany() context: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Patch(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(context, id, dto, actor);
  }

  @Post(':id/cancel')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_CANCEL)
  cancel(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.cancel(context, id, actor);
  }

  @Post(':id/receive')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_ORDER_RECEIVE)
  receive(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveGoodsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.receive(context, id, dto, actor);
  }

  @Post(':id/returns')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PURCHASE_RETURN_CREATE)
  createReturn(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnGoodsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.createReturn(context, id, dto, actor);
  }
}
