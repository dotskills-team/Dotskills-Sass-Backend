import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymentProvider } from '../../../generated/phase-1-prisma/enums';

import {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentGatewayAdapter,
  VerifyTransactionInput,
  VerifyTransactionResult,
} from './payment-gateway.interface';

const SANDBOX_BASE_URL = 'https://sandbox.sslcommerz.com';
const LIVE_BASE_URL = 'https://securepay.sslcommerz.com';

/**
 * SSLCommerz-এর নিজস্ব REST API সরাসরি Node-এর built-in global `fetch`
 * (Node 24+) দিয়ে কল করা হয় — কোনো নতুন npm dependency ছাড়াই, এবং
 * unverified তৃতীয়-পক্ষ SDK-এর উপর নির্ভর না করে।
 *
 * Trust model: SSLCommerz IPN/callback body-তে কোনো HMAC signature header
 * থাকে না — তাদের নিজস্ব সুপারিশকৃত পদ্ধতি হলো val_id দিয়ে সার্ভার-সাইড
 * Validation API কল করে re-confirm করা (verifyTransaction() মেথড এটাই
 * করে) — কখনো callback body-র status field সরাসরি trust করা হয় না।
 */
@Injectable()
export class SslcommerzAdapter implements PaymentGatewayAdapter {
  readonly provider = PaymentProvider.SSLCOMMERZ;

  constructor(private readonly configService: ConfigService) {}

  private get storeId(): string {
    return this.configService.get<string>('SSLCOMMERZ_STORE_ID', '');
  }

  private get storePassword(): string {
    return this.configService.get<string>('SSLCOMMERZ_STORE_PASSWORD', '');
  }

  private get isSandbox(): boolean {
    return (
      this.configService.get<string>('SSLCOMMERZ_IS_SANDBOX', 'true') !==
      'false'
    );
  }

  private get baseUrl(): string {
    return this.isSandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  }

  private assertConfigured(): void {
    if (
      !this.storeId ||
      !this.storePassword ||
      this.storeId.startsWith('REPLACE_WITH_')
    ) {
      throw new BadRequestException(
        'SSLCommerz store credentials are not configured (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD).',
      );
    }
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    this.assertConfigured();

    const body = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: input.amount,
      currency: input.currencyCode,
      tran_id: input.tranId,
      success_url: this.configService.getOrThrow<string>(
        'SSLCOMMERZ_SUCCESS_URL',
      ),
      fail_url: this.configService.getOrThrow<string>('SSLCOMMERZ_FAIL_URL'),
      cancel_url: this.configService.getOrThrow<string>(
        'SSLCOMMERZ_CANCEL_URL',
      ),
      ipn_url: this.configService.getOrThrow<string>('SSLCOMMERZ_IPN_URL'),
      shipping_method: 'NO',
      product_name: `Invoice ${input.invoiceNumber}`,
      product_category: 'Subscription',
      product_profile: 'general',
      num_of_item: '1',
      cus_name: input.customerName,
      cus_email: input.customerEmail,
      cus_add1: 'N/A',
      cus_city: 'N/A',
      cus_country: 'Bangladesh',
      cus_phone: 'N/A',
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new BadRequestException('Failed to reach SSLCommerz session API');
    }

    const json = (await response.json()) as Record<string, unknown>;

    if (json.status !== 'SUCCESS' || typeof json.GatewayPageURL !== 'string') {
      throw new BadRequestException(
        `SSLCommerz session initiation failed: ${String(json.failedreason ?? json.status ?? 'unknown error')}`,
      );
    }

    return {
      gatewayPageUrl: json.GatewayPageURL,
      rawResponse: json,
    };
  }

  async verifyTransaction(
    input: VerifyTransactionInput,
  ): Promise<VerifyTransactionResult> {
    this.assertConfigured();

    const params = new URLSearchParams({
      val_id: input.valId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json',
    });

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/validator/api/validationserverAPI.php?${params.toString()}`,
      );
    } catch {
      throw new BadRequestException(
        'Failed to reach SSLCommerz validation API',
      );
    }

    const json = (await response.json()) as Record<string, unknown>;

    const status = typeof json.status === 'string' ? json.status : '';
    const verified = status === 'VALID' || status === 'VALIDATED';
    const tranIdMatches = json.tran_id === input.tranId;

    return {
      verified: verified && tranIdMatches,
      amount: typeof json.amount === 'string' ? json.amount : null,
      currencyCode:
        typeof json.currency_type === 'string' ? json.currency_type : null,
      gatewayReference: input.valId,
      rawResponse: json,
    };
  }
}
