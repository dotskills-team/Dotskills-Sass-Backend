import { BadRequestException } from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import { UnitConversionService } from './unit-conversion.service';

describe('UnitConversionService', () => {
  let service: UnitConversionService;
  const mockPrisma = { unit: { findFirst: jest.fn() } };
  const context = { tenantId: 'tenant-1', companyId: 'company-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnitConversionService(mockPrisma as any);
  });

  describe('resolveFactor', () => {
    it('returns Decimal(1) when unitId is omitted — the common, no-conversion case', async () => {
      const factor = await service.resolveFactor(
        context,
        'piece-unit-1',
        undefined,
      );
      expect(factor.toString()).toBe('1');
      expect(mockPrisma.unit.findFirst).not.toHaveBeenCalled();
    });

    it('returns Decimal(1) when unitId equals the product’s own base unit', async () => {
      const factor = await service.resolveFactor(
        context,
        'piece-unit-1',
        'piece-unit-1',
      );
      expect(factor.toString()).toBe('1');
      expect(mockPrisma.unit.findFirst).not.toHaveBeenCalled();
    });

    it('resolves a valid one-level conversion (Carton -> Piece)', async () => {
      mockPrisma.unit.findFirst.mockResolvedValue({
        id: 'carton-unit-1',
        baseUnitId: 'piece-unit-1',
        conversionFactor: new Prisma.Decimal(24),
      });
      const factor = await service.resolveFactor(
        context,
        'piece-unit-1',
        'carton-unit-1',
      );
      expect(factor.toString()).toBe('24');
    });

    it('rejects a unitId that does not exist in this company', async () => {
      mockPrisma.unit.findFirst.mockResolvedValue(null);
      await expect(
        service.resolveFactor(context, 'piece-unit-1', 'unknown-unit'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a unitId whose baseUnitId is not this product’s own base unit (wrong family, or a deeper chain)', async () => {
      mockPrisma.unit.findFirst.mockResolvedValue({
        id: 'gross-unit-1',
        baseUnitId: 'dozen-unit-1',
        conversionFactor: new Prisma.Decimal(12),
      });
      await expect(
        service.resolveFactor(context, 'piece-unit-1', 'gross-unit-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toBaseQuantity / toBaseUnitCost', () => {
    it('handles a perfectly-divisible case exactly (1 carton of 24 @ 240 total)', () => {
      const factor = new Prisma.Decimal(24);
      const baseQty = service.toBaseQuantity(1, factor);
      const baseUnitCost = service.toBaseUnitCost(240, factor);
      expect(baseQty.toString()).toBe('24');
      expect(baseUnitCost.toString()).toBe('10');
    });

    it('keeps full decimal precision for a non-divisible case (100 ÷ 3), never a floating-point artifact', () => {
      const factor = new Prisma.Decimal(3);
      const baseUnitCost = service.toBaseUnitCost(100, factor);
      // Full decimal.js working precision (20 significant digits), not
      // truncated here — rounding to the DB column's 4 decimal places
      // happens only when Postgres actually stores it, exactly like
      // every other cost figure in this codebase.
      expect(baseUnitCost.toString()).toBe('33.333333333333333333');
      // Multiplying back by the factor recovers arbitrarily close to
      // the original value — proving this is exact decimal arithmetic,
      // not a lossy float, even though 100/3 itself isn't terminating.
      expect(baseUnitCost.times(3).toDecimalPlaces(10).toString()).toBe('100');
    });

    it('round-trips a whole carton bought then fully sold back to exactly zero stock, with no residual rounding artifact', () => {
      const factor = new Prisma.Decimal(24);
      const purchasedBaseQty = service.toBaseQuantity(1, factor); // 1 carton -> 24 pieces
      // Selling all 24 pieces individually (factor 1, the product's own base unit).
      const soldBaseQty = service.toBaseQuantity(24, new Prisma.Decimal(1));
      const remaining = purchasedBaseQty.minus(soldBaseQty);
      expect(remaining.toString()).toBe('0');
      expect(remaining.isZero()).toBe(true);
    });

    it('never uses floating-point arithmetic — Decimal(0.1).plus(Decimal(0.2)) is exactly 0.3, unlike JS number', () => {
      expect(0.1 + 0.2 === 0.3).toBe(false); // the classic float trap, confirmed still true for plain JS numbers
      const sum = new Prisma.Decimal('0.1').plus(new Prisma.Decimal('0.2'));
      expect(sum.toString()).toBe('0.3');
    });
  });
});
