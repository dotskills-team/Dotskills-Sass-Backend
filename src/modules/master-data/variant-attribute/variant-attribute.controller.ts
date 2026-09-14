import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentCompany } from '../../../common/decorators/current-company.decorator';
import { RequireCompanyPermissions } from '../../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { CompanyContext } from '../../../common/types/company-context.type';
import { VariantAttributeService } from './variant-attribute.service';
import {
  AddVariantAttributeValueDto,
  CreateVariantAttributeDto,
} from './dto/variant-attribute.dto';

/**
 * Company-scoped catalog of variant attributes (Size, Color, ...) — a
 * separate resource from Product because attributes/values are reused
 * across many products, not owned by a single one. Reuses PRODUCT_* company
 * permissions rather than a new permission set, matching this codebase's
 * "no new permission granularity without a real access-control reason"
 * convention — variant attributes are part of managing the product catalog.
 */
@Controller('companies/:companyId/variant-attributes')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class VariantAttributeController {
  constructor(private readonly service: VariantAttributeService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_READ)
  list(@CurrentCompany() context: CompanyContext) {
    return this.service.list(context);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateVariantAttributeDto,
  ) {
    return this.service.create(context, dto);
  }

  @Post(':id/values')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  addValue(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVariantAttributeValueDto,
  ) {
    return this.service.addValue(context, id, dto);
  }

  @Delete(':id/values/:valueId')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  removeValue(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
  ) {
    return this.service.removeValue(context, id, valueId);
  }

  @Delete(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  remove(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(context, id);
  }
}
