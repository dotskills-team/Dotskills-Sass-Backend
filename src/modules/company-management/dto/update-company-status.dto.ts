import { IsEnum } from 'class-validator';
import { CompanyStatus } from 'src/generated/phase-1-prisma/enums';

export class UpdateCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}
