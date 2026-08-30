import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

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
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Controller('companies/:companyId/suppliers')
@UseGuards(JwtAuthGuard, CompanyContextGuard, SubscriptionStatusGuard, CompanyPermissionsGuard)
export class SupplierController {
  constructor(private readonly service: SupplierService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUPPLIER_READ)
  list(@CurrentCompany() context: CompanyContext) {
    return this.service.list(context);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUPPLIER_READ)
  findOne(@CurrentCompany() context: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUPPLIER_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Patch(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SUPPLIER_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(context, id, dto, actor);
  }
}
