import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Resolves and applies the conversion between a transaction line's
 * entered Unit (e.g. "Carton") and the Product's own base Unit (e.g.
 * "Piece") — the entry point where Purchase/Sale line data crosses into
 * Inventory/Costing, which always operate in base-unit terms and never
 * change. All arithmetic uses `Prisma.Decimal` (decimal.js under the
 * hood) end-to-end — never a plain JS `number` — so results are exact
 * decimal arithmetic, not floating-point, matching the same convention
 * `costing.util.ts`'s weighted-average calculation already follows.
 *
 * Deliberately no intermediate rounding: `toBaseQuantity`/`toBaseUnitCost`
 * return a full-precision `Decimal` (decimal.js's own working precision,
 * far beyond the DB column's 4 decimal places) and pass it straight into
 * `ProductCostingService`/`InventoryService`, exactly like every existing
 * non-conversion call already does — Postgres's `NUMERIC(_,4)` column is
 * the only place any rounding happens, identical to how weighted-average
 * costing has always worked. This is why a perfectly-divisible case (24
 * pieces per carton) and a non-divisible case (3 pieces, ৩ ভাগ) are
 * handled by the exact same code path with no special-casing.
 */
@Injectable()
export class UnitConversionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Only ONE level of unit nesting is supported: `unitId` must be a Unit
   * whose own `baseUnitId` is directly the Product's `baseUnitId` (e.g.
   * "Carton" -> "Piece"). A deeper chain (e.g. "Gross" -> "Dozen" ->
   * "Piece") is out of scope for this pass — deliberately, not an
   * oversight — and is rejected with a clear error rather than silently
   * resolved to the wrong factor.
   *
   * Returns `Decimal(1)` when `unitId` is omitted or equals the
   * Product's own base unit — the common, no-conversion case — so every
   * pre-existing call site (which never passes a differing unit) gets
   * back exactly the identity factor and behaves byte-for-byte as it did
   * before this feature existed.
   */
  async resolveFactor(
    context: { tenantId: string; companyId: string },
    productBaseUnitId: string,
    unitId: string | null | undefined,
  ): Promise<Prisma.Decimal> {
    if (!unitId || unitId === productBaseUnitId) {
      return new Prisma.Decimal(1);
    }

    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true, baseUnitId: true, conversionFactor: true },
    });
    if (!unit) {
      throw new BadRequestException(
        `unitId ${unitId} does not refer to a unit in this company`,
      );
    }
    if (unit.baseUnitId !== productBaseUnitId) {
      throw new BadRequestException(
        `unitId ${unitId} does not convert directly to this product's base unit — only one level of unit nesting is supported`,
      );
    }
    return unit.conversionFactor;
  }

  /** `enteredQty` (in the line's own unit) × `factor` = the equivalent quantity in the Product's base unit. Exact Decimal multiplication — never lossy for the integer/simple-fraction factors real units use (e.g. 12, 24). */
  toBaseQuantity(
    enteredQty: Prisma.Decimal | number | string,
    factor: Prisma.Decimal,
  ): Prisma.Decimal {
    return new Prisma.Decimal(enteredQty).times(factor);
  }

  /** `enteredUnitCost` (cost per unit of the line's own unit) ÷ `factor` = the equivalent cost per base unit. Full decimal.js working precision is kept (no `.toDecimalPlaces()`/rounding here) — the DB column's NUMERIC(_,4) scale is the only rounding boundary, exactly like every other cost figure in this codebase. */
  toBaseUnitCost(
    enteredUnitCost: Prisma.Decimal | number | string,
    factor: Prisma.Decimal,
  ): Prisma.Decimal {
    return new Prisma.Decimal(enteredUnitCost).dividedBy(factor);
  }
}
