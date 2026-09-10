import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentProvider } from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentGatewayAdapter,
  VerifyTransactionInput,
  VerifyTransactionResult,
} from './payment-gateway.interface';

/**
 * Platform Owner-recorded payment (cash, bank transfer, etc.) — no external
 * gateway involved. A manual payment is confirmed by the Platform Owner's
 * own action, so initiate()/verifyTransaction() perform no network call;
 * verifyTransaction() reads the Payment row itself (by tranId) to echo back
 * its real amount/currency, since PaymentService.verifyAndSettle() requires
 * a non-null amount/currency match before settling as succeeded.
 */
@Injectable()
export class ManualPaymentAdapter implements PaymentGatewayAdapter {
  readonly provider = PaymentProvider.MANUAL;

  constructor(private readonly prisma: PrismaService) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return {
      gatewayPageUrl: '',
      rawResponse: { source: 'MANUAL', tranId: input.tranId },
    };
  }

  async verifyTransaction(
    input: VerifyTransactionInput,
  ): Promise<VerifyTransactionResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerTransactionId: input.tranId },
      select: { amount: true, currencyCode: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this transaction');
    }

    return {
      verified: true,
      amount: payment.amount.toString(),
      currencyCode: payment.currencyCode,
      gatewayReference: `MANUAL-${input.tranId}`,
      rawResponse: { source: 'MANUAL' },
    };
  }
}
