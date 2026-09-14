import { ConflictException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import {
  StockMovementType,
  StockAdjustmentReason,
  NotificationType,
  NotificationRelatedEntityType,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import type { CompanyContext } from '../../../common/types/company-context.type';

interface StockMoveInput {
  tenantId: string;
  companyId: string;
  productId: string;
  /** Omitted (or undefined) for a non-variant product — every lookup/write below normalizes this to `null`, matching Inventory's partial-unique-index split between variant and non-variant rows. */
  variantId?: string;
  locationId: string;
  quantity: number | Prisma.Decimal;
  movementType: StockMovementType;
  referenceId?: string;
  actorUserId?: string;
  unitCost?: number | Prisma.Decimal;
  note?: string;
  /** Only ever set by Stock Adjustment callers — every other caller omits it, written as null. */
  reason?: StockAdjustmentReason;
}

interface DecreaseStockInput extends StockMoveInput {
  /**
   * Resolved by the caller from `CompanySettings.allowNegativeStock` —
   * this function stays a pure reusable primitive and never reads
   * CompanySettings itself.
   */
  allowNegative: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * No race risk on an increase (nothing to conflict with going up), so a
   * plain upsert + movement row is correct and sufficient — never needs
   * the conditional-update primitive `decreaseStock` uses.
   */
  async increaseStock(tx: Prisma.TransactionClient, input: StockMoveInput) {
    const {
      tenantId,
      companyId,
      productId,
      locationId,
      quantity,
      movementType,
      referenceId,
      actorUserId,
      unitCost,
      note,
      reason,
    } = input;
    const variantId = input.variantId ?? null;

    // No compound @@unique exists on Inventory any more (variantId is
    // nullable and Postgres unique indexes treat NULL as distinct from
    // every other NULL — see the two partial unique indexes added by the
    // product_variants_and_flag_removal migration), so `upsert` can no
    // longer target a generated compound-unique key here — a plain
    // findFirst-then-create/update instead. Scoped by variantId (null for a
    // non-variant product) so each variant tracks its own balance row.
    const existing = await tx.inventory.findFirst({
      where: { tenantId, companyId, productId, locationId, variantId },
      select: { id: true },
    });
    const balance = existing
      ? await tx.inventory.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
          select: { quantity: true },
        })
      : await tx.inventory.create({
          data: {
            tenantId,
            companyId,
            productId,
            variantId,
            locationId,
            quantity,
          },
          select: { quantity: true },
        });

    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        companyId,
        productId,
        variantId,
        locationId,
        movementType,
        changeQty: quantity,
        balanceAfter: balance.quantity,
        unitCost,
        reason,
        referenceId,
        actorUserId,
        note,
      },
    });

    await this.notifyOnStockThresholdCrossed(tx, {
      tenantId,
      companyId,
      productId,
      locationId,
      afterQty: balance.quantity,
      signedChangeQty: new Prisma.Decimal(quantity),
    });

    return movement;
  }

  /**
   * The atomic conditional-decrement primitive — one UPDATE statement,
   * `WHERE quantity >= X` (skipped when `allowNegative` is true), never a
   * separate check-then-update. Postgres's row lock on UPDATE plus its
   * WHERE-clause re-check on a blocked/retried update (READ COMMITTED)
   * makes this safe under concurrent callers without any raw SQL or
   * explicit `SELECT ... FOR UPDATE` — the same idiom already proven in
   * this codebase by SubscriptionLifecycleService.transition()'s
   * `updateMany({where:{id,status:oldStatus}})` + count-check pattern.
   */
  async decreaseStock(tx: Prisma.TransactionClient, input: DecreaseStockInput) {
    const {
      tenantId,
      companyId,
      productId,
      locationId,
      quantity,
      movementType,
      referenceId,
      actorUserId,
      unitCost,
      note,
      reason,
      allowNegative,
    } = input;
    const variantId = input.variantId ?? null;

    const result = await tx.inventory.updateMany({
      where: {
        tenantId,
        companyId,
        productId,
        locationId,
        variantId,
        ...(allowNegative ? {} : { quantity: { gte: quantity } }),
      },
      data: { quantity: { decrement: quantity } },
    });

    if (result.count !== 1) {
      throw new ConflictException('INSUFFICIENT_STOCK');
    }

    const balance = await tx.inventory.findFirstOrThrow({
      where: { tenantId, companyId, productId, locationId, variantId },
      select: { quantity: true },
    });

    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        companyId,
        productId,
        variantId,
        locationId,
        movementType,
        changeQty: new Prisma.Decimal(quantity).negated(),
        balanceAfter: balance.quantity,
        unitCost,
        reason,
        referenceId,
        actorUserId,
        note,
      },
    });

    await this.notifyOnStockThresholdCrossed(tx, {
      tenantId,
      companyId,
      productId,
      locationId,
      afterQty: balance.quantity,
      signedChangeQty: new Prisma.Decimal(quantity).negated(),
    });

    return movement;
  }

  /**
   * Edge-triggered, not polled — fires only on the exact movement that
   * crosses a stock "band" (OUT ≤0 < LOW <reorderLevel≤ OK), never on
   * every movement while already in the same band (a product already
   * sitting under its reorder level that gets sold further down, or
   * partially restocked but still below reorderLevel, fires nothing
   * further). Shared by both `increaseStock()` and `decreaseStock()` — a
   * Purchase/Transfer-in that lands a product below reorderLevel (or
   * leaves it OUT_OF_STOCK) is exactly as real a "just became low" event
   * as a Sale crossing down, so it must be caught here too, not just on
   * decreases. `beforeQty` is derived for free from the already-known
   * after-quantity plus the signed change (positive for an increase,
   * negative for a decrease) — no extra Inventory read needed either way.
   * The Product lookup runs first (before any Decimal math) so a
   * not-found product short-circuits cheaply and safely regardless of
   * direction.
   */
  private async notifyOnStockThresholdCrossed(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      companyId: string;
      productId: string;
      locationId: string;
      afterQty: Prisma.Decimal;
      /** Positive for an increase, negative for a decrease — `beforeQty = afterQty - signedChangeQty` either way. */
      signedChangeQty: Prisma.Decimal;
    },
  ) {
    const {
      tenantId,
      companyId,
      productId,
      locationId,
      afterQty,
      signedChangeQty,
    } = params;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { name: true, sku: true, reorderLevel: true },
    });
    if (!product) return;

    const beforeQty = afterQty.minus(signedChangeQty);

    const band = (qty: Prisma.Decimal): 'OUT' | 'LOW' | 'OK' => {
      if (qty.lessThanOrEqualTo(0)) return 'OUT';
      if (
        product.reorderLevel.greaterThan(0) &&
        qty.lessThan(product.reorderLevel)
      ) {
        return 'LOW';
      }
      return 'OK';
    };

    const beforeBand = band(beforeQty);
    const afterBand = band(afterQty);

    const crossedIntoOutOfStock = afterBand === 'OUT' && beforeBand !== 'OUT';
    const crossedIntoLowStock = afterBand === 'LOW' && beforeBand !== 'LOW';

    if (!crossedIntoOutOfStock && !crossedIntoLowStock) return;

    const location = await tx.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });

    await this.notificationService.create(
      tx,
      { tenantId, companyId },
      {
        type: crossedIntoOutOfStock
          ? NotificationType.OUT_OF_STOCK
          : NotificationType.LOW_STOCK,
        relatedEntityType: NotificationRelatedEntityType.PRODUCT,
        relatedEntityId: productId,
        locationId,
        metadata: {
          productName: product.name,
          sku: product.sku,
          locationName: location?.name ?? '',
          quantity: afterQty.toString(),
          reorderLevel: product.reorderLevel.toString(),
        },
      },
    );
  }

  async getBalance(
    context: CompanyContext,
    productId: string,
    locationId: string,
    variantId?: string,
  ) {
    const balance = await this.prisma.inventory.findFirst({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        locationId,
        productId,
        variantId: variantId ?? null,
      },
      select: {
        productId: true,
        variantId: true,
        locationId: true,
        quantity: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: balance ?? {
        productId,
        variantId: variantId ?? null,
        locationId,
        quantity: new Prisma.Decimal(0),
        updatedAt: null,
      },
    };
  }

  /** Every variant of a product, summed across all locations — the "total stock on hand" view for a variant-tracked product. */
  async listBalancesByProduct(context: CompanyContext, productId: string) {
    const balances = await this.prisma.inventory.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId,
      },
      select: {
        variantId: true,
        locationId: true,
        quantity: true,
        updatedAt: true,
      },
      orderBy: [{ variantId: 'asc' }, { locationId: 'asc' }],
    });
    return { success: true, count: balances.length, data: balances };
  }

  async listMovements(
    context: CompanyContext,
    productId: string,
    locationId?: string,
    variantId?: string,
  ) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId,
        ...(locationId ? { locationId } : {}),
        ...(variantId ? { variantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: movements.length, data: movements };
  }
}
