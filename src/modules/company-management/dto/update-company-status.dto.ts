
import { IsString } from 'class-validator';

export class UpdateCompanyStatusDto {
  @IsString()
  status!: string;
}

