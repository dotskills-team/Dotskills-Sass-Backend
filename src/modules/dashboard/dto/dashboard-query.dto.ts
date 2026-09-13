import { DateRangeReportQueryDto } from '../../reporting/dto/report-query.dto';

/** Same mandatory date-range + optional locationId contract as every other report — no separate rule invented for the dashboard. */
export class DashboardOverviewQueryDto extends DateRangeReportQueryDto {}
