import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import {
  PurchaseOrderStatus,
  StockMovementType,
  SupplierLedgerEntryType,
  NotificationType,
  NotificationRelatedEntityType,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { ProductCostingService } from '../../master-data/product/product-costing.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import { NotificationService } from '../../notification/notification.service';
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
    supplier: { update: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockPrisma = {
    purchaseOrder: { findFirst: jest.fn(), findMany: jest.fn() },
    purchaseReturn: { findMany: jest.fn() },
    companySettings: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockInventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
  };
  const mockCostingService = { applyPurchaseCost: jest.fn() };
  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
  };
  const mockNotificationService = { create: jest.fn() };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocationAccessService.assertHasLocationAccess.mockResolvedValue(
      undefined,
    );
    mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
      maxSupplierPayableLimit: null,
    });
    mockTx.supplier.findUnique.mockResolvedValue({
      name: 'Test Supplier',
      payableBalance: 0,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: ProductCostingService, useValue: mockCostingService },
        {
          provide: LocationAccessService,
          useValue: mockLocationAccessService,
        },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(PurchaseOrderService);
  });

  describe('create — Location-Based Access Control', () => {
    beforeEach(() => {
      mockTx.$queryRaw.mockResolvedValue([{ lastNumber: 1 }]);
      mockTx.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
    });

    it('checks Location access for dto.locationId before doing anything else', async () => {
      await service.create(
        context,
        {
          supplierId: 'supplier-1',
          locationId: 'loc-1',
          items: [{ productId: 'product-1', orderedQty: 1, unitCost: 10 }],
        } as any,
        actor,
      );

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
    });

    it('propagates ForbiddenException from LocationAccessService and never writes a PurchaseOrder', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.create(
          context,
          {
            supplierId: 'supplier-1',
            locationId: 'unassigned-loc',
            items: [{ productId: 'product-1', orderedQty: 1, unitCost: 10 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.purchaseOrder.create).not.toHaveBeenCalled();
    });
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

    it("checks Location access for the loaded order's own locationId", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
      mockTx.goodsReceipt.create.mockResolvedValue({ id: 'receipt-loc' });
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

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'location-1');
    });

    it('propagates ForbiddenException from LocationAccessService and never creates a GoodsReceipt', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.receive(
          context,
          'po-1',
          { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.goodsReceipt.create).not.toHaveBeenCalled();
    });

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

    describe('SUPPLIER_PAYABLE_OVERDUE notification (edge-triggered, mirrors CUSTOMER_DUE_OVERDUE in sale.service.ts)', () => {
      beforeEach(() => {
        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftOrder);
        mockTx.goodsReceipt.create.mockResolvedValue({ id: 'receipt-notify' });
        mockCostingService.applyPurchaseCost.mockResolvedValue(50);
        mockInventoryService.increaseStock.mockResolvedValue({});
        mockTx.purchaseOrderItem.update.mockResolvedValue({});
        mockTx.purchaseOrderItem.findMany.mockResolvedValue([
          { orderedQty: 10, receivedQty: 4 },
        ]);
        mockTx.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });
      });

      it('fires when this receipt crosses the configured payable limit', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          maxSupplierPayableLimit: 1000,
        });
        mockTx.supplier.findUnique.mockResolvedValue({
          name: 'Rahim Traders',
          payableBalance: 900,
        });

        await service.receive(
          context,
          'po-1',
          { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] },
          actor,
        );

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          context,
          {
            type: NotificationType.SUPPLIER_PAYABLE_OVERDUE,
            relatedEntityType: NotificationRelatedEntityType.SUPPLIER,
            relatedEntityId: 'supplier-1',
            metadata: {
              supplierName: 'Rahim Traders',
              payableBalance: '1100',
              limit: '1000',
            },
          },
        );
      });

      it('does not re-fire when the supplier was already over the limit before this receipt (duplicate-prevention proof)', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          maxSupplierPayableLimit: 1000,
        });
        mockTx.supplier.findUnique.mockResolvedValue({
          name: 'Rahim Traders',
          payableBalance: 1100,
        });

        await service.receive(
          context,
          'po-1',
          { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] },
          actor,
        );

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });

      it('does not fire when no payable limit is configured for the company', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          maxSupplierPayableLimit: null,
        });
        mockTx.supplier.findUnique.mockResolvedValue({
          name: 'Rahim Traders',
          payableBalance: 900,
        });

        await service.receive(
          context,
          'po-1',
          { items: [{ purchaseOrderItemId: 'item-1', receivedQty: 4 }] },
          actor,
        );

        expect(mockNotificationService.create).not.toHaveBeenCalled();
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

    it("checks Location access for the loaded order's own locationId", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(receivedOrder);
      mockTx.purchaseReturn.create.mockResolvedValue({ id: 'return-loc' });
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

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'location-1');
    });

    it('propagates ForbiddenException from LocationAccessService and never creates a PurchaseReturn', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(receivedOrder);
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.createReturn(
          context,
          'po-1',
          {
            reason: 'damaged',
            items: [{ productId: 'product-1', quantity: 2 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.purchaseReturn.create).not.toHaveBeenCalled();
    });

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
