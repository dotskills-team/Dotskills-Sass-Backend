import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ProductStatus } from 'src/generated/phase-1-prisma/enums';

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
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'costPrice must have maximum 4 decimal places' })
  @Min(0, { message: 'costPrice cannot be negative' })
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'salePrice must have maximum 4 decimal places' })
  @Min(0, { message: 'salePrice cannot be negative' })
  salePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'reorderLevel must have maximum 4 decimal places' })
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
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'costPrice must have maximum 4 decimal places' })
  @Min(0, { message: 'costPrice cannot be negative' })
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'salePrice must have maximum 4 decimal places' })
  @Min(0, { message: 'salePrice cannot be negative' })
  salePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'reorderLevel must have maximum 4 decimal places' })
  @Min(0, { message: 'reorderLevel cannot be negative' })
  reorderLevel?: number;

  @IsOptional()
  @IsBoolean()
  sellByWeight?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
