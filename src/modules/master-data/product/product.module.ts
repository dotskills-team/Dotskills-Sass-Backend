import { Module } from '@nestjs/common';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductCostingService } from './product-costing.service';
import { ProductBulkImportService } from './product-bulk-import.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductCostingService, ProductBulkImportService],
  exports: [ProductService, ProductCostingService, ProductBulkImportService],
})
export class ProductModule {}
