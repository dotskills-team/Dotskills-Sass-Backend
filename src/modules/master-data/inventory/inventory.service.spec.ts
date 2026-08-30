import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { StockMovementType } from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockTx = {
    inventory: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
  };

  const mockPrisma = {
    inventory: { findUnique: jest.fn() },
    stockMovement: { findMany: jest.fn() },
  };

  const baseInput = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    productId: 'product-1',
    locationId: 'location-1',
    quantity: 10,
    movementType: StockMovementType.PURCHASE,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('increaseStock', () => {
    it('upserts the balance up and writes a positive StockMovement with the resulting balance', async () => {
      mockTx.inventory.upsert.mockResolvedValue({ quantity: 25 });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'movement-1' });

      await service.increaseStock(mockTx as any, baseInput);

      expect(mockTx.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_companyId_locationId_productId: {
              tenantId: 'tenant-1',
              companyId: 'company-1',
              locationId: 'location-1',
              productId: 'product-1',
            },
          },
          create: expect.objectContaining({ quantity: 10 }),
          update: { quantity: { increment: 10 } },
        }),
      );
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: StockMovementType.PURCHASE,
            changeQty: 10,
            balanceAfter: 25,
          }),
        }),
      );
    });
  });

  describe('decreaseStock', () => {
    it('uses a conditional gte updateMany (not check-then-update) when allowNegative is false', async () => {
      mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: 5 });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'movement-2' });

      await service.decreaseStock(mockTx as any, {
        ...baseInput,
        movementType: StockMovementType.SALE,
        allowNegative: false,
      });

      expect(mockTx.inventory.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          productId: 'product-1',
          locationId: 'location-1',
          quantity: { gte: 10 },
        },
        data: { quantity: { decrement: 10 } },
      });
    });

    it('omits the gte guard entirely when allowNegative is true', async () => {
      mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: -5 });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'movement-3' });

      await service.decreaseStock(mockTx as any, {
        ...baseInput,
        movementType: StockMovementType.SALE,
        allowNegative: true,
      });

      expect(mockTx.inventory.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          productId: 'product-1',
          locationId: 'location-1',
        },
        data: { quantity: { decrement: 10 } },
      });
    });

    /**
     * Core race-condition guarantee: if the conditional UPDATE affects 0
     * rows (either no Inventory row exists yet, or the concurrent WHERE
     * quantity >= X no longer holds because another decrement already
     * consumed the stock), this must reject as INSUFFICIENT_STOCK and
     * never write a StockMovement — the two callers-racing-for-the-last-
     * unit scenario this whole primitive exists to prevent.
     */
    it('rejects with INSUFFICIENT_STOCK and writes no movement when the conditional update affects 0 rows', async () => {
      mockTx.inventory.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.decreaseStock(mockTx as any, {
          ...baseInput,
          movementType: StockMovementType.SALE,
          allowNegative: false,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('writes changeQty as the negated quantity on success', async () => {
      mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: 0 });
      mockTx.stockMovement.create.mockResolvedValue({ id: 'movement-4' });

      await service.decreaseStock(mockTx as any, {
        ...baseInput,
        quantity: 7,
        movementType: StockMovementType.SALE,
        allowNegative: false,
      });

      const call = mockTx.stockMovement.create.mock.calls[0][0];
      expect(call.data.changeQty.toString()).toBe('-7');
    });
  });

  describe('getBalance', () => {
    it('returns a zero-quantity default when no Inventory row exists yet', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const result = await service.getBalance(
        { tenantId: 'tenant-1', companyId: 'company-1' } as any,
        'product-1',
        'location-1',
      );

      expect(result.data.quantity.toString()).toBe('0');
    });
  });

  describe('listMovements', () => {
    it('scopes the query by tenantId + companyId + productId, optionally locationId', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);

      await service.listMovements({ tenantId: 'tenant-1', companyId: 'company-1' } as any, 'product-1', 'location-1');

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', companyId: 'company-1', productId: 'product-1', locationId: 'location-1' },
        }),
      );
    });
  });
});
