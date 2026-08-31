import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import {
  PurchaseOrderStatus,
  StockMovementType,
  SupplierLedgerEntryType,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { ProductCostingService } from '../../master-data/product/product-costing.service';
import { PurchaseOrderService } from './purchase-order.service';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;

  const mockTx = {
    purchaseOrder: { create: jest.fn(), update: jest.fn() },
    purchaseOrderItem: {
      deleteMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    goodsReceipt: { create: jest.fn() },
    purchaseReturn: { create: jest.fn() },
    supplierPayableLedger: { create: jest.fn() },
    supplier: { update: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockPrisma = {
    purchaseOrder: { findFirst: jest.fn(), findMany: jest.fn() },
    purchaseReturn: { findMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockInventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
  };
  const mockCostingService = { applyPurchaseCost: jest.fn() };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: ProductCostingService, useValue: mockCostingService },
      ],
    }).compile();

    service = module.get(PurchaseOrderService);
  });

  describe('update / cancel — DRAFT-only immutability', () => {
    it('rejects updating a purchase order that is not DRAFT', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
        items: [],
      });

      await expect(
        service.update(context, 'po-1', { note: 'x' } as any, actor),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('rejects cancelling a purchase order that is not DRAFT', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.FULLY_RECEIVED,
        items: [],
      });

      await expect(service.cancel(context, 'po-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('receive', () => {
    const draftOrder = {
      id: 'po-1',
      locationId: 'location-1',
      supplierId: 'supplier-1',
      status: PurchaseOrderStatus.DRAFT,
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          orderedQty: 10,
          receivedQty: 0,
          unitCost: 50,
        },
      ],
    };

    it('rejects receiving more than was ordered for a line item', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);

      await expect(
        service.receive(
          context,
          'po-1',
          {
            items: [{ purchaseOrderItemId: 'item-1', receivedQty: 15 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.goodsReceipt.create).not.toHaveBeenCalled();
    });

    it('rejects a purchaseOrderItemId that does not belong to this order', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);

      await expect(
        service.receive(
          context,
          'po-1',
          {
            items: [{ purchaseOrderItemId: 'not-mine', receivedQty: 1 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls applyPurchaseCost and increaseStock for each line, then sets PARTIALLY_RECEIVED when not all items are fully received', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
      mockTx.goodsReceipt.create.mockResolvedValue({ id: 'receipt-1' });
      mockCostingService.applyPurchaseCost.mockResolvedValue(50);
      mockInventoryService.increaseStock.mockResolvedValue({});
      mockTx.purchaseOrderItem.update.mockResolvedValue({});
      mockTx.purchaseOrderItem.findMany.mockResolvedValue([
        { orderedQty: 10, receivedQty: 4 },
      ]);
      mockTx.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      });

      await service.receive(
        context,
        'po-1',
        { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] },
        actor,
      );

      expect(mockCostingService.applyPurchaseCost).toHaveBeenCalledWith(
        mockTx,
        context,
        'product-1',
        4,
        50,
      );
      expect(mockInventoryService.increaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          locationId: 'location-1',
          quantity: 4,
          movementType: StockMovementType.PURCHASE,
          referenceId: 'receipt-1',
        }),
      );
      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
        }),
      );
    });

    it('sets FULLY_RECEIVED once every line item has received >= ordered', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
      mockTx.goodsReceipt.create.mockResolvedValue({ id: 'receipt-2' });
      mockCostingService.applyPurchaseCost.mockResolvedValue(50);
      mockInventoryService.increaseStock.mockResolvedValue({});
      mockTx.purchaseOrderItem.update.mockResolvedValue({});
      mockTx.purchaseOrderItem.findMany.mockResolvedValue([
        { orderedQty: 10, receivedQty: 10 },
      ]);
      mockTx.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.FULLY_RECEIVED,
      });

      await service.receive(
        context,
        'po-1',
        { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 10 }] },
        actor,
      );

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PurchaseOrderStatus.FULLY_RECEIVED },
        }),
      );
    });

    it('writes a SupplierPayableLedger PAYABLE entry and increments Supplier.payableBalance for the received value', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
      mockTx.goodsReceipt.create.mockResolvedValue({ id: 'receipt-3' });
      mockCostingService.applyPurchaseCost.mockResolvedValue(50);
      mockInventoryService.increaseStock.mockResolvedValue({});
      mockTx.purchaseOrderItem.update.mockResolvedValue({});
      mockTx.purchaseOrderItem.findMany.mockResolvedValue([
        { orderedQty: 10, receivedQty: 4 },
      ]);
      mockTx.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

      await service.receive(
        context,
        'po-1',
        { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] },
        actor,
      );

      expect(mockTx.supplierPayableLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entryType: SupplierLedgerEntryType.PAYABLE,
            amount: 200,
            supplierId: 'supplier-1',
          }),
        }),
      );
      expect(mockTx.supplier.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1' },
        data: { payableBalance: { increment: 200 } },
      });
    });
  });

  describe('createReturn', () => {
    const receivedOrder = {
      id: 'po-1',
      locationId: 'location-1',
      supplierId: 'supplier-1',
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      items: [],
    };

    it('rejects a return against a DRAFT order (nothing has ever been received)', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        ...receivedOrder,
        status: PurchaseOrderStatus.DRAFT,
      });

      await expect(
        service.createReturn(
          context,
          'po-1',
          {
            reason: 'damaged',
            items: [{ productId: 'product-1', quantity: 1 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls decreaseStock with allowNegative:false and movementType PURCHASE_RETURN_OUT', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(receivedOrder);
      mockTx.purchaseReturn.create.mockResolvedValue({ id: 'return-1' });
      mockInventoryService.decreaseStock.mockResolvedValue({});

      await service.createReturn(
        context,
        'po-1',
        {
          reason: 'damaged',
          items: [{ productId: 'product-1', quantity: 2 }],
        },
        actor,
      );

      expect(mockInventoryService.decreaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          quantity: 2,
          movementType: StockMovementType.PURCHASE_RETURN_OUT,
          allowNegative: false,
        }),
      );
    });
  });
});
