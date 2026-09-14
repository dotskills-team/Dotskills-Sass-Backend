import { Module } from '@nestjs/common';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductCostingService } from './product-costing.service';
import { ProductBulkImportService } from './product-bulk-import.service';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';

@Module({
  controllers: [ProductController, ProductVariantController],
  providers: [
    ProductService,
    ProductCostingService,
    ProductBulkImportService,
    ProductVariantService,
  ],
  exports: [
    ProductService,
    ProductCostingService,
    ProductBulkImportService,
    ProductVariantService,
  ],
})
export class ProductModule {}
