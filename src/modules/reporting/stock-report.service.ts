import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { ProductStatus } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationAccessService } from '../../common/services/location-access.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { StockReportQueryDto } from './dto/report-query.dto';
import { createCsvStream } from './csv-stream.util';

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

    return {
      success: true,
      data: items.map((row) => ({
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

    return {
      success: true,
      data: rows.map((row) => ({
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async streamStockReportCsv(
    context: CompanyContext,
    query: StockReportQueryDto,
  ) {
    const columns = [
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
          .then((rows) =>
            rows.map((row) => ({
              ...row,
              quantity: new Prisma.Decimal(String(row.quantity)),
              belowReorderLevel: true,
            })),
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
          select: {
            quantity: true,
            product: { select: { name: true, sku: true, reorderLevel: true } },
            variant: { select: VARIANT_SELECT },
            location: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take,
        })
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            belowReorderLevel: row.quantity.lessThan(row.product.reorderLevel),
          })),
        ),
    );
  }
}
