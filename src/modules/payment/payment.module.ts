import { Module } from '@nestjs/common';

import { InvoiceModule } from '../invoice/invoice.module';
import { BillingModule } from '../billing/billing.module';

import { PaymentController } from './payment.controller';
import { CompanyPaymentController } from './company-payment.controller';
import { PaymentCallbackController } from './payment-callback.controller';
import { PaymentService } from './payment.service';

import { SslcommerzAdapter } from './gateways/sslcommerz.adapter';
import { PAYMENT_GATEWAY_ADAPTERS } from './gateways/payment-gateway.tokens';

@Module({
  imports: [InvoiceModule, BillingModule],
  controllers: [
    PaymentController,
    CompanyPaymentController,
    PaymentCallbackController,
  ],
  providers: [
    PaymentService,
    SslcommerzAdapter,
    {
      provide: PAYMENT_GATEWAY_ADAPTERS,
      useFactory: (sslcommerz: SslcommerzAdapter) => ({
        SSLCOMMERZ: sslcommerz,
      }),
      inject: [SslcommerzAdapter],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
