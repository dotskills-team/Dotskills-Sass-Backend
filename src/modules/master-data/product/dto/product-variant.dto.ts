import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from 'src/generated/phase-1-prisma/enums';

export class CreateProductVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'costPrice must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'costPrice cannot be negative' })
  costPrice!: number;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'salePrice must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'salePrice cannot be negative' })
  salePrice!: number;

  /** e.g. [Size:M's valueId, Color:Red's valueId] — one value per distinguishing attribute. Uniqueness of the resulting combination per product is enforced by the service, not the DB (no natural DB constraint on a variable-length join). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attributeValueIds!: string[];
}

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'costPrice must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'costPrice cannot be negative' })
  costPrice?: number;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'salePrice must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'salePrice cannot be negative' })
  salePrice?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attributeValueIds?: string[];
}
