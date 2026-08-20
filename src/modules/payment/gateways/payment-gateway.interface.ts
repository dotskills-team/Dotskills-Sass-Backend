import { PaymentProvider } from '../../../generated/phase-1-prisma/enums';

export interface InitiatePaymentInput {
  tranId: string;
  amount: string;
  currencyCode: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
}

export interface InitiatePaymentResult {
  gatewayPageUrl: string;
  rawResponse: Record<string, unknown>;
}

export interface VerifyTransactionInput {
  tranId: string;
  valId: string;
}

export interface VerifyTransactionResult {
  verified: boolean;
  amount: string | null;
  currencyCode: string | null;
  gatewayReference: string;
  rawResponse: Record<string, unknown>;
}

/**
 * প্রতিটা payment gateway (SSLCommerz, ভবিষ্যতে bKash/Nagad/Stripe) এই একই
 * interface implement করবে — PaymentService/Invoice/Billing কখনো
 * provider-specific কোড দেখবে না।
 */
export interface PaymentGatewayAdapter {
  readonly provider: PaymentProvider;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyTransaction(
    input: VerifyTransactionInput,
  ): Promise<VerifyTransactionResult>;
}
