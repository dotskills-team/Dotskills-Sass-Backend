import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ProductService } from './product.service';
import { ProductBulkImportService } from './product-bulk-import.service';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { BulkImportProductsDto } from './dto/bulk-import-products.dto';

@Controller('companies/:companyId/products')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class ProductController {
  constructor(
    private readonly service: ProductService,
    private readonly bulkImportService: ProductBulkImportService,
  ) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_READ)
  list(
    @CurrentCompany() context: CompanyContext,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.service.list(context, query);
  }

  @Get(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_READ)
  findOne(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(context, id);
  }

  @Post()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_CREATE)
  create(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(context, dto, actor);
  }

  @Patch(':id')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(context, id, dto, actor);
  }

  /** Read-only — validates every row (SKU/unit/category resolution) and reports CREATE/UPDATE/ERROR per row, writes nothing. */
  @Post('bulk-import/preview')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_BULK_IMPORT)
  async previewBulkImport(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: BulkImportProductsDto,
  ) {
    const summary = await this.bulkImportService.preview(context, dto.rows);
    return { success: true, ...summary };
  }

  /** Re-validates identically (never trusts the client's cached preview) and commits every valid row in one transaction. */
  @Post('bulk-import/confirm')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PRODUCT_BULK_IMPORT)
  async confirmBulkImport(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: BulkImportProductsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const summary = await this.bulkImportService.confirm(
      context,
      dto.rows,
      actor,
    );
    return { success: true, ...summary };
  }
}
