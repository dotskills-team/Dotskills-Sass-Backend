import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdatePlanPriceDto {
  @IsOptional()
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
  amount?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
