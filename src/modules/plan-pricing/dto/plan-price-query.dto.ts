import {
  IsBooleanString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { BillingCycle } from 'src/generated/phase-1-prisma/enums';

// import { BillingCycle } from 'src/generated/phase-1-prisma';

export class PlanPriceQueryDto {
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}