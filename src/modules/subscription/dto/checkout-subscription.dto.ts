import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BillingCycle } from 'src/generated/phase-1-prisma/enums';

/**
 * Both fields optional — omit both to pay for the current plan (first
 * paid period, or resubscribe after expiry); provide both to change plan
 * (payment required before the new plan takes effect, per business rule).
 */
export class CheckoutSubscriptionDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
