import { IsEnum } from 'class-validator';
import { IndustryStatus, PlanStatus } from 'src/generated/phase-1-prisma/enums';

// import {
//   PlanStatus,
// } from '../../../generated/phase-1-prisma';

export class UpdateIndustryStatusDto {
  @IsEnum(IndustryStatus)
  status!: IndustryStatus;
}