import { IsEnum } from 'class-validator';

import { FeatureStatus } from '../../../generated/phase-1-prisma/enums';

export class UpdateFeatureStatusDto {
  @IsEnum(FeatureStatus)
  status!: FeatureStatus;
}