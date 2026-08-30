import { Prisma } from '../../../generated/phase-1-prisma/client';
import { calculateWeightedAverageCost } from './costing.util';

describe('calculateWeightedAverageCost', () => {
  it('returns the incoming unit cost unchanged when there is no existing quantity (first stock-in)', () => {
    const result = calculateWeightedAverageCost(0, 0, 10, 50);
    expect(result.toString()).toBe('50');
  });

  it('computes the standard weighted average across existing and incoming stock', () => {
    // 10 units @ 100 existing + 10 units @ 200 incoming = 20 units @ 150 average
    const result = calculateWeightedAverageCost(10, 100, 10, 200);
    expect(result.toString()).toBe('150');
  });

  it('weights toward the larger quantity correctly (not a naive 50/50 average of the two costs)', () => {
    // 90 units @ 10 existing + 10 units @ 100 incoming = 100 units, total value 900+1000=1900 -> 19
    const result = calculateWeightedAverageCost(90, 10, 10, 100);
    expect(result.toString()).toBe('19');
  });

  it('accepts Prisma.Decimal instances directly, not just numbers', () => {
    const result = calculateWeightedAverageCost(
      new Prisma.Decimal('5'),
      new Prisma.Decimal('20'),
      new Prisma.Decimal('5'),
      new Prisma.Decimal('40'),
    );
    expect(result.toString()).toBe('30');
  });
});
