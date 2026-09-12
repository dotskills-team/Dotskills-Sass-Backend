import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { QueryPaymentDto } from './dto/query-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

import { PaymentService } from './payment.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('platform/payments')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PAYMENT_READ)
  findAll(@Query() query: QueryPaymentDto) {
    return this.paymentService.findAll(query);
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PAYMENT_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.findOne(id);
  }

  /** Only ever returns data for an already-SUCCEEDED payment (BadRequestException otherwise). */
  @Get(':id/receipt')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PAYMENT_READ)
  getReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getReceipt(id);
  }

  @Post(':id/verify')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PAYMENT_VERIFY)
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;

    return this.paymentService.verifyAndSettle(id, dto.valId, user.userId);
  }

  @Post(':id/cancel')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.PAYMENT_CANCEL)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.paymentService.cancel(id, user.userId);
  }
}
