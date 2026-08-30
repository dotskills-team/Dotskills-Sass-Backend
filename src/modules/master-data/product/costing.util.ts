import { Prisma } from 'src/generated/phase-1-prisma/client';

/**
 * Pure weighted-average (moving-average) cost calculation — no DB access,
 * so it stays trivially unit-testable and reusable outside a transaction
 * context. Returns `incomingUnitCost` unchanged when there's no existing
 * quantity to average against (a product's very first stock-in), avoiding
 * a divide-by-zero.
 */
export function calculateWeightedAverageCost(
  currentQty: Prisma.Decimal | number | string,
  currentCost: Prisma.Decimal | number | string,
  incomingQty: Prisma.Decimal | number | string,
  incomingUnitCost: Prisma.Decimal | number | string,
): Prisma.Decimal {
  const qtyBefore = new Prisma.Decimal(currentQty);
  const costBefore = new Prisma.Decimal(currentCost);
  const qtyIn = new Prisma.Decimal(incomingQty);
  const costIn = new Prisma.Decimal(incomingUnitCost);

  const totalQty = qtyBefore.plus(qtyIn);
  if (totalQty.isZero()) {
    return costIn;
  }

  const totalValue = qtyBefore.times(costBefore).plus(qtyIn.times(costIn));
  return totalValue.dividedBy(totalQty);
}
