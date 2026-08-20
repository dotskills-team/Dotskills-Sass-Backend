import { IsEnum } from 'class-validator';
import { CompanyMembershipStatus } from 'src/generated/phase-1-prisma/enums';

// import { CompanyMembershipStatus } from '../../../generated/phase-1-prisma';

export class UpdateCompanyOwnerStatusDto {
  @IsEnum(CompanyMembershipStatus)
  status!: CompanyMembershipStatus;
}
