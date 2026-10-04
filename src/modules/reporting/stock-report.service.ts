import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { ProductStatus } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { StockReportQueryDto } from './dto/report-query.dto';
import { createCsvStream } from './csv-stream.util';

import { BadRequestException} from '@nestjs/common';
import { parseReportDateRange } from './report-date-range.util';

interface SalesStatsRaw {
  productId: string;
  variantId: string | null;
  locationId: string;
  soldQuantity: string;
  soldAmount: string;
  saleCount: number;
}

export interface ProductSalesStats {
  soldQuantity: Prisma.Decimal;
  soldAmount: Prisma.Decimal;
  saleCount: number;
  avgSellingPrice: Prisma.Decimal | null;
}

interface StockRowKey {
  productId: string;
  variantId: string | null;
  locationId: string;
}
interface BelowReorderRow {
  id: string;
  productId: string;
  variantId: string | null;
  locationId: string;
  quantity: unknown;
  productName: string;
  sku: string;
  variantSku: string | null;
  variantAttributes: string | null;
  reorderLevel: unknown;
  locationName: string;
}

/** Shared select fragment for a variant's identifying info — reused by both the plain listing and CSV export so a row can be labeled "T-Shirt — Red / S" instead of a bare product name whenever it's one of several variant rows for the same product. */
const VARIANT_SELECT = {
  id: true,
  sku: true,
  attributeValues: {
    select: {
      attributeValue: {
        select: { value: true, attribute: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.ProductVariantSelect;

type SelectedVariant = Prisma.ProductVariantGetPayload<{
  select: typeof VARIANT_SELECT;
}>;

/**
 * "Red / S" from a variant's attribute values, alphabetized by attribute
 * name for a stable, predictable order (an unordered join set otherwise
 * has no inherent display order) — never depends on the order values were
 * originally attached in.
 */
function formatVariantLabel(variant: SelectedVariant): string {
  return variant.attributeValues
    .map((v) => v.attributeValue)
    .sort((a, b) => a.attribute.name.localeCompare(b.attribute.name))
    .map((v) => v.value)
    .join(' / ');
}

/** "T-Shirt" for a non-variant product, "T-Shirt — Red / S" for a variant row — so two variant rows of the same product are never indistinguishable in a report. */
function formatDisplayName(
  productName: string,
  variant: SelectedVariant | null,
): string {
  return variant
    ? `${productName} — ${formatVariantLabel(variant)}`
    : productName;
}

/** Same as formatDisplayName, for the raw-SQL below-reorder path where the label already arrives pre-joined as a single "Red / S" string (or null) rather than a nested Prisma object. */
function formatDisplayNameFromRawLabel(
  productName: string,
  variantAttributes: string | null,
): string {
  return variantAttributes
    ? `${productName} — ${variantAttributes}`
    : productName;
}

/**
 * Pre-aggregates one variant's attribute values into a single "Red / S"
 * string via a correlated subquery, ordered by attribute name for the
 * same stable order `formatVariantLabel` uses — needed because raw SQL
 * has no equivalent of Prisma's nested-select-then-map-in-JS approach.
 */
const VARIANT_ATTRIBUTES_SUBQUERY = Prisma.sql`(
  SELECT string_agg(vav.value, ' / ' ORDER BY va.name)
  FROM product_variant_attribute_values pvav
  JOIN variant_attribute_values vav ON vav.id = pvav."attributeValueId"
  JOIN variant_attributes va ON va.id = vav."attributeId"
  WHERE pvav."variantId" = v.id
)`;

/**
 * Point-in-time snapshot over Inventory's already-maintained running
 * balance (Section 12.1) — never re-sums StockMovement. No date range.
 *
 * belowReorderOnly needs raw SQL: Prisma's query builder cannot filter one
 * column against another column on a joined table (quantity < product's
 * reorderLevel), only against a literal. The plain listing mode doesn't
 * need this — it computes the belowReorderLevel flag for display in JS
 * after fetching, which is fine when it's not also the WHERE filter.
 */
@Injectable()
export class StockReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationAccessService: LocationAccessService,
  ) {}

  /** Same explicit-vs-implicit rule as the other reports, for a plain Prisma `where` clause. */
  private async resolveLocationFilter(
    context: CompanyContext,
    explicitLocationId?: string,
  ): Promise<Pick<Prisma.InventoryWhereInput, 'locationId'>> {
    if (explicitLocationId) {
      await this.locationAccessService.assertHasLocationAccess(
        context,
        explicitLocationId,
      );
      return { locationId: explicitLocationId };
    }
    const assigned =
      await this.locationAccessService.getAssignedLocationIds(context);
    return assigned === 'ALL' ? {} : { locationId: { in: assigned } };
  }

  /**
   * Same rule as `resolveLocationFilter`, as a raw SQL fragment for the
   * belowReorderOnly path (Prisma's query builder can't filter one column
   * against another joined column). An actor assigned to zero Locations
   * must match zero rows — `IN ()` is invalid Postgres syntax, so that
   * case is a literal `AND FALSE` rather than an empty IN-list.
   */
  private async resolveLocationSql(
    context: CompanyContext,
    explicitLocationId?: string,
  ): Promise<Prisma.Sql> {
    if (explicitLocationId) {
      await this.locationAccessService.assertHasLocationAccess(
        context,
        explicitLocationId,
      );
      return Prisma.sql`AND i."locationId" = ${explicitLocationId}::uuid`;
    }
    const assigned =
      await this.locationAccessService.getAssignedLocationIds(context);
    if (assigned === 'ALL') return Prisma.empty;
    if (assigned.length === 0) return Prisma.sql`AND FALSE`;
    return Prisma.sql`AND i."locationId" IN (${Prisma.join(
      assigned.map((id) => Prisma.sql`${id}::uuid`),
    )})`;
  }
  /** null = no sales window requested. */
  private parseSalesRange(query: StockReportQueryDto) {
    if (!query.dateFrom && !query.dateTo) return null;
    if (!query.dateFrom || !query.dateTo) {
      throw new BadRequestException(
        'dateFrom and dateTo must be provided together',
      );
    }
    const range = parseReportDateRange(query.dateFrom, query.dateTo);
    const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
    if (days > 366) {
      throw new BadRequestException('Sales range cannot exceed 366 days');
    }
    return range;
  }

  /**
   * Adds a `sales` block per stock row (product + variant + location) for the
   * date range. One aggregate query per page. COMPLETED sales only; qty
   * normalized to base unit; amount = SUM(SaleItem.subtotal). Returns not netted.
   */
  private async attachSalesStats<T extends StockRowKey>(
    context: CompanyContext,
    query: StockReportQueryDto,
    rows: T[],
  ): Promise<Array<T & { sales?: ProductSalesStats }>> {
    const range = this.parseSalesRange(query);
    if (!range || rows.length === 0) return rows;

    const productIds = [...new Set(rows.map((r) => r.productId))];
    const locationIds = [...new Set(rows.map((r) => r.locationId))];

    const stats = await this.prisma.$queryRaw<SalesStatsRaw[]>(Prisma.sql`
      SELECT
        si."productId" AS "productId",
        si."variantId" AS "variantId",
        s."locationId" AS "locationId",
        SUM(si.quantity * COALESCE(u."conversionFactor", 1))::text AS "soldQuantity",
        SUM(si.subtotal)::text AS "soldAmount",
        COUNT(DISTINCT si."saleId")::int AS "saleCount"
      FROM sale_items si
      JOIN sales s ON s.id = si."saleId"
      LEFT JOIN units u ON u.id = si."unitId"
      WHERE s."tenantId" = ${context.tenantId}::uuid
        AND s."companyId" = ${context.companyId}::uuid
        AND s."status" = 'COMPLETED'
        AND s."saleDate" >= ${range.from}
        AND s."saleDate" <= ${range.to}
        AND si."productId" IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND s."locationId" IN (${Prisma.join(locationIds.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY si."productId", si."variantId", s."locationId"
    `);

    const key = (p: string, v: string | null, l: string) =>
      `${p}:${v ?? ''}:${l}`;
    const byKey = new Map(
      stats.map((s) => [key(s.productId, s.variantId, s.locationId), s]),
    );

    return rows.map((row) => {
      const s = byKey.get(key(row.productId, row.variantId, row.locationId));
      const soldQuantity = new Prisma.Decimal(s?.soldQuantity ?? '0');
      const soldAmount = new Prisma.Decimal(s?.soldAmount ?? '0');
      return {
        ...row,
        sales: {
          soldQuantity,
          soldAmount,
          saleCount: s?.saleCount ?? 0,
          avgSellingPrice: soldQuantity.gt(0)
            ? soldAmount.div(soldQuantity).toDecimalPlaces(4)
            : null,
        },
      };
    });
  }
  async getStockReport(context: CompanyContext, query: StockReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    if (query.belowReorderOnly) {
      return this.getBelowReorderReport(context, query, page, limit, skip);
    }

    const locationFilter = await this.resolveLocationFilter(
      context,
      query.locationId,
    );
    const where: Prisma.InventoryWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      ...locationFilter,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        select: {
          id: true,
          productId: true,
          variantId: true,
          locationId: true,
          quantity: true,
          product: {
            select: { name: true, sku: true, reorderLevel: true, status: true },
          },
          variant: { select: VARIANT_SELECT },
          location: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    // return {
    //   success: true,
    //   data: items.map((row) => ({
    //     ...row,
    //     displayName: formatDisplayName(row.product.name, row.variant),
    //     belowReorderLevel: row.quantity.lessThan(row.product.reorderLevel),
    //   })),
    //   pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    // };
        const itemsWithSales = await this.attachSalesStats(context, query, items);

    return {
      success: true,
      data: itemsWithSales.map((row) => ({
        ...row,
        displayName: formatDisplayName(row.product.name, row.variant),
        belowReorderLevel: row.quantity.lessThan(row.product.reorderLevel),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private async getBelowReorderReport(
    context: CompanyContext,
    query: StockReportQueryDto,
    page: number,
    limit: number,
    skip: number,
  ) {
    const locationFilter = await this.resolveLocationSql(
      context,
      query.locationId,
    );
    const baseWhere = Prisma.sql`
      i."tenantId" = ${context.tenantId}::uuid
      AND i."companyId" = ${context.companyId}::uuid
      AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
      AND i.quantity < p."reorderLevel"
      ${locationFilter}
      ${query.variantId ? Prisma.sql`AND i."variantId" = ${query.variantId}::uuid` : Prisma.empty}
    `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<BelowReorderRow[]>(Prisma.sql`
        SELECT
          i.id AS id,
          i."productId" AS "productId",
          i."variantId" AS "variantId",
          i."locationId" AS "locationId",
          i.quantity AS quantity,
          p.name AS "productName",
          p.sku AS sku,
          v.sku AS "variantSku",
          ${VARIANT_ATTRIBUTES_SUBQUERY} AS "variantAttributes",
          p."reorderLevel" AS "reorderLevel",
          l.name AS "locationName"
        FROM inventory i
        JOIN products p ON p.id = i."productId"
        LEFT JOIN product_variants v ON v.id = i."variantId"
        JOIN locations l ON l.id = i."locationId"
        WHERE ${baseWhere}
        ORDER BY i."updatedAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM inventory i
        JOIN products p ON p.id = i."productId"
        WHERE ${baseWhere}
      `),
    ]);

    const total = countRows[0]?.count ?? 0;
    const data = await this.attachSalesStats(
      context,
      query,
      rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        locationId: row.locationId,
        quantity: new Prisma.Decimal(String(row.quantity)),
        product: {
          name: row.productName,
          sku: row.sku,
          reorderLevel: new Prisma.Decimal(String(row.reorderLevel)),
        },
        variantSku: row.variantSku,
        displayName: formatDisplayNameFromRawLabel(
          row.productName,
          row.variantAttributes,
        ),
        location: { name: row.locationName },
        belowReorderLevel: true,
      })),
    );

    return {
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    // return {
    //   success: true,
    //   data: rows.map((row) => ({
    //     id: row.id,
    //     productId: row.productId,
    //     variantId: row.variantId,
    //     locationId: row.locationId,
    //     quantity: new Prisma.Decimal(String(row.quantity)),
    //     product: {
    //       name: row.productName,
    //       sku: row.sku,
    //       reorderLevel: new Prisma.Decimal(String(row.reorderLevel)),
    //     },
    //     variantSku: row.variantSku,
    //     displayName: formatDisplayNameFromRawLabel(
    //       row.productName,
    //       row.variantAttributes,
    //     ),
    //     location: { name: row.locationName },
    //     belowReorderLevel: true,
    //   })),
    //   pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    // };
  }

  // async streamStockReportCsv(
  //   context: CompanyContext,
  //   query: StockReportQueryDto,
  // ) {
  //   const baseColumns = [
  //     {
  //       header: 'Product Name',
  //       value: (r: any) => r.product?.name ?? r.productName,
  //     },
  //     { header: 'SKU', value: (r: any) => r.product?.sku ?? r.sku },
  //     {
  //       header: 'Variant',
  //       value: (r: any) =>
  //         r.variant
  //           ? formatVariantLabel(r.variant)
  //           : (r.variantAttributes ?? ''),
  //     },
  //     {
  //       header: 'Location',
  //       value: (r: any) => r.location?.name ?? r.locationName,
  //     },
  //     { header: 'Quantity', value: (r: any) => r.quantity.toString() },
  //     {
  //       header: 'Reorder Level',
  //       value: (r: any) =>
  //         (r.product?.reorderLevel ?? r.reorderLevel).toString(),
  //     },
  //     {
  //       header: 'Below Reorder Level',
  //       value: (r: any) => (r.belowReorderLevel ? 'YES' : 'NO'),
  //     },
  //   ];

  //   const salesColumns = this.parseSalesRange(query)
  //     ? [
  //         { header: 'Sold Qty', value: (r: any) => r.sales?.soldQuantity.toString() ?? '0' },
  //         { header: 'Sold Amount', value: (r: any) => r.sales?.soldAmount.toString() ?? '0' },
  //         { header: 'No. of Sales', value: (r: any) => String(r.sales?.saleCount ?? 0) },
  //         { header: 'Avg Price / Unit', value: (r: any) => r.sales?.avgSellingPrice?.toString() ?? '' },
  //       ]
  //     : [];
  //   const columns = [...baseColumns, ...salesColumns];


  //   if (query.belowReorderOnly) {
  //     const locationFilter = await this.resolveLocationSql(
  //       context,
  //       query.locationId,
  //     );
  //     const baseWhere = Prisma.sql`
  //       i."tenantId" = ${context.tenantId}::uuid
  //       AND i."companyId" = ${context.companyId}::uuid
  //       AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
  //       AND i.quantity < p."reorderLevel"
  //       ${locationFilter}
  //       ${query.variantId ? Prisma.sql`AND i."variantId" = ${query.variantId}::uuid` : Prisma.empty}
  //     `;
  //     return createCsvStream(columns, (skip, take) =>
  //       this.prisma
  //         .$queryRaw<BelowReorderRow[]>(
  //           Prisma.sql`
  //         SELECT i.id AS id, i."productId" AS "productId", i."variantId" AS "variantId", i."locationId" AS "locationId", i.quantity AS quantity,
  //                p.name AS "productName", p.sku AS sku, v.sku AS "variantSku", ${VARIANT_ATTRIBUTES_SUBQUERY} AS "variantAttributes",
  //                p."reorderLevel" AS "reorderLevel", l.name AS "locationName"
  //         FROM inventory i
  //         JOIN products p ON p.id = i."productId"
  //         LEFT JOIN product_variants v ON v.id = i."variantId"
  //         JOIN locations l ON l.id = i."locationId"
  //         WHERE ${baseWhere}
  //         ORDER BY i."updatedAt" DESC
  //         LIMIT ${take} OFFSET ${skip}
  //       `,
  //         )
  //         .then((rows) =>
  //           rows.map((row) => ({
  //             ...row,
  //             quantity: new Prisma.Decimal(String(row.quantity)),
  //             belowReorderLevel: true,
  //           })),
  //         ),
  //     );
  //   }

  //   const locationFilter = await this.resolveLocationFilter(
  //     context,
  //     query.locationId,
  //   );
  //   const where: Prisma.InventoryWhereInput = {
  //     tenantId: context.tenantId,
  //     companyId: context.companyId,
  //     ...locationFilter,
  //   };
  //   return createCsvStream(columns, (skip, take) =>
  //     this.prisma.inventory
  //       .findMany({
  //         where,
  //         select: {
  //           quantity: true,
  //           product: { select: { name: true, sku: true, reorderLevel: true } },
  //           variant: { select: VARIANT_SELECT },
  //           location: { select: { name: true } },
  //         },
  //         orderBy: { updatedAt: 'desc' },
  //         skip,
  //         take,
  //       })
  //       .then((rows) =>
  //         rows.map((row) => ({
  //           ...row,
  //           belowReorderLevel: row.quantity.lessThan(row.product.reorderLevel),
  //         })),
  //       ),
  //   );
  // }
    async streamStockReportCsv(
    context: CompanyContext,
    query: StockReportQueryDto,
  ) {
    const baseColumns = [
      {
        header: 'Product Name',
        value: (r: any) => r.product?.name ?? r.productName,
      },
      { header: 'SKU', value: (r: any) => r.product?.sku ?? r.sku },
      {
        header: 'Variant',
        value: (r: any) =>
          r.variant
            ? formatVariantLabel(r.variant)
            : (r.variantAttributes ?? ''),
      },
      {
        header: 'Location',
        value: (r: any) => r.location?.name ?? r.locationName,
      },
      { header: 'Quantity', value: (r: any) => r.quantity.toString() },
      {
        header: 'Reorder Level',
        value: (r: any) =>
          (r.product?.reorderLevel ?? r.reorderLevel).toString(),
      },
      {
        header: 'Below Reorder Level',
        value: (r: any) => (r.belowReorderLevel ? 'YES' : 'NO'),
      },
    ];

    // Sales columns appear only when a date range was requested.
    const salesColumns = this.parseSalesRange(query)
      ? [
          {
            header: 'Sold Qty',
            value: (r: any) => r.sales?.soldQuantity.toString() ?? '0',
          },
          {
            header: 'Sold Amount',
            value: (r: any) => r.sales?.soldAmount.toString() ?? '0',
          },
          {
            header: 'No. of Sales',
            value: (r: any) => String(r.sales?.saleCount ?? 0),
          },
          {
            header: 'Avg Price / Unit',
            value: (r: any) => r.sales?.avgSellingPrice?.toString() ?? '',
          },
        ]
      : [];
    const columns = [...baseColumns, ...salesColumns];

    if (query.belowReorderOnly) {
      const locationFilter = await this.resolveLocationSql(
        context,
        query.locationId,
      );
      const baseWhere = Prisma.sql`
        i."tenantId" = ${context.tenantId}::uuid
        AND i."companyId" = ${context.companyId}::uuid
        AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
        AND i.quantity < p."reorderLevel"
        ${locationFilter}
        ${query.variantId ? Prisma.sql`AND i."variantId" = ${query.variantId}::uuid` : Prisma.empty}
      `;
      return createCsvStream(columns, (skip, take) =>
        this.prisma
          .$queryRaw<BelowReorderRow[]>(
            Prisma.sql`
          SELECT i.id AS id, i."productId" AS "productId", i."variantId" AS "variantId", i."locationId" AS "locationId", i.quantity AS quantity,
                 p.name AS "productName", p.sku AS sku, v.sku AS "variantSku", ${VARIANT_ATTRIBUTES_SUBQUERY} AS "variantAttributes",
                 p."reorderLevel" AS "reorderLevel", l.name AS "locationName"
          FROM inventory i
          JOIN products p ON p.id = i."productId"
          LEFT JOIN product_variants v ON v.id = i."variantId"
          JOIN locations l ON l.id = i."locationId"
          WHERE ${baseWhere}
          ORDER BY i."updatedAt" DESC
          LIMIT ${take} OFFSET ${skip}
        `,
          )
          // CHANGE 1: wrapped with attachSalesStats
          .then((rows) =>
            this.attachSalesStats(
              context,
              query,
              rows.map((row) => ({
                ...row,
                quantity: new Prisma.Decimal(String(row.quantity)),
                belowReorderLevel: true,
              })),
            ),
          ),
      );
    }

    const locationFilter = await this.resolveLocationFilter(
      context,
      query.locationId,
    );
    const where: Prisma.InventoryWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      ...locationFilter,
    };
    return createCsvStream(columns, (skip, take) =>
      this.prisma.inventory
        .findMany({
          where,
          // CHANGE 2: added productId, variantId, locationId
          select: {
            productId: true,
            variantId: true,
            locationId: true,
            quantity: true,
            product: { select: { name: true, sku: true, reorderLevel: true } },
            variant: { select: VARIANT_SELECT },
            location: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take,
        })
        // CHANGE 3: wrapped with attachSalesStats
        .then((rows) =>
          this.attachSalesStats(
            context,
            query,
            rows.map((row) => ({
              ...row,
              belowReorderLevel: row.quantity.lessThan(
                row.product.reorderLevel,
              ),
            })),
          ),
        ),
    );
  }
}
