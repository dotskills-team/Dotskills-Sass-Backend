import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class OpenCashDrawerSessionDto {
  @IsUUID()
  locationId!: string;

  /**
   * Only used when this is the very first session ever for this cashier at
   * this Location — the service derives it from the previous session's
   * actualClosingBalance whenever one exists, ignoring this field.
   */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'openingBalance must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'openingBalance cannot be negative' })
  openingBalance?: number;
}

export class CloseCashDrawerSessionDto {
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'actualClosingBalance must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'actualClosingBalance cannot be negative' })
  actualClosingBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
