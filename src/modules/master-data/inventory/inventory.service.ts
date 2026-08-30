import { ConflictException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { StockMovementType } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * No race risk on an increase (nothing to conflict with going up), so a
   * plain upsert + movement row is correct and sufficient — never needs
   * the conditional-update primitive `decreaseStock` uses.
   */
  async increaseStock(tx: Prisma.TransactionClient, input: StockMoveInput) {
    const { tenantId, companyId, productId, locationId, quantity, movementType, referenceId, actorUserId, unitCost, note } = input;

    const balance = await tx.inventory.upsert({
      where: { tenantId_companyId_locationId_productId: { tenantId, companyId, locationId, productId } },
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
    const { tenantId, companyId, productId, locationId, quantity, movementType, referenceId, actorUserId, unitCost, note, allowNegative } = input;

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
      where: { tenantId_companyId_locationId_productId: { tenantId, companyId, locationId, productId } },
      select: { quantity: true },
    });

    return tx.stockMovement.create({
      data: {
        tenantId,
        companyId,
        productId,
        locationId,
        movementType,
        changeQty: new Prisma.Decimal(quantity).negated(),
        balanceAfter: balance.quantity,
        unitCost,
        referenceId,
        actorUserId,
        note,
      },
    });
  }

  async getBalance(context: CompanyContext, productId: string, locationId: string) {
    const balance = await this.prisma.inventory.findUnique({
      where: {
        tenantId_companyId_locationId_productId: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          locationId,
          productId,
        },
      },
      select: { productId: true, locationId: true, quantity: true, updatedAt: true },
    });
    return { success: true, data: balance ?? { productId, locationId, quantity: new Prisma.Decimal(0), updatedAt: null } };
  }

  async listMovements(context: CompanyContext, productId: string, locationId?: string) {
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
