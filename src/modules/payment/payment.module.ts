import { Module } from '@nestjs/common';

import { InvoiceModule } from '../invoice/invoice.module';
import { BillingModule } from '../billing/billing.module';
import { SubscriptionRenewalModule } from '../subscription/subscription-renewal.module';

import { PaymentController } from './payment.controller';
import { CompanyPaymentController } from './company-payment.controller';
import { PaymentCallbackController } from './payment-callback.controller';
import { ManualPaymentController } from './manual-payment.controller';
import { PaymentService } from './payment.service';

import { SslcommerzAdapter } from './gateways/sslcommerz.adapter';
import { ManualPaymentAdapter } from './gateways/manual-payment.adapter';
import { PAYMENT_GATEWAY_ADAPTERS } from './gateways/payment-gateway.tokens';

@Module({
  imports: [InvoiceModule, BillingModule, SubscriptionRenewalModule],
  controllers: [
    PaymentController,
    CompanyPaymentController,
    PaymentCallbackController,
    ManualPaymentController,
  ],
  providers: [
    PaymentService,
    SslcommerzAdapter,
    ManualPaymentAdapter,
    {
      provide: PAYMENT_GATEWAY_ADAPTERS,
      useFactory: (
        sslcommerz: SslcommerzAdapter,
        manual: ManualPaymentAdapter,
      ) => ({
        SSLCOMMERZ: sslcommerz,
        MANUAL: manual,
      }),
      inject: [SslcommerzAdapter, ManualPaymentAdapter],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
