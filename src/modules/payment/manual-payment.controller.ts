import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecordManualPaymentDto } from './dto/record-manual-payment.dto';
import { PaymentService } from './payment.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Platform Owner's "Record Manual Payment" action — the single entry point
 * for recording a cash/bank-transfer/offline payment against a company's
 * subscription. The Owner only initiates the business action; the system
 * still auto-generates the Billing/Invoice and settles the Payment through
 * the exact same chain the online flow uses (see PaymentService.recordManualPayment()).
 */
@Controller('platform/subscriptions')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class ManualPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/manual-payment')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SUBSCRIPTION_RENEW)
  recordManualPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordManualPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentService.recordManualPayment(
      {
        subscriptionId: id,
        planId: dto.planId,
        billingCycle: dto.billingCycle,
        note: dto.note,
      },
      {
        userId: req.user.userId,
        email: req.user.email,
        fullName: req.user.fullName,
      },
    );
  }
}
