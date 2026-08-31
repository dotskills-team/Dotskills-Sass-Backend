import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { SaleStatus } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DateRangeReportQueryDto } from './dto/report-query.dto';
import { parseReportDateRange } from './report-date-range.util';
import { createCsvStream } from './csv-stream.util';

const SALE_REGISTER_SELECT = {
  id: true,
  saleNumber: true,
  saleDate: true,
  locationId: true,
  customerId: true,
  processedByUserId: true,
  status: true,
  subtotal: true,
  itemDiscountTotal: true,
  saleDiscountAmount: true,
  taxAmount: true,
  totalAmount: true,
} satisfies Prisma.SaleSelect;

/**
 * Location-based when `locationId` is supplied, Consolidated (all
 * Locations) otherwise — a single query shape serves both modes from the
 * design doc's Section 10. Listing includes every status (a register is a
 * complete record); the summary/payment-breakdown counts COMPLETED sales
 * only, mirroring the same rule Phase 5's Cash Drawer close already uses.
 */
@Injectable()
export class SaleRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    context: CompanyContext,
    query: Pick<DateRangeReportQueryDto, 'dateFrom' | 'dateTo' | 'locationId'>,
  ): Prisma.SaleWhereInput {
    const { from, to } = parseReportDateRange(query.dateFrom, query.dateTo);
    return {
      tenantId: context.tenantId,
      companyId: context.companyId,
      saleDate: { gte: from, lte: to },
      ...(query.locationId ? { locationId: query.locationId } : {}),
    };
  }

  async getSaleRegister(
    context: CompanyContext,
    query: DateRangeReportQueryDto,
  ) {
    const where = this.buildWhere(context, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        select: SALE_REGISTER_SELECT,
        orderBy: { saleDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    const completedWhere: Prisma.SaleWhereInput = {
      ...where,
      status: SaleStatus.COMPLETED,
    };
    const [aggregate, paymentBreakdown] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({
        where: completedWhere,
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.salePayment.groupBy({
        by: ['method'],
        where: { sale: completedWhere },
        _sum: { amount: true },
        orderBy: { method: 'asc' },
      }),
    ]);

    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        completedSalesCount: aggregate._count,
        totalRevenue: aggregate._sum.totalAmount ?? new Prisma.Decimal(0),
        paymentBreakdown: paymentBreakdown.map((p) => ({
          method: p.method,
          amount: p._sum?.amount ?? new Prisma.Decimal(0),
        })),
      },
    };
  }

  /** Streams the full date-range result (every status, matching the on-screen listing) — never paginated, never buffered in full. */
  streamSaleRegisterCsv(
    context: CompanyContext,
    query: DateRangeReportQueryDto,
  ) {
    const where = this.buildWhere(context, query);
    return createCsvStream(
      [
        { header: 'Sale Number', value: (r: any) => r.saleNumber },
        { header: 'Date', value: (r: any) => r.saleDate.toISOString() },
        { header: 'Location Id', value: (r: any) => r.locationId },
        { header: 'Customer Id', value: (r: any) => r.customerId ?? '' },
        { header: 'Status', value: (r: any) => r.status },
        { header: 'Subtotal', value: (r: any) => r.subtotal.toString() },
        {
          header: 'Item Discount',
          value: (r: any) => r.itemDiscountTotal.toString(),
        },
        {
          header: 'Sale Discount',
          value: (r: any) => r.saleDiscountAmount.toString(),
        },
        { header: 'Tax', value: (r: any) => r.taxAmount.toString() },
        { header: 'Total', value: (r: any) => r.totalAmount.toString() },
      ],
      (skip, take) =>
        this.prisma.sale.findMany({
          where,
          select: SALE_REGISTER_SELECT,
          orderBy: { saleDate: 'asc' },
          skip,
          take,
        }),
    );
  }
}
