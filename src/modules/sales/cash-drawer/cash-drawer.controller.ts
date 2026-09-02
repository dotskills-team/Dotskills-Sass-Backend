import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CashDrawerSessionService } from './cash-drawer.service';
import {
  CloseCashDrawerSessionDto,
  ListCashDrawerSessionsQueryDto,
  OpenCashDrawerSessionDto,
} from './dto/cash-drawer.dto';

@Controller('companies/:companyId/cash-drawer-sessions')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class CashDrawerSessionController {
  constructor(private readonly service: CashDrawerSessionService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query() query: ListCashDrawerSessionsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.list(context, query, actor);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_READ)
  findOne(
    @CurrentCompany() context: CompanyContext,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.findOne(context, id, actor);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_OPEN)
  openSession(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: OpenCashDrawerSessionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.openSession(context, dto, actor);
  }

  @Patch(':id/close')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_CLOSE)
  closeSession(
    @CurrentCompany() context: CompanyContext,
    @Param('id') id: string,
    @Body() dto: CloseCashDrawerSessionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.closeSession(context, id, dto, actor);
  }
}
