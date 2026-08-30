import { Module } from '@nestjs/common';

import { InventoryModule } from '../../master-data/inventory/inventory.module';
import { ProductModule } from '../../master-data/product/product.module';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';

@Module({
  imports: [InventoryModule, ProductModule],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
