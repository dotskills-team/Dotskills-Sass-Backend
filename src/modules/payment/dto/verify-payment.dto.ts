import { IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  valId!: string;
}
