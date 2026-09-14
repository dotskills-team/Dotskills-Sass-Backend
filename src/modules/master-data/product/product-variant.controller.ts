import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ProductVariantService } from './product-variant.service';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
} from './dto/product-variant.dto';

@Controller('companies/:companyId/products/:productId/variants')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class ProductVariantController {
  constructor(private readonly service: ProductVariantService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.service.list(context, productId);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.service.create(context, productId, dto);
  }

  @Patch(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.service.update(context, productId, id, dto);
  }

  @Delete(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  remove(
    @CurrentCompany() context: CompanyContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(context, productId, id);
  }
}
