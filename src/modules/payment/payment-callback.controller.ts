import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { PaymentService } from './payment.service';

/**
 * SSLCommerz সরাসরি এই route-গুলো কল করে (browser redirect বা server-to-
 * server IPN) — তাদের কোনো JWT নেই, তাই ইচ্ছাকৃতভাবে JwtAuthGuard নেই।
 *
 * Security boundary এখানে guard দিয়ে নয়, বরং:
 *   - কখনো callback body-র posted status field trust করা হয় না —
 *     success/IPN route সবসময় SSLCommerz-এর নিজস্ব server-side
 *     Validation API আবার কল করে val_id verify করে (PaymentService.
 *     verifyByTranId → adapter.verifyTransaction)।
 *   - amount/currency/tran_id সবসময় আমাদের নিজস্ব stored Payment row-এর
 *     সাথে cross-check হয় (PaymentService.verifyAndSettle)।
 *   - fail/cancel route কখনো SUCCESS তৈরি করে না — শুধু conservative,
 *     fail-closed status marking।
 *   - প্রতিটা route idempotent (already-terminal payment হলে no-op)।
 *   - Global ThrottlerGuard rate-limiting সব route-এই প্রযোজ্য।
 *
 * success/fail/cancel — এই তিনটাই SSLCommerz browser-এর মাধ্যমে (form
 * auto-submit POST) কাস্টমারের নিজের ব্রাউজার দিয়ে হিট করে, তাই এগুলো raw
 * JSON ফেরত দেওয়া ভুল — কাস্টমার backend API response-এর উপর আটকে থাকবে,
 * কোথাও ফিরে যাবে না। এই তিনটা এখন company-side existing Payment Details
 * page (`/company/payments/:id`, ইতিমধ্যেই তৈরি — status badge, refresh,
 * failureReason সব দেখায়) — এ browser redirect করে। ipn আলাদা: সেটা
 * server-to-server (কোনো ব্রাউজার নেই), তাই সেটা JSON ack-ই থাকে, redirect
 * হয় না।
 */
@Controller('payments/sslcommerz')
export class PaymentCallbackController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('success')
  async success(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const payment = await this.handleVerify(body);
    this.redirectToPaymentDetails(res, payment.id);
  }

  @Post('ipn')
  ipn(@Body() body: Record<string, unknown>) {
    return this.handleVerify(body);
  }

  @Post('fail')
  async fail(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const tranId = this.requireTranId(body);
    const payment = await this.paymentService.failFromGateway(
      tranId,
      typeof body.error === 'string'
        ? body.error
        : 'Gateway reported payment failure',
    );
    this.redirectToPaymentDetails(res, payment.id);
  }

  @Post('cancel')
  async cancel(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const tranId = this.requireTranId(body);
    const payment = await this.paymentService.cancelFromGateway(tranId);
    this.redirectToPaymentDetails(res, payment.id);
  }

  private redirectToPaymentDetails(res: Response, paymentId: string): void {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    res.redirect(302, `${frontendUrl}/company/payments/${paymentId}`);
  }

  private handleVerify(body: Record<string, unknown>) {
    const tranId = this.requireTranId(body);
    const valId = typeof body.val_id === 'string' ? body.val_id : '';

    if (!valId) {
      throw new BadRequestException('val_id is required to verify a payment');
    }

    return this.paymentService.verifyByTranId(tranId, valId);
  }

  private requireTranId(body: Record<string, unknown>): string {
    if (typeof body.tran_id !== 'string' || !body.tran_id) {
      throw new BadRequestException('tran_id is required');
    }

    return body.tran_id;
  }
}
