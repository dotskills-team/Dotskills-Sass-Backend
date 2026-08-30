import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateStockTransferDto {
  @IsUUID()
  fromLocationId!: string;

  @IsUUID()
  toLocationId!: string;

  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'quantity must have maximum 4 decimal places' })
  @Min(0.0001, { message: 'quantity must be greater than 0' })
  quantity!: number;
}
