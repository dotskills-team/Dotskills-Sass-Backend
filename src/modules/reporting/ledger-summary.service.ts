import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { PaginationQueryDto } from './dto/report-query.dto';
import { createCsvStream } from './csv-stream.util';

/**
 * "Who owes / is owed how much, right now" — reads Customer.dueBalance and
 * Supplier.payableBalance directly (already-maintained running totals,
 * Section 12.1), never re-sums CustomerDueLedger/SupplierPayableLedger.
 * The per-party ledger *detail* drill-down already exists unchanged from
 * Phase 3/4 (customer-payments / supplier-payments list endpoints).
 */
@Injectable()
export class LedgerSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerDueSummary(
    context: CompanyContext,
    query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      dueBalance: { not: 0 },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true, dueBalance: true },
        orderBy: { dueBalance: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  streamCustomerDueSummaryCsv(context: CompanyContext) {
    const where = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      dueBalance: { not: 0 },
    };
    return createCsvStream(
      [
        { header: 'Customer Name', value: (r: any) => r.name },
        { header: 'Phone', value: (r: any) => r.phone ?? '' },
        { header: 'Due Balance', value: (r: any) => r.dueBalance.toString() },
      ],
      (skip, take) =>
        this.prisma.customer.findMany({
          where,
          select: { name: true, phone: true, dueBalance: true },
          orderBy: { dueBalance: 'desc' },
          skip,
          take,
        }),
    );
  }

  async getSupplierPayableSummary(
    context: CompanyContext,
    query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      payableBalance: { not: 0 },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        select: { id: true, name: true, phone: true, payableBalance: true },
        orderBy: { payableBalance: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  streamSupplierPayableSummaryCsv(context: CompanyContext) {
    const where = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      payableBalance: { not: 0 },
    };
    return createCsvStream(
      [
        { header: 'Supplier Name', value: (r: any) => r.name },
        { header: 'Phone', value: (r: any) => r.phone ?? '' },
        {
          header: 'Payable Balance',
          value: (r: any) => r.payableBalance.toString(),
        },
      ],
      (skip, take) =>
        this.prisma.supplier.findMany({
          where,
          select: { name: true, phone: true, payableBalance: true },
          orderBy: { payableBalance: 'desc' },
          skip,
          take,
        }),
    );
  }
}
