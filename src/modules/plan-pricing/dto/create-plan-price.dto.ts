import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { BillingCycle } from 'src/generated/phase-1-prisma/enums';

// import { BillingCycle } from 'src/generated/phase-1-prisma';

export class CreatePlanPriceDto {
  @IsEnum(BillingCycle, {
    message: 'billingCycle must be either MONTHLY or YEARLY',
  })
  billingCycle!: BillingCycle;

  @IsOptional()
  @IsString()
  @Length(3, 3, {
    message: 'currencyCode must be exactly 3 characters',
  })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be a valid 3-letter uppercase currency code',
  })
  currencyCode?: string;

  @IsNumber(
    {
      maxDecimalPlaces: 4,
    },
    {
      message: 'amount must have maximum 4 decimal places',
    },
  )
  @Min(0, {
    message: 'amount cannot be negative',
  })
  amount!: number;

  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'effectiveFrom must be a valid ISO date',
    },
  )
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'effectiveTo must be a valid ISO date',
    },
  )
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean({
    message: 'isActive must be a boolean',
  })
  isActive?: boolean;
}
