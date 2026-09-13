import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/phase-1-prisma/client';
import {
  CashDrawerSessionStatus,
  LocationStatus,
  PurchaseOrderStatus,
  SaleStatus,
} from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import { NotificationService } from '../notification/notification.service';
import { ProfitReportService } from '../reporting/profit-report.service';
import { parseReportDateRange } from '../reporting/report-date-range.util';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DashboardOverviewQueryDto } from './dto/dashboard-query.dto';

const RECENT_TRANSACTIONS_LIMIT = 8;
const TOP_PRODUCTS_LIMIT = 5;
const ACTION_REQUIRED_LIMIT = 5;

/** Same helper shape as `ProfitReportService`'s own `toDecimal` — converts a raw-SQL numeric column (which Prisma types as `unknown`) into a Decimal. */
function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(value));
}

/**
 * Business Command Center aggregation — every number here is either read
 * straight from an already-maintained running total (Customer.dueBalance,
 * Supplier.payableBalance — same source `LedgerSummaryService` uses) or
 * computed via a real, tenant/company/location-scoped Prisma query. Nothing
 * is fabricated; a section with no underlying data returns an honest empty
 * shape (empty array / zero counts / null), never a fake placeholder value
 * — the frontend decides how to render "no data yet" from that.
 *
 * Reuses `ProfitReportService.getProfitReport()` unchanged for Sales/Orders/
 * Gross Profit/Margin and the daily chart series — the exact same COGS
 * calculation the Profit Report page already shows, so the two screens can
 * never disagree. Location scoping everywhere goes through the shared
 * `LocationAccessService` (the same primitive every other report/business-
 * ops service uses), so a location-restricted staff member sees the exact
 * same "no access" behavior here as on every other page.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationAccessService: LocationAccessService,
    private readonly notificationService: NotificationService,
    private readonly profitReportService: ProfitReportService,
  ) {}

  async getOverview(context: CompanyContext, query: DashboardOverviewQueryDto) {
    const { from, to } = parseReportDateRange(query.dateFrom, query.dateTo);

    if (query.locationId) {
      await this.locationAccessService.assertHasLocationAccess(
        context,
        query.locationId,
      );
    }

    const [allLocations, company] = await Promise.all([
      this.prisma.location.findMany({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          status: LocationStatus.ACTIVE,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      // Every KPI on this page is a money amount — the frontend has no
      // other reliable source for which currency to format it in.
      this.prisma.company.findUniqueOrThrow({
        where: { id: context.companyId },
        select: { baseCurrencyCode: true },
      }),
    ]);

    const assignedIds =
      await this.locationAccessService.getAssignedLocationIds(context);
    const visibleLocations =
      assignedIds === 'ALL'
        ? allLocations
        : allLocations.filter((location) => assignedIds.includes(location.id));

    const hasBranches = visibleLocations.length > 0;
    const isAllBranchesMode = !query.locationId;
    const showBranchPerformance =
      isAllBranchesMode && visibleLocations.length > 1;

    const [
      profitReport,
      receivable,
      payable,
      inventoryHealth,
      topProducts,
      purchaseOverview,
      recentTransactions,
      actionRequired,
      cashPosition,
      branchPerformance,
    ] = await Promise.all([
      this.profitReportService.getProfitReport(context, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        locationId: query.locationId,
        limit: 200, // day-bucketed rows for a date range this wide never realistically exceed this
      }),
      this.getReceivable(context),
      this.getPayable(context),
      this.getInventoryHealth(context, query.locationId),
      this.getTopProducts(context, from, to, query.locationId),
      this.getPurchaseOverview(context, from, to, query.locationId),
      this.getRecentTransactions(context, query.locationId),
      this.notificationService.listForCompany(context, {
        unreadOnly: true,
        page: 1,
        limit: ACTION_REQUIRED_LIMIT,
      }),
      this.getCashPosition(context, query.locationId),
      showBranchPerformance
        ? this.getBranchPerformance(context, from, to)
        : Promise.resolve(null),
    ]);

    const revenue = profitReport.summary.revenue;
    const grossProfit = profitReport.summary.grossProfit;
    const grossMarginPercent = revenue.isZero()
      ? null
      : grossProfit.dividedBy(revenue).times(100).toDecimalPlaces(1).toNumber();

    return {
      success: true,
      data: {
        currencyCode: company.baseCurrencyCode,
        scope: {
          hasBranches,
          locations: visibleLocations,
          selectedLocationId: query.locationId ?? null,
        },
        kpis: {
          sales: revenue,
          orders: profitReport.summary.saleCount,
          grossProfit,
          grossMarginPercent,
          receivable,
          payable,
        },
        salesPerformance: profitReport.data.map((day) => ({
          date: day.date,
          sales: day.revenue,
          orders: day.saleCount,
          grossProfit: day.grossProfit,
        })),
        inventoryHealth,
        topProducts,
        purchaseOverview,
        recentTransactions,
        actionRequired: actionRequired.data,
        cashPosition,
        branchPerformance,
      },
    };
  }

  private async getReceivable(context: CompanyContext) {
    const result = await this.prisma.customer.aggregate({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        dueBalance: { not: 0 },
      },
      _sum: { dueBalance: true },
      _count: true,
    });
    return {
      total: result._sum.dueBalance ?? new Prisma.Decimal(0),
      customerCount: result._count,
    };
  }

  private async getPayable(context: CompanyContext) {
    const result = await this.prisma.supplier.aggregate({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        payableBalance: { not: 0 },
      },
      _sum: { payableBalance: true },
      _count: true,
    });
    return {
      total: result._sum.payableBalance ?? new Prisma.Decimal(0),
      supplierCount: result._count,
    };
  }

  /** Same explicit-vs-implicit Location scoping rule every other report service uses. */
  private async resolveLocationFilter(
    context: CompanyContext,
    explicitLocationId?: string,
  ): Promise<{ locationId?: string | { in: string[] } }> {
    if (explicitLocationId) return { locationId: explicitLocationId };
    const assigned =
      await this.locationAccessService.getAssignedLocationIds(context);
    return assigned === 'ALL' ? {} : { locationId: { in: assigned } };
  }

  private async getInventoryHealth(
    context: CompanyContext,
    explicitLocationId?: string,
  ) {
    const locationFilter = await this.resolveLocationFilter(
      context,
      explicitLocationId,
    );

    const [valueRows, totalProducts, lowStockRows, outOfStock] =
      await Promise.all([
        this.prisma.$queryRaw<{ value: unknown }[]>(Prisma.sql`
          SELECT COALESCE(SUM(i.quantity * p."costPrice"), 0)::numeric(20,4) AS value
          FROM inventory i
          JOIN products p ON p.id = i."productId"
          WHERE i."tenantId" = ${context.tenantId}::uuid
            AND i."companyId" = ${context.companyId}::uuid
            ${
              locationFilter.locationId
                ? typeof locationFilter.locationId === 'string'
                  ? Prisma.sql`AND i."locationId" = ${locationFilter.locationId}::uuid`
                  : Prisma.sql`AND i."locationId" IN (${Prisma.join(
                      locationFilter.locationId.in.map(
                        (id) => Prisma.sql`${id}::uuid`,
                      ),
                    )})`
                : Prisma.empty
            }
        `),
        this.prisma.product.count({
          where: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            status: 'ACTIVE',
          },
        }),
        this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM inventory i
          JOIN products p ON p.id = i."productId"
          WHERE i."tenantId" = ${context.tenantId}::uuid
            AND i."companyId" = ${context.companyId}::uuid
            AND p.status = 'ACTIVE'
            AND i.quantity > 0
            AND i.quantity < p."reorderLevel"
            ${
              locationFilter.locationId
                ? typeof locationFilter.locationId === 'string'
                  ? Prisma.sql`AND i."locationId" = ${locationFilter.locationId}::uuid`
                  : Prisma.sql`AND i."locationId" IN (${Prisma.join(
                      locationFilter.locationId.in.map(
                        (id) => Prisma.sql`${id}::uuid`,
                      ),
                    )})`
                : Prisma.empty
            }
        `),
        this.prisma.inventory.count({
          where: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            quantity: 0,
            ...locationFilter,
          },
        }),
      ]);

    return {
      inventoryValue: toDecimal(valueRows[0]?.value),
      totalProducts,
      lowStock: lowStockRows[0]?.count ?? 0,
      outOfStock,
    };
  }

  private async getTopProducts(
    context: CompanyContext,
    from: Date,
    to: Date,
    explicitLocationId?: string,
  ) {
    if (explicitLocationId) {
      await this.locationAccessService.assertHasLocationAccess(
        context,
        explicitLocationId,
      );
    }
    const assigned =
      await this.locationAccessService.getAssignedLocationIds(context);
    if (!explicitLocationId && assigned !== 'ALL' && assigned.length === 0) {
      return [];
    }

    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          status: SaleStatus.COMPLETED,
          saleDate: { gte: from, lte: to },
          ...(explicitLocationId
            ? { locationId: explicitLocationId }
            : assigned === 'ALL'
              ? {}
              : { locationId: { in: assigned } }),
        },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: TOP_PRODUCTS_LIMIT,
    });

    if (grouped.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((row) => row.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    return grouped.map((row) => ({
      productId: row.productId,
      name: productById.get(row.productId)?.name ?? 'Unknown product',
      sku: productById.get(row.productId)?.sku ?? '',
      quantitySold: row._sum.quantity ?? new Prisma.Decimal(0),
      revenue: row._sum.subtotal ?? new Prisma.Decimal(0),
    }));
  }

  private async getPurchaseOverview(
    context: CompanyContext,
    from: Date,
    to: Date,
    explicitLocationId?: string,
  ) {
    const locationFilter = await this.resolveLocationFilter(
      context,
      explicitLocationId,
    );

    const result = await this.prisma.purchaseOrder.aggregate({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        orderDate: { gte: from, lte: to },
        status: {
          in: [
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.FULLY_RECEIVED,
          ],
        },
        ...locationFilter,
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    return {
      totalPurchases: result._sum.totalAmount ?? new Prisma.Decimal(0),
      purchaseOrderCount: result._count,
    };
  }

  private async getRecentTransactions(
    context: CompanyContext,
    explicitLocationId?: string,
  ) {
    const locationFilter = await this.resolveLocationFilter(
      context,
      explicitLocationId,
    );

    const [sales, purchases] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          ...locationFilter,
        },
        select: {
          id: true,
          saleNumber: true,
          totalAmount: true,
          status: true,
          saleDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { saleDate: 'desc' },
        take: RECENT_TRANSACTIONS_LIMIT,
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          ...locationFilter,
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          orderDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { orderDate: 'desc' },
        take: RECENT_TRANSACTIONS_LIMIT,
      }),
    ]);

    const merged = [
      ...sales.map((sale) => ({
        id: sale.id,
        type: 'SALE' as const,
        reference: sale.saleNumber,
        party: sale.customer?.name ?? null,
        amount: sale.totalAmount,
        status: sale.status,
        date: sale.saleDate,
      })),
      ...purchases.map((purchase) => ({
        id: purchase.id,
        type: 'PURCHASE' as const,
        reference: purchase.orderNumber,
        party: purchase.supplier.name,
        amount: purchase.totalAmount,
        status: purchase.status,
        date: purchase.orderDate,
      })),
    ];

    return merged
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, RECENT_TRANSACTIONS_LIMIT);
  }

  /**
   * Deliberately NOT a full expected-vs-actual reconciliation (that
   * computation belongs to Cash Drawer close, and re-deriving it here risks
   * double-counting across locations, exactly the mistake the spec warns
   * against). This reports only what's verifiably real right now: how many
   * drawers are currently open and their combined opening float.
   */
  private async getCashPosition(
    context: CompanyContext,
    explicitLocationId?: string,
  ) {
    const locationFilter = await this.resolveLocationFilter(
      context,
      explicitLocationId,
    );

    const result = await this.prisma.cashDrawerSession.aggregate({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        status: CashDrawerSessionStatus.OPEN,
        ...locationFilter,
      },
      _sum: { openingBalance: true },
      _count: true,
    });

    return {
      openSessionCount: result._count,
      totalOpeningFloat: result._sum.openingBalance ?? new Prisma.Decimal(0),
    };
  }

  /** Only called in "All Branches" mode with >1 visible location — mirrors ProfitReportService's own day-bucketed raw-SQL shape, grouped by location instead of by day. */
  private async getBranchPerformance(
    context: CompanyContext,
    from: Date,
    to: Date,
  ) {
    const assigned =
      await this.locationAccessService.getAssignedLocationIds(context);
    const locationFilter =
      assigned === 'ALL'
        ? Prisma.empty
        : assigned.length === 0
          ? Prisma.sql`AND FALSE`
          : Prisma.sql`AND s."locationId" IN (${Prisma.join(
              assigned.map((id) => Prisma.sql`${id}::uuid`),
            )})`;

    const rows = await this.prisma.$queryRaw<
      {
        locationId: string;
        locationName: string;
        saleCount: number;
        revenue: unknown;
        cogs: unknown;
      }[]
    >(Prisma.sql`
      WITH sale_cogs AS (
        SELECT si."saleId" AS sale_id, SUM(si.quantity * si."unitCost") AS cogs
        FROM sale_items si
        GROUP BY si."saleId"
      )
      SELECT
        s."locationId" AS "locationId",
        l.name AS "locationName",
        COUNT(*)::int AS "saleCount",
        COALESCE(SUM(s."totalAmount" - s."taxAmount"), 0)::numeric(20,4) AS revenue,
        COALESCE(SUM(sc.cogs), 0)::numeric(20,4) AS cogs
      FROM sales s
      JOIN locations l ON l.id = s."locationId"
      LEFT JOIN sale_cogs sc ON sc.sale_id = s.id
      WHERE s."tenantId" = ${context.tenantId}::uuid
        AND s."companyId" = ${context.companyId}::uuid
        AND s.status = 'COMPLETED'
        AND s."saleDate" >= ${from}
        AND s."saleDate" <= ${to}
        ${locationFilter}
      GROUP BY s."locationId", l.name
      ORDER BY revenue DESC
    `);

    return rows.map((row) => {
      const revenue = toDecimal(row.revenue);
      const cogs = toDecimal(row.cogs);
      return {
        locationId: row.locationId,
        name: row.locationName,
        sales: revenue,
        orders: row.saleCount,
        grossProfit: revenue.minus(cogs),
      };
    });
  }
}
