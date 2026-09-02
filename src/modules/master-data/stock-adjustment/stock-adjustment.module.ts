import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';

@Module({
  imports: [InventoryModule],
  controllers: [StockAdjustmentController],
  providers: [StockAdjustmentService],
})
export class StockAdjustmentModule {}
