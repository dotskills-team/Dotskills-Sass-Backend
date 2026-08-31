import { IsNumber, IsUUID, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/** A shop can realistically create hundreds of transfers over its lifetime — same reasoning as Purchase Order's pagination. */
export class ListStockTransfersQueryDto extends PaginationQueryDto {}

export class CreateStockTransferDto {
  @IsUUID()
  fromLocationId!: string;

  @IsUUID()
  toLocationId!: string;

  @IsUUID()
  productId!: string;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'quantity must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'quantity must be greater than 0' })
  quantity!: number;
}
