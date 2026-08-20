import { IsDateString, IsUUID } from 'class-validator';

export class CreateBillingDto {
  @IsUUID()
  subscriptionId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsDateString()
  dueAt!: string;
}
