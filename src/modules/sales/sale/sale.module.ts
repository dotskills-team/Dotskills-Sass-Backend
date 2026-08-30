import { Module } from '@nestjs/common';

import { InventoryModule } from '../../master-data/inventory/inventory.module';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  imports: [InventoryModule],
  controllers: [SaleController],
  providers: [SaleService],
  exports: [SaleService],
})
export class SaleModule {}
