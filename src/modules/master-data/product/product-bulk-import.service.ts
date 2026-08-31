import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { BulkImportProductRowDto } from './dto/bulk-import-products.dto';

export interface BulkImportRowResult {
  rowIndex: number;
  status: 'CREATE' | 'UPDATE' | 'ERROR';
  sku?: string;
  errorMessage?: string;
  resolvedProductId?: string;
  categoryWillBeCreated?: boolean;
}

export interface BulkImportSummary {
  results: BulkImportRowResult[];
  createdCount: number;
  updatedCount: number;
  errorCount: number;
}

const PRICE_FIELDS = ['costPrice', 'salePrice', 'reorderLevel'] as const;

/**
 * Section ৮.৮'s Upload→Preview→Confirm: `preview()` runs every check
 * `confirm()` would, using a read-only Prisma client (never `tx`, never a
 * mutation) so nothing is written; `confirm()` re-runs the identical
 * validation inside one transaction and commits every valid row — the
 * client's cached preview result is never trusted, matching this
 * codebase's "server re-validates, never trusts a client-cached result"
 * convention used everywhere else. Upsert-by-SKU: an existing SKU updates
 * that Product; a new SKU creates one. `unitCode` must already exist
 * (rejected per-row if not); `categoryName`, if given and not found, is
 * auto-created (flagged in the Phase 6 frontend plan as a deliberate,
 * confirmed asymmetry from `unitCode`'s stricter rule).
 */
@Injectable()
export class ProductBulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    context: CompanyContext,
    rows: BulkImportProductRowDto[],
  ): Promise<BulkImportSummary> {
    return this.processRows(this.prisma, context, rows, null);
  }

  async confirm(
    context: CompanyContext,
    rows: BulkImportProductRowDto[],
    actor: AuthenticatedUser,
  ): Promise<BulkImportSummary> {
    return this.prisma.$transaction(async (tx) => {
      const summary = await this.processRows(tx, context, rows, actor.userId);

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          actorUserId: actor.userId,
          actorType: 'COMPANY_MEMBER',
          action: 'PRODUCT_BULK_IMPORT',
          entityType: 'Product',
          entityId: context.companyId,
          afterData: {
            createdCount: summary.createdCount,
            updatedCount: summary.updatedCount,
            errorCount: summary.errorCount,
            totalRows: rows.length,
          },
        },
      });

      return summary;
    });
  }

  /**
   * `write` is null for preview (read-only client, nothing persisted) or
   * the acting user's id for confirm (running inside its own transaction,
   * every valid row actually created/updated). Same method either way —
   * confirm() never duplicates preview()'s validation logic.
   */
  private async processRows(
    client: Prisma.TransactionClient | PrismaService,
    context: CompanyContext,
    rows: BulkImportProductRowDto[],
    write: string | null,
  ): Promise<BulkImportSummary> {
    const skus = rows
      .map((row) => row.sku?.trim())
      .filter((sku): sku is string => !!sku);
    const existingProducts = await client.product.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        sku: { in: skus },
      },
      select: { id: true, sku: true },
    });
    const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));

    const units = await client.unit.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true, code: true },
    });
    const unitsByCode = new Map(units.map((u) => [u.code, u]));

    const categories = await client.category.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true, name: true },
    });
    const categoriesByName = new Map(categories.map((c) => [c.name, c]));

    const results: BulkImportRowResult[] = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        const sku = row.sku?.trim();
        if (!sku) {
          results.push({
            rowIndex,
            status: 'ERROR',
            errorMessage: 'sku is required',
          });
          continue;
        }
        if (sku.length > 60) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: 'sku must be at most 60 characters',
          });
          continue;
        }

        const name = row.name?.trim();
        if (!name || name.length < 2) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: 'name is required (min 2 characters)',
          });
          continue;
        }
        if (name.length > 200) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: 'name must be at most 200 characters',
          });
          continue;
        }

        const unitCode = row.unitCode?.trim();
        if (!unitCode) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: 'unitCode is required',
          });
          continue;
        }
        const unit = unitsByCode.get(unitCode);
        if (!unit) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: `unitCode "${unitCode}" was not found — create this Unit first`,
          });
          continue;
        }

        const prices: Record<
          (typeof PRICE_FIELDS)[number],
          number | undefined
        > = {
          costPrice: undefined,
          salePrice: undefined,
          reorderLevel: undefined,
        };
        let priceError: string | null = null;
        for (const field of PRICE_FIELDS) {
          const raw = row[field];
          if (raw === undefined || raw === '') continue;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) {
            priceError = `${field} must be zero or a positive number`;
            break;
          }
          prices[field] = parsed;
        }
        if (priceError) {
          results.push({
            rowIndex,
            status: 'ERROR',
            sku,
            errorMessage: priceError,
          });
          continue;
        }

        const barcode = row.barcode?.trim() || undefined;
        const sellByWeight =
          row.sellByWeight === true || row.sellByWeight === 'true';

        let categoryId: string | undefined;
        let categoryWillBeCreated = false;
        const categoryName = row.categoryName?.trim();
        if (categoryName) {
          const existingCategory = categoriesByName.get(categoryName);
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else if (write) {
            const created = await client.category.create({
              data: {
                tenantId: context.tenantId,
                companyId: context.companyId,
                name: categoryName,
              },
              select: { id: true, name: true },
            });
            categoriesByName.set(categoryName, created);
            categoryId = created.id;
          } else {
            categoryWillBeCreated = true;
          }
        }

        const existing = existingBySku.get(sku);
        if (existing) {
          if (write) {
            const updated = await client.product.update({
              where: { id: existing.id },
              data: {
                name,
                categoryId,
                baseUnitId: unit.id,
                barcode,
                ...(prices.costPrice !== undefined
                  ? { costPrice: prices.costPrice }
                  : {}),
                ...(prices.salePrice !== undefined
                  ? { salePrice: prices.salePrice }
                  : {}),
                ...(prices.reorderLevel !== undefined
                  ? { reorderLevel: prices.reorderLevel }
                  : {}),
                sellByWeight,
              },
              select: { id: true },
            });
            results.push({
              rowIndex,
              status: 'UPDATE',
              sku,
              resolvedProductId: updated.id,
              categoryWillBeCreated,
            });
          } else {
            results.push({
              rowIndex,
              status: 'UPDATE',
              sku,
              resolvedProductId: existing.id,
              categoryWillBeCreated,
            });
          }
        } else if (write) {
          const created = await client.product.create({
            data: {
              tenantId: context.tenantId,
              companyId: context.companyId,
              sku,
              name,
              categoryId,
              baseUnitId: unit.id,
              barcode,
              costPrice: prices.costPrice ?? 0,
              salePrice: prices.salePrice ?? 0,
              reorderLevel: prices.reorderLevel ?? 0,
              sellByWeight,
            },
            select: { id: true, sku: true },
          });
          existingBySku.set(sku, created);
          results.push({
            rowIndex,
            status: 'CREATE',
            sku,
            resolvedProductId: created.id,
            categoryWillBeCreated,
          });
        } else {
          results.push({
            rowIndex,
            status: 'CREATE',
            sku,
            categoryWillBeCreated,
          });
        }
      } catch (error) {
        results.push({
          rowIndex,
          status: 'ERROR',
          sku: row.sku?.trim(),
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Unknown error while processing this row',
        });
      }
    }

    return {
      results,
      createdCount: results.filter((r) => r.status === 'CREATE').length,
      updatedCount: results.filter((r) => r.status === 'UPDATE').length,
      errorCount: results.filter((r) => r.status === 'ERROR').length,
    };
  }
}
