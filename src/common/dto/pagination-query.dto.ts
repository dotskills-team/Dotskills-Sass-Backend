import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared shape for every paginated list endpoint's query params
 * (`{page, limit}` -> `{success, data, pagination:{page,limit,total,totalPages}}`),
 * extracted here after the third near-identical copy (Reporting Phase 6,
 * Product Frontend Phase 1, now Purchase Order + Stock Transfer) — the
 * existing two call sites are left untouched (no regression risk on
 * already-shipped code), new paginated endpoints extend this one instead
 * of adding a fourth copy.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
