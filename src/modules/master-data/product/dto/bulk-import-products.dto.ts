import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Deliberately loose at the DTO level — every field is optional/untyped
 * here so a single malformed row never rejects the whole request (Section
 * ৮.৮ decision 3: "একটা row-এ ভুল থাকলে পুরো import বাতিল হবে না"). All
 * real per-field validation (required-ness, length, numeric parsing,
 * SKU/unit/category resolution) happens in ProductBulkImportService,
 * producing a per-row ERROR result instead of throwing.
 */
export class BulkImportProductRowDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  costPrice?: string | number;

  @IsOptional()
  salePrice?: string | number;

  @IsOptional()
  reorderLevel?: string | number;

  @IsOptional()
  sellByWeight?: string | boolean;
}

export class BulkImportProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportProductRowDto)
  rows!: BulkImportProductRowDto[];
}
