import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

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
 */
@Controller('payments/sslcommerz')
export class PaymentCallbackController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('success')
  success(@Body() body: Record<string, unknown>) {
    return this.handleVerify(body);
  }

  @Post('ipn')
  ipn(@Body() body: Record<string, unknown>) {
    return this.handleVerify(body);
  }

  @Post('fail')
  fail(@Body() body: Record<string, unknown>) {
    const tranId = this.requireTranId(body);
    return this.paymentService.failFromGateway(
      tranId,
      typeof body.error === 'string'
        ? body.error
        : 'Gateway reported payment failure',
    );
  }

  @Post('cancel')
  cancel(@Body() body: Record<string, unknown>) {
    const tranId = this.requireTranId(body);
    return this.paymentService.cancelFromGateway(tranId);
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
