import { BadRequestException } from '@nestjs/common';

/**
 * `dateTo` is inclusive through the end of that calendar day — a range
 * picked as "Aug 1 to Aug 30" must include every sale that happened on
 * Aug 30, not just up to midnight.
 */
export function parseReportDateRange(
  dateFrom: string,
  dateTo: string,
): { from: Date; to: Date } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('dateFrom/dateTo must be valid dates');
  }
  to.setUTCHours(23, 59, 59, 999);
  if (from > to) {
    throw new BadRequestException('dateFrom must not be after dateTo');
  }
  return { from, to };
}
