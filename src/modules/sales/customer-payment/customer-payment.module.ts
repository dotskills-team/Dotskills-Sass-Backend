import { Module } from '@nestjs/common';

import { CustomerPaymentController } from './customer-payment.controller';
import { CustomerPaymentService } from './customer-payment.service';

@Module({
  controllers: [CustomerPaymentController],
  providers: [CustomerPaymentService],
  exports: [CustomerPaymentService],
})
export class CustomerPaymentModule {}
