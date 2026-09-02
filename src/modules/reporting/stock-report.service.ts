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
  locationId: string;
  quantity: unknown;
  productName: string;
  sku: string;
  reorderLevel: unknown;
  locationName: string;
}

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
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        select: {
          id: true,
          productId: true,
          locationId: true,
          quantity: true,
          product: {
            select: { name: true, sku: true, reorderLevel: true, status: true },
          },
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
    `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<BelowReorderRow[]>(Prisma.sql`
        SELECT
          i.id AS id,
          i."productId" AS "productId",
          i."locationId" AS "locationId",
          i.quantity AS quantity,
          p.name AS "productName",
          p.sku AS sku,
          p."reorderLevel" AS "reorderLevel",
          l.name AS "locationName"
        FROM inventory i
        JOIN products p ON p.id = i."productId"
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
        locationId: row.locationId,
        quantity: new Prisma.Decimal(String(row.quantity)),
        product: {
          name: row.productName,
          sku: row.sku,
          reorderLevel: new Prisma.Decimal(String(row.reorderLevel)),
        },
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
      `;
      return createCsvStream(columns, (skip, take) =>
        this.prisma
          .$queryRaw<BelowReorderRow[]>(
            Prisma.sql`
          SELECT i.id AS id, i."productId" AS "productId", i."locationId" AS "locationId", i.quantity AS quantity,
                 p.name AS "productName", p.sku AS sku, p."reorderLevel" AS "reorderLevel", l.name AS "locationName"
          FROM inventory i
          JOIN products p ON p.id = i."productId"
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
