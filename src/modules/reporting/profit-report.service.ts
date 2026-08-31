import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DateRangeReportQueryDto } from './dto/report-query.dto';
import { parseReportDateRange } from './report-date-range.util';
import { createCsvStream } from './csv-stream.util';

interface DayRow {
  day: Date;
  sale_count: number;
  revenue: unknown;
  cogs: unknown;
}

interface SummaryRow {
  sale_count: number;
  revenue: unknown;
  cogs: unknown;
}

interface ProfitReportCsvRow {
  date: string;
  saleCount: number;
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
}

/**
 * COGS is read from SaleItem.unitCost, not Product.costPrice — decision #1.
 * SaleItem.unitCost holds the exact same historical snapshot as
 * StockMovement.unitCost for the same line (both are the one
 * Product.costPrice read inside SaleService.create()'s transaction), but
 * SaleItem is used because it's directly, indexedly joined to Sale, while
 * StockMovement.referenceId carries no formal FK relation.
 *
 * "Revenue" = Sale.totalAmount - Sale.taxAmount (tax collected is a
 * pass-through liability, not business income — see Phase 6 plan,
 * decision A). Returns are not netted out this phase (decision B) — a
 * SaleReturn has no per-line price breakdown to net correctly.
 *
 * The day-bucketed GROUP BY DATE_TRUNC needs raw SQL — Prisma's query
 * builder has no date-bucketing capability — but the WHERE clause is
 * built with Prisma.sql/parameterized values throughout, never string
 * concatenation, so this carries no injection risk.
 */
@Injectable()
export class ProfitReportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildBaseWhere(
    context: CompanyContext,
    query: Pick<DateRangeReportQueryDto, 'dateFrom' | 'dateTo' | 'locationId'>,
  ) {
    const { from, to } = parseReportDateRange(query.dateFrom, query.dateTo);
    const locationFilter = query.locationId
      ? Prisma.sql`AND s."locationId" = ${query.locationId}::uuid`
      : Prisma.empty;
    return Prisma.sql`
      s."tenantId" = ${context.tenantId}::uuid
      AND s."companyId" = ${context.companyId}::uuid
      AND s."status" = 'COMPLETED'
      AND s."saleDate" >= ${from}
      AND s."saleDate" <= ${to}
      ${locationFilter}
    `;
  }

  async getProfitReport(
    context: CompanyContext,
    query: DateRangeReportQueryDto,
  ) {
    const baseWhere = this.buildBaseWhere(context, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [dayRows, totalDaysRows, summaryRows] = await Promise.all([
      this.prisma.$queryRaw<DayRow[]>(Prisma.sql`
        WITH sale_cogs AS (
          SELECT si."saleId" AS sale_id, SUM(si.quantity * si."unitCost") AS cogs
          FROM sale_items si
          GROUP BY si."saleId"
        )
        SELECT
          DATE_TRUNC('day', s."saleDate") AS day,
          COUNT(*)::int AS sale_count,
          COALESCE(SUM(s."totalAmount" - s."taxAmount"), 0)::numeric(20,4) AS revenue,
          COALESCE(SUM(sc.cogs), 0)::numeric(20,4) AS cogs
        FROM sales s
        LEFT JOIN sale_cogs sc ON sc.sale_id = s.id
        WHERE ${baseWhere}
        GROUP BY DATE_TRUNC('day', s."saleDate")
        ORDER BY day ASC
        LIMIT ${limit} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT DATE_TRUNC('day', s."saleDate"))::int AS count
        FROM sales s
        WHERE ${baseWhere}
      `),
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        WITH sale_cogs AS (
          SELECT si."saleId" AS sale_id, SUM(si.quantity * si."unitCost") AS cogs
          FROM sale_items si
          GROUP BY si."saleId"
        )
        SELECT
          COUNT(*)::int AS sale_count,
          COALESCE(SUM(s."totalAmount" - s."taxAmount"), 0)::numeric(20,4) AS revenue,
          COALESCE(SUM(sc.cogs), 0)::numeric(20,4) AS cogs
        FROM sales s
        LEFT JOIN sale_cogs sc ON sc.sale_id = s.id
        WHERE ${baseWhere}
      `),
    ]);

    const total = totalDaysRows[0]?.count ?? 0;
    const summary = summaryRows[0];
    const summaryRevenue = toDecimal(summary?.revenue);
    const summaryCogs = toDecimal(summary?.cogs);

    return {
      success: true,
      data: dayRows.map((row) => {
        const revenue = toDecimal(row.revenue);
        const cogs = toDecimal(row.cogs);
        return {
          date: row.day.toISOString().slice(0, 10),
          saleCount: row.sale_count,
          revenue,
          cogs,
          grossProfit: revenue.minus(cogs),
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        saleCount: summary?.sale_count ?? 0,
        revenue: summaryRevenue,
        cogs: summaryCogs,
        grossProfit: summaryRevenue.minus(summaryCogs),
      },
    };
  }

  /** All day-buckets for the range in one query — inherently small (at most a few thousand rows even across years), so no batching is needed beyond the util's own single-shot contract. */
  streamProfitReportCsv(
    context: CompanyContext,
    query: DateRangeReportQueryDto,
  ) {
    const baseWhere = this.buildBaseWhere(context, query);
    let served = false;

    return createCsvStream<ProfitReportCsvRow>(
      [
        { header: 'Date', value: (r) => r.date },
        { header: 'Sale Count', value: (r) => r.saleCount },
        { header: 'Revenue', value: (r) => r.revenue.toString() },
        { header: 'COGS', value: (r) => r.cogs.toString() },
        { header: 'Gross Profit', value: (r) => r.grossProfit.toString() },
      ],
      async () => {
        if (served) return [];
        served = true;
        const rows = await this.prisma.$queryRaw<DayRow[]>(Prisma.sql`
          WITH sale_cogs AS (
            SELECT si."saleId" AS sale_id, SUM(si.quantity * si."unitCost") AS cogs
            FROM sale_items si
            GROUP BY si."saleId"
          )
          SELECT
            DATE_TRUNC('day', s."saleDate") AS day,
            COUNT(*)::int AS sale_count,
            COALESCE(SUM(s."totalAmount" - s."taxAmount"), 0)::numeric(20,4) AS revenue,
            COALESCE(SUM(sc.cogs), 0)::numeric(20,4) AS cogs
          FROM sales s
          LEFT JOIN sale_cogs sc ON sc.sale_id = s.id
          WHERE ${baseWhere}
          GROUP BY DATE_TRUNC('day', s."saleDate")
          ORDER BY day ASC
        `);
        return rows.map((row) => {
          const revenue = toDecimal(row.revenue);
          const cogs = toDecimal(row.cogs);
          return {
            date: row.day.toISOString().slice(0, 10),
            saleCount: row.sale_count,
            revenue,
            cogs,
            grossProfit: revenue.minus(cogs),
          };
        });
      },
    );
  }
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(value));
}
