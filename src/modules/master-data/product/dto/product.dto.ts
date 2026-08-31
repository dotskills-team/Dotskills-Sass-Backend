import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from 'src/generated/phase-1-prisma/enums';

/**
 * A shop can realistically have hundreds of Products — the only Master
 * Data list that gets real pagination (backend Phase 6's own precedent:
 * {success, data, pagination:{page,limit,total,totalPages}}). Every other
 * Master Data entity stays unpaginated (Location/Category/Unit/Customer/
 * Supplier row counts are far smaller in practice).
 */
export class ListProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  /** POS-facing product lookup (Frontend Phase 3) — matched against name/sku/barcode, case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sku!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsUUID()
  baseUnitId!: string;

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
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'reorderLevel must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'reorderLevel cannot be negative' })
  reorderLevel?: number;

  @IsOptional()
  @IsBoolean()
  sellByWeight?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

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
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'reorderLevel must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'reorderLevel cannot be negative' })
  reorderLevel?: number;

  @IsOptional()
  @IsBoolean()
  sellByWeight?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
