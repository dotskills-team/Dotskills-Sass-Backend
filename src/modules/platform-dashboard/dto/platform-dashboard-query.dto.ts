import { IsDateString } from 'class-validator';

/** Same mandatory-date-range contract as every other report in this codebase. */
export class PlatformDashboardQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}
