import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import { StockMovementType } from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
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
    // Threshold-crossing notification lookups — undefined by default (no
    // product found) so every pre-existing test, which never sets these
    // up, silently skips the notification path unchanged.
    product: { findUnique: jest.fn() },
    location: { findUnique: jest.fn() },
  };

  const mockPrisma = {
    inventory: { findUnique: jest.fn() },
    stockMovement: { findMany: jest.fn() },
  };

  const mockNotificationService = {
    create: jest.fn(),
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
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
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
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(5) });
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
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(-5) });
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
      mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(0) });
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

    describe('Out-of-Stock / Low-Stock edge-triggered notification', () => {
      beforeEach(() => {
        mockTx.inventory.updateMany.mockResolvedValue({ count: 1 });
        mockTx.stockMovement.create.mockResolvedValue({ id: 'movement-x' });
        mockTx.location.findUnique.mockResolvedValue({ name: 'Main Branch' });
      });

      it('fires OUT_OF_STOCK when the movement crosses from positive to <= 0', async () => {
        mockTx.product.findUnique.mockResolvedValue({
          name: 'Rice',
          sku: 'RICE-1',
          reorderLevel: new Prisma.Decimal(10),
        });
        mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(0) }); // after = 0

        await service.decreaseStock(mockTx as any, {
          ...baseInput,
          quantity: 5, // before = 0 + 5 = 5 > 0
          movementType: StockMovementType.SALE,
          allowNegative: false,
        });

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          { tenantId: 'tenant-1', companyId: 'company-1' },
          expect.objectContaining({
            type: 'OUT_OF_STOCK',
            relatedEntityType: 'PRODUCT',
            relatedEntityId: 'product-1',
            locationId: 'location-1',
            metadata: expect.objectContaining({ productName: 'Rice', locationName: 'Main Branch' }),
          }),
        );
      });

      it('fires LOW_STOCK when the movement crosses the reorder level but stays positive', async () => {
        mockTx.product.findUnique.mockResolvedValue({
          name: 'Rice',
          sku: 'RICE-1',
          reorderLevel: new Prisma.Decimal(10),
        });
        mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(8) }); // after = 8

        await service.decreaseStock(mockTx as any, {
          ...baseInput,
          quantity: 4, // before = 8 + 4 = 12 >= reorderLevel(10)
          movementType: StockMovementType.SALE,
          allowNegative: false,
        });

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          { tenantId: 'tenant-1', companyId: 'company-1' },
          expect.objectContaining({ type: 'LOW_STOCK' }),
        );
      });

      it('does NOT re-fire when the product was already below the reorder level before this movement (duplicate-prevention)', async () => {
        mockTx.product.findUnique.mockResolvedValue({
          name: 'Rice',
          sku: 'RICE-1',
          reorderLevel: new Prisma.Decimal(10),
        });
        mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(4) }); // after = 4

        await service.decreaseStock(mockTx as any, {
          ...baseInput,
          quantity: 2, // before = 4 + 2 = 6, already < reorderLevel(10) beforehand too
          movementType: StockMovementType.SALE,
          allowNegative: false,
        });

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });

      it('does not throw and does not notify when the product cannot be found', async () => {
        mockTx.product.findUnique.mockResolvedValue(null);
        mockTx.inventory.findUniqueOrThrow.mockResolvedValue({ quantity: new Prisma.Decimal(0) });

        await expect(
          service.decreaseStock(mockTx as any, {
            ...baseInput,
            quantity: 5,
            movementType: StockMovementType.SALE,
            allowNegative: false,
          }),
        ).resolves.toBeDefined();

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });
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

      await service.listMovements(
        { tenantId: 'tenant-1', companyId: 'company-1' } as any,
        'product-1',
        'location-1',
      );

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            companyId: 'company-1',
            productId: 'product-1',
            locationId: 'location-1',
          },
        }),
      );
    });
  });
});
