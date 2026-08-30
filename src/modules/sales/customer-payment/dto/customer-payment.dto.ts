import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RecordCustomerPaymentDto {
  @IsUUID()
  customerId!: string;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'amount must have maximum 4 decimal places' })
  @Min(0.0001, { message: 'amount must be greater than 0' })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
