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

    const balance = await tx.inventory.upsert({
      where: {
        tenantId_companyId_locationId_productId: {
          tenantId,
          companyId,
          locationId,
          productId,
        },
      },
      create: { tenantId, companyId, productId, locationId, quantity },
      update: { quantity: { increment: quantity } },
      select: { quantity: true },
    });

    return tx.stockMovement.create({
      data: {
        tenantId,
        companyId,
        productId,
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

    const result = await tx.inventory.updateMany({
      where: {
        tenantId,
        companyId,
        productId,
        locationId,
        ...(allowNegative ? {} : { quantity: { gte: quantity } }),
      },
      data: { quantity: { decrement: quantity } },
    });

    if (result.count !== 1) {
      throw new ConflictException('INSUFFICIENT_STOCK');
    }

    const balance = await tx.inventory.findUniqueOrThrow({
      where: {
        tenantId_companyId_locationId_productId: {
          tenantId,
          companyId,
          locationId,
          productId,
        },
      },
      select: { quantity: true },
    });

    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        companyId,
        productId,
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
      quantityDecremented: new Prisma.Decimal(quantity),
    });

    return movement;
  }

  /**
   * Edge-triggered, not polled — fires only on the exact movement that
   * crosses a threshold, never on every movement while already below it
   * (a product already sitting under its reorder level that gets sold
   * further down fires nothing further; it only re-fires after a
   * Purchase/Transfer/Adjustment brings it back to >= reorderLevel and a
   * later decrease crosses back down). The before-quantity is derived for
   * free from the already-known after-quantity + the decrement amount —
   * no extra Inventory read needed. Lives here (not duplicated in Sale/
   * Transfer/Adjustment) since decreaseStock() is the one shared
   * choke-point every stock-reducing action already funnels through, so a
   * Stock Adjustment (damage) that zeroes out a product is caught too, not
   * just Sales.
   */
  private async notifyOnStockThresholdCrossed(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      companyId: string;
      productId: string;
      locationId: string;
      afterQty: Prisma.Decimal;
      quantityDecremented: Prisma.Decimal;
    },
  ) {
    const { tenantId, companyId, productId, locationId, afterQty, quantityDecremented } = params;
    const beforeQty = afterQty.plus(quantityDecremented);

    const crossedIntoOutOfStock =
      beforeQty.greaterThan(0) && afterQty.lessThanOrEqualTo(0);

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { name: true, sku: true, reorderLevel: true },
    });
    if (!product) return;

    const crossedIntoLowStock =
      !crossedIntoOutOfStock &&
      product.reorderLevel.greaterThan(0) &&
      beforeQty.greaterThanOrEqualTo(product.reorderLevel) &&
      afterQty.lessThan(product.reorderLevel);

    if (!crossedIntoOutOfStock && !crossedIntoLowStock) return;

    const location = await tx.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });

    await this.notificationService.create(tx, { tenantId, companyId }, {
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
    });
  }

  async getBalance(
    context: CompanyContext,
    productId: string,
    locationId: string,
  ) {
    const balance = await this.prisma.inventory.findUnique({
      where: {
        tenantId_companyId_locationId_productId: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          locationId,
          productId,
        },
      },
      select: {
        productId: true,
        locationId: true,
        quantity: true,
        updatedAt: true,
      },
    });
    return {
      success: true,
      data: balance ?? {
        productId,
        locationId,
        quantity: new Prisma.Decimal(0),
        updatedAt: null,
      },
    };
  }

  async listMovements(
    context: CompanyContext,
    productId: string,
    locationId?: string,
  ) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId,
        ...(locationId ? { locationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: movements.length, data: movements };
  }
}
