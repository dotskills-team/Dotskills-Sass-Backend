import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// import {
//   PlanStatus,
// } from '../../../generated/phase-1-prisma';

import {
  INDUSTRY_DEFAULT_LIMIT,
  INDUSTRY_DEFAULT_PAGE,
  INDUSTRY_MAX_LIMIT,
  INDUSTRY_SORT_FIELDS,
} from '../constants/industry.constants';
import { IndustryStatus } from 'src/generated/phase-1-prisma/enums';

export class IndustryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(IndustryStatus)
  status?: IndustryStatus;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = INDUSTRY_DEFAULT_PAGE;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(INDUSTRY_MAX_LIMIT)
  limit: number = INDUSTRY_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  @IsEnum(INDUSTRY_SORT_FIELDS)
  sortBy: (typeof INDUSTRY_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}