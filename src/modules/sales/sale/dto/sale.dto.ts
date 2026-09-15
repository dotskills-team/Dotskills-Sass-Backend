import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalePaymentMethod } from 'src/generated/phase-1-prisma/enums';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/** A shop can realistically record thousands of Sales over its lifetime — same reasoning as Purchase Order/Stock Transfer's pagination. */
export class ListSalesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class SaleItemInputDto {
  @IsUUID()
  productId!: string;

  /** Required when the product has variants — checked against `Product.hasVariants` in the service. */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  /** The Unit this line is sold in (e.g. "Carton") — omit to use the Product's own base unit, unchanged from today. Must resolve directly to the Product's base unit (one level of nesting only), checked via `UnitConversionService`. */
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'quantity must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'quantity must be greater than 0' })
  quantity!: number;

  /** Optional override — defaults to the Product's current salePrice when omitted. */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'unitPrice must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'unitPrice cannot be negative' })
  unitPrice?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'discountAmount must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'discountAmount cannot be negative' })
  discountAmount?: number;

  /** Free-text serial/IMEI captured at sale time (electronics resale, etc.) — a manual note only, not validated or checked for uniqueness. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serialNote?: string;
}

export class SalePaymentInputDto {
  @IsEnum(SalePaymentMethod)
  method!: SalePaymentMethod;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'amount must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'amount must be greater than 0' })
  amount!: number;
}

export class CreateSaleDto {
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'saleDiscountAmount must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'saleDiscountAmount cannot be negative' })
  saleDiscountAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments!: SalePaymentInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class VoidSaleDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class SaleReturnItemInputDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'quantity must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'quantity must be greater than 0' })
  quantity!: number;
}

export class CreateSaleReturnDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'refundAmount must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'refundAmount cannot be negative' })
  refundAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnItemInputDto)
  items!: SaleReturnItemInputDto[];
}
