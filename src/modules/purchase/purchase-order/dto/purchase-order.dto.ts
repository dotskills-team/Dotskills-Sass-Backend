import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/** A shop can realistically place hundreds of Purchase Orders over its lifetime — same reasoning as Product's Frontend Phase 1 pagination fix. */
export class ListPurchaseOrdersQueryDto extends PaginationQueryDto {}

export class PurchaseOrderItemInputDto {
  @IsUUID()
  productId!: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'orderedQty must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'orderedQty must be greater than 0' })
  orderedQty!: number;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'unitCost must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'unitCost cannot be negative' })
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'orderDate must be a valid ISO date' })
  orderDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items!: PurchaseOrderItemInputDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'orderDate must be a valid ISO date' })
  orderDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items?: PurchaseOrderItemInputDto[];
}

export class ReceiveGoodsItemDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'receivedQty must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'receivedQty must be greater than 0' })
  receivedQty!: number;
}

export class ReceiveGoodsDto {
  @IsOptional()
  @IsDateString({}, { message: 'receivedDate must be a valid ISO date' })
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  billImageUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsItemDto)
  items!: ReceiveGoodsItemDto[];
}

export class ReturnGoodsItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'quantity must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'quantity must be greater than 0' })
  quantity!: number;
}

export class ReturnGoodsDto {
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
  @Type(() => ReturnGoodsItemDto)
  items!: ReturnGoodsItemDto[];
}
