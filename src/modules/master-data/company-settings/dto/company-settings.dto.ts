import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @IsOptional()
  @IsBoolean()
  enableMultiUnit?: boolean;

  @IsOptional()
  @IsBoolean()
  enableCustomerDue?: boolean;

  @IsOptional()
  @IsBoolean()
  enableBarcode?: boolean;

  @IsOptional()
  @IsBoolean()
  enableProductVariant?: boolean;

  @IsOptional()
  @IsBoolean()
  enableComboOffer?: boolean;

  @IsOptional()
  @IsBoolean()
  enableMultiLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'maxCustomerDueLimit must have maximum 4 decimal places' })
  @Min(0, { message: 'maxCustomerDueLimit cannot be negative' })
  maxCustomerDueLimit?: number;

  @IsOptional()
  @IsBoolean()
  enableTax?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'defaultTaxRate must have maximum 3 decimal places' })
  @Min(0, { message: 'defaultTaxRate cannot be negative' })
  defaultTaxRate?: number;
}
