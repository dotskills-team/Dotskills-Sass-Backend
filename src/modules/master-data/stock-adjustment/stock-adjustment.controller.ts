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
import { StockAdjustmentService } from './stock-adjustment.service';
import {
  CreateStockAdjustmentDto,
  ListStockAdjustmentsQueryDto,
} from './dto/stock-adjustment.dto';

@Controller('companies/:companyId/stock-adjustments')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class StockAdjustmentController {
  constructor(private readonly service: StockAdjustmentService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_ADJUSTMENT_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query() query: ListStockAdjustmentsQueryDto,
  ) {
    return this.service.list(context, query);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_ADJUSTMENT_READ)
  findOne(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListStockAdjustmentsQueryDto,
  ) {
    return this.service.findOne(context, id, query);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.STOCK_ADJUSTMENT_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }
}
