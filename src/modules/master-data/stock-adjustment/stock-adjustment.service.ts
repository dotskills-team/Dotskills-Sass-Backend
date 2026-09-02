import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { StockMovementType } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import {
  CreateStockAdjustmentDto,
  ListStockAdjustmentsQueryDto,
  StockAdjustmentLineDto,
} from './dto/stock-adjustment.dto';

export interface AppliedLineResult {
  index: number;
  productId: string;
  locationId: string;
  status: 'APPLIED';
  beforeQuantity: string;
  afterQuantity: string;
  changeQty: string;
  movementId: string;
}

export interface ErrorLineResult {
  index: number;
  productId: string;
  locationId: string;
  status: 'ERROR';
  errorMessage: string;
}

export type LineResult = AppliedLineResult | ErrorLineResult;

/** The only 3 reasons treated as a real financial loss — COUNT_MISMATCH is a correction (could go either direction) and OPENING_STOCK is never a loss, so neither is summed here. */
const LOSS_REASONS = ['DAMAGE', 'THEFT_SHRINKAGE', 'EXPIRED'] as const;

interface ValueLostRow {
  reason: string;
  value_lost: unknown;
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(value));
}

/**
 * A Single Adjustment is simply a batch of 1 line — same code path, no
 * separate DTO/route (mirrors CreateSaleDto.items[] handling a 1-item and
 * N-item sale identically). Each line commits in its own transaction,
 * sequentially — see the plan's Q2 answer for why this deliberately
 * differs from Bulk Import's shared-transaction Preview→Confirm pattern:
 * a race-caused failure here is the expected normal case for a bulk
 * physical count, not a rare edge case a preview step could catch ahead
 * of time, so partial success (some lines applied, some not) is the
 * correct default, never an all-or-nothing abort.
 */
@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly locationAccessService: LocationAccessService,
  ) {}

  async create(
    context: CompanyContext,
    dto: CreateStockAdjustmentDto,
    actor: AuthenticatedUser,
  ) {
    const batch = await this.prisma.stockAdjustment.create({
      data: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        actorUserId: actor.userId,
      },
    });

    const lines: LineResult[] = [];
    for (let index = 0; index < dto.items.length; index++) {
      lines.push(
        await this.applyLine(context, batch.id, index, dto.items[index], actor),
      );
    }

    const appliedCount = lines.filter((l) => l.status === 'APPLIED').length;
    const errorCount = lines.length - appliedCount;

    // Written once per batch, after every line has been attempted —
    // regardless of overall outcome, so even an all-failed batch leaves a
    // clear trail of what was attempted and why it didn't apply. Mirrors
    // GoodsReceipt's one-call-one-audit-entry convention, extended to fire
    // unconditionally since partial/total failure is itself worth auditing
    // here.
    await this.prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        actorUserId: actor.userId,
        actorType: 'COMPANY_MEMBER',
        action: 'STOCK_ADJUSTMENT_CREATED',
        entityType: 'StockAdjustment',
        entityId: batch.id,
        afterData: { lines, appliedCount, errorCount } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: { batchId: batch.id, lines, summary: { appliedCount, errorCount } },
    };
  }

  private async applyLine(
    context: CompanyContext,
    batchId: string,
    index: number,
    line: StockAdjustmentLineDto,
    actor: AuthenticatedUser,
  ): Promise<LineResult> {
    const base = { index, productId: line.productId, locationId: line.locationId };

    const hasNew = line.newQuantity !== undefined;
    const hasChange = line.changeQuantity !== undefined;
    if (hasNew === hasChange) {
      return {
        ...base,
        status: 'ERROR',
        errorMessage: 'exactly one of newQuantity or changeQuantity must be provided',
      };
    }

    // Per-line, not a request-level abort — a single bulk submission can
    // legitimately span multiple locations, so one unassigned-location line
    // becomes an ERROR result for that line only, matching every other
    // per-line failure mode already established (product/location not
    // found, insufficient stock).
    try {
      await this.locationAccessService.assertHasLocationAccess(
        context,
        line.locationId,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return {
          ...base,
          status: 'ERROR',
          errorMessage: 'You do not have access to this location',
        };
      }
      throw error;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: line.productId, tenantId: context.tenantId, companyId: context.companyId },
          select: { id: true, costPrice: true },
        });
        if (!product) {
          return { ...base, status: 'ERROR' as const, errorMessage: 'product was not found' };
        }

        const location = await tx.location.findFirst({
          where: { id: line.locationId, tenantId: context.tenantId, companyId: context.companyId },
          select: { id: true },
        });
        if (!location) {
          return { ...base, status: 'ERROR' as const, errorMessage: 'location was not found' };
        }

        const inventory = await tx.inventory.findUnique({
          where: {
            tenantId_companyId_locationId_productId: {
              tenantId: context.tenantId,
              companyId: context.companyId,
              locationId: line.locationId,
              productId: line.productId,
            },
          },
          select: { quantity: true },
        });
        const currentQty = inventory?.quantity ?? new Prisma.Decimal(0);

        const delta = hasNew
          ? new Prisma.Decimal(line.newQuantity!).minus(currentQty)
          : new Prisma.Decimal(line.changeQuantity!);

        if (delta.isZero()) {
          return { ...base, status: 'ERROR' as const, errorMessage: 'no change to apply' };
        }

        const movement = delta.isPositive()
          ? await this.inventoryService.increaseStock(tx, {
              tenantId: context.tenantId,
              companyId: context.companyId,
              productId: line.productId,
              locationId: line.locationId,
              quantity: delta,
              movementType: StockMovementType.ADJUSTMENT,
              referenceId: batchId,
              actorUserId: actor.userId,
              reason: line.reason,
              note: line.note?.trim(),
              unitCost: product.costPrice,
            })
          : await this.inventoryService.decreaseStock(tx, {
              tenantId: context.tenantId,
              companyId: context.companyId,
              productId: line.productId,
              locationId: line.locationId,
              quantity: delta.abs(),
              movementType: StockMovementType.ADJUSTMENT,
              referenceId: batchId,
              actorUserId: actor.userId,
              reason: line.reason,
              note: line.note?.trim(),
              unitCost: product.costPrice,
              allowNegative: false,
            });

        return {
          ...base,
          status: 'APPLIED' as const,
          beforeQuantity: currentQty.toString(),
          afterQuantity: movement.balanceAfter.toString(),
          changeQty: movement.changeQty.toString(),
          movementId: movement.id,
        };
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        return {
          ...base,
          status: 'ERROR',
          errorMessage: 'INSUFFICIENT_STOCK: not enough stock to apply this adjustment',
        };
      }
      throw error;
    }
  }

  async list(context: CompanyContext, query: ListStockAdjustmentsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.StockAdjustmentWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
    };

    // locationId/productId/reason describe a *line*, not the batch header
    // itself (referenceId carries no formal Prisma relation to filter
    // through directly) — resolve to "batches that contain at least one
    // matching line" via one extra lookup, only when a line-level filter
    // was actually supplied.
    if (query.locationId || query.productId || query.reason) {
      const matchingBatchIds = await this.prisma.stockMovement.findMany({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          movementType: StockMovementType.ADJUSTMENT,
          ...(query.locationId ? { locationId: query.locationId } : {}),
          ...(query.productId ? { productId: query.productId } : {}),
          ...(query.reason ? { reason: query.reason } : {}),
        },
        select: { referenceId: true },
        distinct: ['referenceId'],
      });
      where.id = { in: matchingBatchIds.map((m) => m.referenceId).filter((id): id is string => !!id) };
    }

    const [batches, total] = await this.prisma.$transaction([
      this.prisma.stockAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    const summary = await this.getValueLostSummary(context, query);

    return {
      success: true,
      data: batches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary,
    };
  }

  /**
   * `SUM(ABS(changeQty) * unitCost)` grouped by reason — a product of two
   * columns, which Prisma's `groupBy`/`aggregate` can't express (only a
   * single-column sum), so this needs raw SQL — the same, already-proven
   * technique `profit-report.service.ts` uses for its own revenue/COGS
   * sums. Fully parameterized (tenantId/companyId/filters), never string
   * concatenation. Respects whatever locationId/productId/reason filter
   * is already active on the request, so the summary always describes
   * exactly what's on screen.
   */
  private async getValueLostSummary(
    context: CompanyContext,
    query: Pick<ListStockAdjustmentsQueryDto, 'locationId' | 'productId' | 'reason'>,
  ) {
    const rows = await this.prisma.$queryRaw<ValueLostRow[]>(Prisma.sql`
      SELECT reason, SUM(ABS("changeQty") * COALESCE("unitCost", 0))::numeric(20,4) AS value_lost
      FROM stock_movements
      WHERE "tenantId" = ${context.tenantId}::uuid
        AND "companyId" = ${context.companyId}::uuid
        AND "movementType" = 'ADJUSTMENT'
        AND "changeQty" < 0
        AND reason IN ('DAMAGE', 'THEFT_SHRINKAGE', 'EXPIRED')
        ${query.locationId ? Prisma.sql`AND "locationId" = ${query.locationId}::uuid` : Prisma.empty}
        ${query.productId ? Prisma.sql`AND "productId" = ${query.productId}::uuid` : Prisma.empty}
        ${query.reason ? Prisma.sql`AND reason = ${query.reason}::"StockAdjustmentReason"` : Prisma.empty}
      GROUP BY reason
    `);

    const valueLostByReason: Record<(typeof LOSS_REASONS)[number], Prisma.Decimal> = {
      DAMAGE: new Prisma.Decimal(0),
      THEFT_SHRINKAGE: new Prisma.Decimal(0),
      EXPIRED: new Prisma.Decimal(0),
    };
    for (const row of rows) {
      if ((LOSS_REASONS as readonly string[]).includes(row.reason)) {
        valueLostByReason[row.reason as (typeof LOSS_REASONS)[number]] = toDecimal(row.value_lost);
      }
    }
    const totalValueLost = LOSS_REASONS.reduce(
      (sum, reason) => sum.plus(valueLostByReason[reason]),
      new Prisma.Decimal(0),
    );

    return { totalValueLost, valueLostByReason };
  }

  async findOne(context: CompanyContext, id: string, query: ListStockAdjustmentsQueryDto = {}) {
    const batch = await this.prisma.stockAdjustment.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
    });
    if (!batch) {
      throw new NotFoundException('Stock adjustment was not found');
    }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        referenceId: batch.id,
        movementType: StockMovementType.ADJUSTMENT,
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: { ...batch, lines: movements } };
  }
}
