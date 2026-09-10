import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { BillingCycle } from '../../../generated/phase-1-prisma/enums';

export class RecordManualPaymentDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
