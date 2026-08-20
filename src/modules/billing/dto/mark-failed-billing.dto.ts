import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkFailedBillingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  failureCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  failureMessage?: string;
}
