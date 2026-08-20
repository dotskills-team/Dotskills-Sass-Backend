import { IsEnum } from 'class-validator';
import { PlanStatus } from 'src/generated/phase-1-prisma/enums';

// import {
//   PlanStatus,
// } from '../../../generated/phase-1-prisma';

export class UpdatePlanStatusDto {
  @IsEnum(PlanStatus)
  status!: PlanStatus;
}
