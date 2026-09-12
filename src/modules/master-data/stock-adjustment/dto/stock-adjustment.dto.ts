import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { StockAdjustmentReason } from 'src/generated/phase-1-prisma/enums';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/**
 * A line specifies a quantity in exactly one of two modes — an absolute
 * target ("physical count found 42") or a signed delta ("write off 3
 * damaged units"). Whether exactly one of the two was actually supplied is
 * checked in `StockAdjustmentService`, not here as a request-level 400 —
 * deliberately, so a malformed line in an otherwise-valid bulk submission
 * reports as that one line's `ERROR` result (same bucket as an
 * insufficient-stock race or an unknown productId) instead of aborting the
 * whole batch, consistent with every other per-line failure mode.
 */
export class StockAdjustmentLineDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  newQuantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  changeQuantity?: number;

  @IsEnum(StockAdjustmentReason)
  reason!: StockAdjustmentReason;

  @ValidateIf(
    (o: StockAdjustmentLineDto) => o.reason === StockAdjustmentReason.OTHER,
  )
  @IsNotEmpty({ message: 'note is required when reason is OTHER' })
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

export class CreateStockAdjustmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDto)
  items!: StockAdjustmentLineDto[];
}

export class ListStockAdjustmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(StockAdjustmentReason)
  reason?: StockAdjustmentReason;
}
