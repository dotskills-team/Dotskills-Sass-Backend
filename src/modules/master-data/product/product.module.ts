import { Module } from '@nestjs/common';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductCostingService } from './product-costing.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductCostingService],
  exports: [ProductService, ProductCostingService],
})
export class ProductModule {}
