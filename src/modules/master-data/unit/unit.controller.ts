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
import { UnitService } from './unit.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Controller('companies/:companyId/units')
@UseGuards(JwtAuthGuard, CompanyContextGuard, SubscriptionStatusGuard, CompanyPermissionsGuard)
export class UnitController {
  constructor(private readonly service: UnitService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.UNIT_READ)
  list(@CurrentCompany() context: CompanyContext) {
    return this.service.list(context);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.UNIT_READ)
  findOne(@CurrentCompany() context: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.UNIT_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateUnitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Patch(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.UNIT_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(context, id, dto, actor);
  }
}
