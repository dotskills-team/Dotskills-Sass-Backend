import { Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { calculateWeightedAverageCost } from './costing.util';

/**
 * Weighted Average (Moving Average Cost) — the confirmed costing method
 * for the whole Common Core (design document Section 15 decision #1).
 * `applyPurchaseCost` is the reusable primitive a future Purchase flow
 * calls inside its own transaction: it averages the incoming purchase
 * quantity/cost against the Product's *total* quantity across every
 * Location (costPrice is a single Product-level field, not per-location),
 * updates Product.costPrice, and returns the new cost so the caller can
 * also stamp it onto the StockMovement.unitCost it writes in the same
 * transaction.
 */
@Injectable()
export class ProductCostingService {
  async applyPurchaseCost(
    tx: Prisma.TransactionClient,
    context: { tenantId: string; companyId: string },
    productId: string,
    incomingQty: Prisma.Decimal | number | string,
    incomingUnitCost: Prisma.Decimal | number | string,
  ): Promise<Prisma.Decimal> {
    const [product, stockAcrossLocations] = await Promise.all([
      tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { costPrice: true },
      }),
      tx.inventory.aggregate({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId,
        },
        _sum: { quantity: true },
      }),
    ]);

    const currentQty =
      stockAcrossLocations._sum.quantity ?? new Prisma.Decimal(0);
    const newCost = calculateWeightedAverageCost(
      currentQty,
      product.costPrice,
      incomingQty,
      incomingUnitCost,
    );

    await tx.product.update({
      where: { id: productId },
      data: { costPrice: newCost },
    });

    return newCost;
  }
}
