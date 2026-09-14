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
  /**
   * `variantId` is a new, purely-additive last parameter (existing callers
   * that don't pass it keep averaging against the parent Product's own
   * `costPrice`, unchanged). When given, the average is computed and
   * stored against that `ProductVariant`'s own `costPrice` instead — each
   * variant carries its own cost, never the parent's — and the Inventory
   * aggregate is scoped to that variant specifically, not the product's
   * combined stock across all its variants (which would blend costs that
   * should stay independent, e.g. a Red T-Shirt's cost must never be
   * diluted by a Blue T-Shirt's purchase price).
   */
  async applyPurchaseCost(
    tx: Prisma.TransactionClient,
    context: { tenantId: string; companyId: string },
    productId: string,
    incomingQty: Prisma.Decimal | number | string,
    incomingUnitCost: Prisma.Decimal | number | string,
    variantId?: string,
  ): Promise<Prisma.Decimal> {
    const [currentCost, stockAcrossLocations] = await Promise.all([
      variantId
        ? tx.productVariant
            .findUniqueOrThrow({
              where: { id: variantId },
              select: { costPrice: true },
            })
            .then((v) => v.costPrice)
        : tx.product
            .findUniqueOrThrow({
              where: { id: productId },
              select: { costPrice: true },
            })
            .then((p) => p.costPrice),
      tx.inventory.aggregate({
        where: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId,
          variantId: variantId ?? null,
        },
        _sum: { quantity: true },
      }),
    ]);

    const currentQty =
      stockAcrossLocations._sum.quantity ?? new Prisma.Decimal(0);
    const newCost = calculateWeightedAverageCost(
      currentQty,
      currentCost,
      incomingQty,
      incomingUnitCost,
    );

    if (variantId) {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { costPrice: newCost },
      });
    } else {
      await tx.product.update({
        where: { id: productId },
        data: { costPrice: newCost },
      });
    }

    return newCost;
  }
}
