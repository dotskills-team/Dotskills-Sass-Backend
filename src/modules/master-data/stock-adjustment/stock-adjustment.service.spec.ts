import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import {
  StockAdjustmentReason,
  StockMovementType,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import { StockAdjustmentService } from './stock-adjustment.service';

describe('StockAdjustmentService', () => {
  let service: StockAdjustmentService;

  const mockTx = {
    product: { findFirst: jest.fn() },
    location: { findFirst: jest.fn() },
    inventory: { findUnique: jest.fn() },
  };

  const mockPrisma = {
    stockAdjustment: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    stockMovement: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockInventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
  };
  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.stockAdjustment.create.mockResolvedValue({ id: 'batch-1' });
    mockTx.product.findFirst.mockResolvedValue({
      id: 'p-1',
      costPrice: new Prisma.Decimal(50),
    });
    mockTx.location.findFirst.mockResolvedValue({ id: 'loc-1' });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockLocationAccessService.assertHasLocationAccess.mockResolvedValue(
      undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAdjustmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventoryService },
        {
          provide: LocationAccessService,
          useValue: mockLocationAccessService,
        },
      ],
    }).compile();

    service = module.get(StockAdjustmentService);
  });

  describe('create — single line, newQuantity mode', () => {
    it('resolves the delta against the current balance and calls increaseStock when the target is higher', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(10),
      });
      mockInventoryService.increaseStock.mockResolvedValue({
        id: 'move-1',
        balanceAfter: new Prisma.Decimal(42),
        changeQty: new Prisma.Decimal(32),
      });

      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              newQuantity: 42,
              reason: StockAdjustmentReason.COUNT_MISMATCH,
            },
          ],
        },
        actor,
      );

      expect(mockInventoryService.increaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'p-1',
          locationId: 'loc-1',
          movementType: StockMovementType.ADJUSTMENT,
          referenceId: 'batch-1',
          reason: StockAdjustmentReason.COUNT_MISMATCH,
          unitCost: expect.any(Prisma.Decimal),
        }),
      );
      const call = mockInventoryService.increaseStock.mock.calls[0][1];
      expect(call.unitCost.toString()).toBe('50'); // Product.costPrice snapshotted onto the movement
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
      expect(result.data.summary).toEqual({ appliedCount: 1, errorCount: 0 });
      expect(result.data.lines[0]).toMatchObject({
        status: 'APPLIED',
        beforeQuantity: '10',
        afterQuantity: '42',
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STOCK_ADJUSTMENT_CREATED',
            entityType: 'StockAdjustment',
            entityId: 'batch-1',
          }),
        }),
      );
    });

    it('calls decreaseStock with allowNegative:false when the target is lower', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(50),
      });
      mockInventoryService.decreaseStock.mockResolvedValue({
        id: 'move-2',
        balanceAfter: new Prisma.Decimal(8),
        changeQty: new Prisma.Decimal(-42),
      });

      await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              newQuantity: 8,
              reason: StockAdjustmentReason.DAMAGE,
            },
          ],
        },
        actor,
      );

      expect(mockInventoryService.decreaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          allowNegative: false,
          movementType: StockMovementType.ADJUSTMENT,
        }),
      );
    });
  });

  describe('create — changeQuantity mode', () => {
    it('applies a signed delta directly without reading it against a target', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(20),
      });
      mockInventoryService.decreaseStock.mockResolvedValue({
        id: 'move-3',
        balanceAfter: new Prisma.Decimal(17),
        changeQty: new Prisma.Decimal(-3),
      });

      await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: -3,
              reason: StockAdjustmentReason.THEFT_SHRINKAGE,
            },
          ],
        },
        actor,
      );

      const call = mockInventoryService.decreaseStock.mock.calls[0][1];
      expect(call.quantity.toString()).toBe('3');
    });
  });

  describe('create — per-line validation errors, none write anything', () => {
    it('rejects a line with both newQuantity and changeQuantity', async () => {
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              newQuantity: 5,
              changeQuantity: 5,
              reason: StockAdjustmentReason.OTHER,
              note: 'x',
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({ status: 'ERROR' });
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
    });

    it('rejects a line with neither newQuantity nor changeQuantity', async () => {
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              reason: StockAdjustmentReason.OTHER,
              note: 'x',
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({ status: 'ERROR' });
    });

    it('rejects a line whose productId does not belong to this company', async () => {
      mockTx.product.findFirst.mockResolvedValue(null);
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'foreign',
              locationId: 'loc-1',
              changeQuantity: 5,
              reason: StockAdjustmentReason.OPENING_STOCK,
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({
        status: 'ERROR',
        errorMessage: expect.stringContaining('product'),
      });
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
    });

    it('rejects a line whose locationId does not belong to this company', async () => {
      mockTx.location.findFirst.mockResolvedValue(null);
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'foreign',
              changeQuantity: 5,
              reason: StockAdjustmentReason.OPENING_STOCK,
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({
        status: 'ERROR',
        errorMessage: expect.stringContaining('location'),
      });
    });

    it('rejects a newQuantity line that resolves to zero delta, as "no change to apply"', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(15),
      });
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              newQuantity: 15,
              reason: StockAdjustmentReason.COUNT_MISMATCH,
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({
        status: 'ERROR',
        errorMessage: expect.stringContaining('no change'),
      });
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
    });
  });

  describe('create — Location-Based Access Control', () => {
    it("checks Location access for each line's own locationId", async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(10),
      });
      mockInventoryService.decreaseStock.mockResolvedValue({
        id: 'move-loc',
        balanceAfter: new Prisma.Decimal(5),
        changeQty: new Prisma.Decimal(-5),
      });

      await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: -5,
              reason: StockAdjustmentReason.DAMAGE,
            },
          ],
        },
        actor,
      );

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
    });

    it('turns a ForbiddenException from LocationAccessService into a per-line ERROR result, not a whole-request failure — sibling lines still apply', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(10),
      });
      mockLocationAccessService.assertHasLocationAccess
        .mockRejectedValueOnce(
          new ForbiddenException('You do not have access to this location'),
        )
        .mockResolvedValueOnce(undefined);
      mockInventoryService.decreaseStock.mockResolvedValue({
        id: 'move-loc-2',
        balanceAfter: new Prisma.Decimal(5),
        changeQty: new Prisma.Decimal(-5),
      });

      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'unassigned-loc',
              changeQuantity: -5,
              reason: StockAdjustmentReason.DAMAGE,
            },
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: -5,
              reason: StockAdjustmentReason.DAMAGE,
            },
          ],
        },
        actor,
      );

      expect(result.data.lines[0]).toMatchObject({
        status: 'ERROR',
        errorMessage: expect.stringContaining('access'),
      });
      expect(result.data.lines[1]).toMatchObject({ status: 'APPLIED' });
      expect(result.data.summary).toEqual({ appliedCount: 1, errorCount: 1 });
      expect(mockInventoryService.decreaseStock).toHaveBeenCalledTimes(1);
    });
  });

  describe('create — partial success across multiple lines', () => {
    it('a race-caused INSUFFICIENT_STOCK on one line does not block the other lines from applying', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(10),
      });
      mockInventoryService.decreaseStock
        .mockRejectedValueOnce(new ConflictException('INSUFFICIENT_STOCK'))
        .mockResolvedValueOnce({
          id: 'move-4',
          balanceAfter: new Prisma.Decimal(5),
          changeQty: new Prisma.Decimal(-5),
        });

      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: -50,
              reason: StockAdjustmentReason.DAMAGE,
            },
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: -5,
              reason: StockAdjustmentReason.DAMAGE,
            },
          ],
        },
        actor,
      );

      expect(result.data.lines[0]).toMatchObject({
        status: 'ERROR',
        errorMessage: expect.stringContaining('INSUFFICIENT_STOCK'),
      });
      expect(result.data.lines[1]).toMatchObject({ status: 'APPLIED' });
      expect(result.data.summary).toEqual({ appliedCount: 1, errorCount: 1 });
      // exactly one audit entry for the whole batch, not one per line
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('filters by tenantId/companyId only when no line-level filter is given', async () => {
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.stockAdjustment.count.mockResolvedValue(0);

      await service.list(context, {});

      expect(mockPrisma.stockMovement.findMany).not.toHaveBeenCalled();
      const [findManyArgs] = mockPrisma.stockAdjustment.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({
        tenantId: 'tenant-1',
        companyId: 'company-1',
      });
    });

    it('resolves locationId/reason to "batches containing a matching line" via StockMovement first', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([
        { referenceId: 'batch-1' },
        { referenceId: 'batch-2' },
      ]);
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.stockAdjustment.count.mockResolvedValue(0);

      await service.list(context, {
        locationId: 'loc-1',
        reason: StockAdjustmentReason.DAMAGE,
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'loc-1',
            reason: StockAdjustmentReason.DAMAGE,
          }),
        }),
      );
      const [findManyArgs] = mockPrisma.stockAdjustment.findMany.mock.calls[0];
      expect(findManyArgs.where.id).toEqual({ in: ['batch-1', 'batch-2'] });
    });

    it('returns a value-lost summary grouped by the 3 loss reasons, defaulting unmentioned reasons to zero', async () => {
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.stockAdjustment.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { reason: 'DAMAGE', value_lost: '150.0000' },
        { reason: 'EXPIRED', value_lost: '25.5000' },
      ]);

      const result = await service.list(context, {});

      expect(result.summary.valueLostByReason.DAMAGE.toString()).toBe('150');
      expect(result.summary.valueLostByReason.EXPIRED.toString()).toBe('25.5');
      expect(result.summary.valueLostByReason.THEFT_SHRINKAGE.toString()).toBe(
        '0',
      ); // never returned by the query -> defaults to 0, not undefined
      expect(result.summary.totalValueLost.toString()).toBe('175.5');
    });

    it('the value-lost query only ever asks for DAMAGE/THEFT_SHRINKAGE/EXPIRED, negative-quantity ADJUSTMENT rows', async () => {
      mockPrisma.stockAdjustment.findMany.mockResolvedValue([]);
      mockPrisma.stockAdjustment.count.mockResolvedValue(0);

      await service.list(context, {});

      const [sqlArg] = mockPrisma.$queryRaw.mock.calls[0];
      const sqlText = sqlArg.sql ?? sqlArg.strings?.join('');
      expect(sqlText).toContain('movementType');
      expect(sqlText).toContain('DAMAGE');
      expect(sqlText).toContain('THEFT_SHRINKAGE');
      expect(sqlText).toContain('EXPIRED');
      expect(sqlText).not.toContain('COUNT_MISMATCH');
      expect(sqlText).not.toContain('OPENING_STOCK');
    });
  });

  describe('OTHER reason requires a note (DTO-level, spot-checked at the service boundary)', () => {
    it('does not itself enforce the note — confirms that responsibility stays with the DTO validation pipe, not duplicated in the service', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({
        quantity: new Prisma.Decimal(0),
      });
      mockInventoryService.increaseStock.mockResolvedValue({
        id: 'move-5',
        balanceAfter: new Prisma.Decimal(5),
        changeQty: new Prisma.Decimal(5),
      });
      const result = await service.create(
        context,
        {
          items: [
            {
              productId: 'p-1',
              locationId: 'loc-1',
              changeQuantity: 5,
              reason: StockAdjustmentReason.OTHER,
            },
          ],
        },
        actor,
      );
      expect(result.data.lines[0]).toMatchObject({ status: 'APPLIED' });
    });
  });
});
