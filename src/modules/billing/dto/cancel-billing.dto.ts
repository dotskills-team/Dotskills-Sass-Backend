import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBillingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;
}
