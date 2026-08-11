import {
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

import { TenantStatus } from 'src/generated/phase-1-prisma/enums';

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  @IsNotEmpty()
  status!: TenantStatus;
}