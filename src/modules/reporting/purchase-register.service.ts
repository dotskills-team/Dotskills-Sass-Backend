import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PurchaseOrderStatus } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DateRangeReportQueryDto } from './dto/report-query.dto';
import { parseReportDateRange } from './report-date-range.util';
import { createCsvStream } from './csv-stream.util';

const PURCHASE_REGISTER_SELECT = {
  id: true,
  orderNumber: true,
  orderDate: true,
  locationId: true,
  supplierId: true,
  status: true,
  totalAmount: true,
  _count: { select: { receipts: true, returns: true } },
} satisfies Prisma.PurchaseOrderSelect;

/**
 * Mirrors SaleRegisterService exactly. Listing includes every status; the
 * summary total excludes CANCELLED orders only — the purchase-side
 * equivalent of Sale Register excluding VOIDED sales from its summary.
 */
@Injectable()
export class PurchaseRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(context: CompanyContext, query: Pick<DateRangeReportQueryDto, 'dateFrom' | 'dateTo' | 'locationId'>): Prisma.PurchaseOrderWhereInput {
    const { from, to } = parseReportDateRange(query.dateFrom, query.dateTo);
    return {
      tenantId: context.tenantId,
      companyId: context.companyId,
      orderDate: { gte: from, lte: to },
      ...(query.locationId ? { locationId: query.locationId } : {}),
    };
  }

  async getPurchaseRegister(context: CompanyContext, query: DateRangeReportQueryDto) {
    const where = this.buildWhere(context, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({ where, select: PURCHASE_REGISTER_SELECT, orderBy: { orderDate: 'asc' }, skip, take: limit }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const notCancelledWhere: Prisma.PurchaseOrderWhereInput = { ...where, status: { not: PurchaseOrderStatus.CANCELLED } };
    const aggregate = await this.prisma.purchaseOrder.aggregate({ where: notCancelledWhere, _sum: { totalAmount: true }, _count: true });

    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        activeOrdersCount: aggregate._count,
        totalOrderedValue: aggregate._sum.totalAmount ?? new Prisma.Decimal(0),
      },
    };
  }

  streamPurchaseRegisterCsv(context: CompanyContext, query: DateRangeReportQueryDto) {
    const where = this.buildWhere(context, query);
    return createCsvStream(
      [
        { header: 'Order Number', value: (r: any) => r.orderNumber },
        { header: 'Order Date', value: (r: any) => r.orderDate.toISOString() },
        { header: 'Location Id', value: (r: any) => r.locationId },
        { header: 'Supplier Id', value: (r: any) => r.supplierId },
        { header: 'Status', value: (r: any) => r.status },
        { header: 'Total Amount', value: (r: any) => r.totalAmount.toString() },
        { header: 'Receipts', value: (r: any) => r._count.receipts },
        { header: 'Returns', value: (r: any) => r._count.returns },
      ],
      (skip, take) => this.prisma.purchaseOrder.findMany({ where, select: PURCHASE_REGISTER_SELECT, orderBy: { orderDate: 'asc' }, skip, take }),
    );
  }
}
