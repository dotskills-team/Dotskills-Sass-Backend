import { Module } from '@nestjs/common';

import { SupplierPaymentController } from './supplier-payment.controller';
import { SupplierPaymentService } from './supplier-payment.service';

@Module({
  controllers: [SupplierPaymentController],
  providers: [SupplierPaymentService],
  exports: [SupplierPaymentService],
})
export class SupplierPaymentModule {}
