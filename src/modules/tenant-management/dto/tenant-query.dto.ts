import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';
import { TenantStatus } from 'src/generated/phase-1-prisma/enums';

// import { TenantStatus } from '../../../generated/phase-1-prisma';

export class TenantQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
