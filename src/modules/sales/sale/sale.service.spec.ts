import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import {
  SalePaymentMethod,
  SaleStatus,
  StockMovementType,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import { NotificationService } from '../../notification/notification.service';
import { SaleService } from './sale.service';

describe('SaleService', () => {
  let service: SaleService;

  const mockTx = {
    sale: { create: jest.fn(), update: jest.fn() },
    customerDueLedger: { create: jest.fn() },
    customer: { update: jest.fn() },
    cashDrawerSession: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockPrisma = {
    companySettings: { findUniqueOrThrow: jest.fn() },
    product: { findMany: jest.fn() },
    customer: { findFirst: jest.fn() },
    sale: { findFirst: jest.fn(), findMany: jest.fn() },
    saleReturn: { findMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockInventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
  };

  /** Unrestricted by default — Location-scoping is exercised in its own dedicated describe block below. */
  const mockLocationAccessService = {
    assertHasLocationAccess: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: LocationAccessService, useValue: mockLocationAccessService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(SaleService);

    mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
      allowNegativeStock: false,
      enableTax: false,
      defaultTaxRate: 0,
      maxCustomerDueLimit: null,
    });
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'product-1', name: 'Rice', salePrice: 100, costPrice: 60 },
    ]);
    mockTx.$queryRaw.mockResolvedValue([{ lastNumber: 1 }]);
    mockTx.sale.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'sale-1', ...data, items: [], payments: [] }),
    );
    mockInventoryService.decreaseStock.mockResolvedValue({});
    mockTx.cashDrawerSession.findFirst.mockResolvedValue(null);
  });

  describe('create — cash drawer session attribution', () => {
    it('stamps cashDrawerSessionId when an OPEN session exists for this cashier at this location', async () => {
      mockTx.cashDrawerSession.findFirst.mockResolvedValue({ id: 'session-1' });

      await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 100 }],
        } as any,
        actor,
      );

      expect(mockTx.cashDrawerSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'loc-1',
            cashierId: 'user-1',
            status: 'OPEN',
          }),
        }),
      );
      const createCall = mockTx.sale.create.mock.calls[0][0];
      expect(createCall.data.cashDrawerSessionId).toBe('session-1');
    });

    it('leaves cashDrawerSessionId null (sale still succeeds) when no session is open for this cashier/location', async () => {
      const result = await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 100 }],
        } as any,
        actor,
      );

      const createCall = mockTx.sale.create.mock.calls[0][0];
      expect(createCall.data.cashDrawerSessionId).toBeNull();
      expect(result.success).toBe(true);
    });
  });

  describe('create — Location-Based Access Control', () => {
    it('checks Location access for dto.locationId before doing anything else', async () => {
      await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: 'CASH', amount: 100 }],
        } as any,
        actor,
      );

      expect(mockLocationAccessService.assertHasLocationAccess).toHaveBeenCalledWith(
        context,
        'loc-1',
      );
    });

    it('propagates ForbiddenException from LocationAccessService and never writes a Sale', async () => {
      mockLocationAccessService.assertHasLocationAccess.mockRejectedValueOnce(
        new ForbiddenException('You do not have access to this location'),
      );

      await expect(
        service.create(
          context,
          {
            locationId: 'unassigned-loc',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: 'CASH', amount: 100 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTx.sale.create).not.toHaveBeenCalled();
    });
  });

  describe('create — money math', () => {
    it('computes item discount -> sale discount -> tax (on post-discount value) -> round, in that order', async () => {
      mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
        allowNegativeStock: false,
        enableTax: true,
        defaultTaxRate: 10, // 10%
        maxCustomerDueLimit: null,
      });

      // 2 units @ 100 = 200, item discount 20 -> 180. Sale discount 10 -> 170. Tax 10% of 170 = 17. Total = 187.
      await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 2, discountAmount: 20 }],
          saleDiscountAmount: 10,
          payments: [{ method: SalePaymentMethod.CASH, amount: 187 }],
        },
        actor,
      );

      const createCall = mockTx.sale.create.mock.calls[0][0];
      expect(createCall.data.subtotal).toBe(200);
      expect(createCall.data.itemDiscountTotal).toBe(20);
      expect(createCall.data.saleDiscountAmount).toBe(10);
      expect(createCall.data.taxAmount).toBeCloseTo(17);
      expect(createCall.data.totalAmount).toBe(187);
    });

    it('rejects when the sum of payments does not equal the computed total', async () => {
      await expect(
        service.create(
          context,
          {
            locationId: 'loc-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.CASH, amount: 50 }], // total should be 100
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.sale.create).not.toHaveBeenCalled();
    });

    it('defaults unitPrice to the Product current salePrice when not overridden', async () => {
      await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 100 }],
        },
        actor,
      );

      const createCall = mockTx.sale.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].unitPrice).toBe(100);
    });
  });

  describe('create — stock, due, and rejection propagation', () => {
    it('calls decreaseStock with allowNegative read from CompanySettings (not hardcoded), and stamps unitCost from the Product snapshot', async () => {
      await service.create(
        context,
        {
          locationId: 'loc-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 100 }],
        },
        actor,
      );

      expect(mockInventoryService.decreaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          quantity: 1,
          movementType: StockMovementType.SALE,
          unitCost: 60,
          allowNegative: false,
        }),
      );
    });

    it('translates an INSUFFICIENT_STOCK ConflictException from decreaseStock into a BadRequestException', async () => {
      mockInventoryService.decreaseStock.mockRejectedValue(
        new ConflictException('INSUFFICIENT_STOCK'),
      );

      await expect(
        service.create(
          context,
          {
            locationId: 'loc-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.CASH, amount: 100 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a customerId when any payment uses the DUE method', async () => {
      await expect(
        service.create(
          context,
          {
            locationId: 'loc-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.DUE, amount: 100 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes a CustomerDueLedger DUE entry and increments Customer.dueBalance for the DUE portion', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'customer-1',
        dueBalance: 0,
      });

      await service.create(
        context,
        {
          locationId: 'loc-1',
          customerId: 'customer-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.DUE, amount: 100 }],
        },
        actor,
      );

      expect(mockTx.customerDueLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entryType: 'DUE',
            amount: 100,
            customerId: 'customer-1',
          }),
        }),
      );
      expect(mockTx.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { dueBalance: { increment: 100 } },
      });
    });

    it('does NOT block the sale when the due limit is exceeded — returns a non-blocking warning instead (decision #5)', async () => {
      mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
        allowNegativeStock: false,
        enableTax: false,
        defaultTaxRate: 0,
        maxCustomerDueLimit: 50,
      });
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'customer-1',
        dueBalance: 0,
      });

      const result = await service.create(
        context,
        {
          locationId: 'loc-1',
          customerId: 'customer-1',
          items: [{ productId: 'product-1', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.DUE, amount: 100 }], // exceeds the 50 limit
        },
        actor,
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('DUE_LIMIT_EXCEEDED');
      expect(mockTx.sale.create).toHaveBeenCalled();
    });

    describe('CUSTOMER_DUE_OVERDUE notification (edge-triggered, distinct from the `warnings` field above)', () => {
      it('fires when this sale crosses the customer from at-or-under the limit to over it', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          allowNegativeStock: false,
          enableTax: false,
          defaultTaxRate: 0,
          maxCustomerDueLimit: 50,
        });
        mockPrisma.customer.findFirst.mockResolvedValue({
          id: 'customer-1',
          name: 'Customer One',
          dueBalance: 0, // before = 0 <= 50
        });

        await service.create(
          context,
          {
            locationId: 'loc-1',
            customerId: 'customer-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.DUE, amount: 100 }], // after = 100 > 50
          },
          actor,
        );

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          context,
          expect.objectContaining({
            type: 'CUSTOMER_DUE_OVERDUE',
            relatedEntityType: 'CUSTOMER',
            relatedEntityId: 'customer-1',
            metadata: expect.objectContaining({
              customerName: 'Customer One',
              dueBalance: '100',
              limit: '50',
            }),
          }),
        );
      });

      it('does NOT re-fire when the customer was already over their due limit before this sale (duplicate-prevention)', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          allowNegativeStock: false,
          enableTax: false,
          defaultTaxRate: 0,
          maxCustomerDueLimit: 50,
        });
        mockPrisma.customer.findFirst.mockResolvedValue({
          id: 'customer-1',
          name: 'Customer One',
          dueBalance: 200, // already over the 50 limit before this sale
        });

        await service.create(
          context,
          {
            locationId: 'loc-1',
            customerId: 'customer-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.DUE, amount: 100 }],
          },
          actor,
        );

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });

      it('does not fire when the company has no configured due limit', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({
          id: 'customer-1',
          name: 'Customer One',
          dueBalance: 0,
        });

        await service.create(
          context,
          {
            locationId: 'loc-1',
            customerId: 'customer-1',
            items: [{ productId: 'product-1', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.DUE, amount: 100 }],
          },
          actor,
        );

        expect(mockNotificationService.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('void', () => {
    const completedSale = {
      id: 'sale-1',
      locationId: 'loc-1',
      customerId: 'customer-1',
      status: SaleStatus.COMPLETED,
      items: [{ productId: 'product-1', quantity: 2, unitCost: 60 }],
      payments: [{ method: SalePaymentMethod.DUE, amount: 200 }],
    };

    it('rejects voiding a sale that is not COMPLETED', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({
        ...completedSale,
        status: SaleStatus.VOIDED,
      });

      await expect(
        service.void(context, 'sale-1', { reason: 'x' } as any, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('restores stock via SALE_VOID_IN (a distinct type from SALE_RETURN_IN) for every line item', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(completedSale);
      mockTx.sale.update.mockResolvedValue({
        id: 'sale-1',
        status: SaleStatus.VOIDED,
      });

      await service.void(
        context,
        'sale-1',
        { reason: 'wrong quantity entered' },
        actor,
      );

      expect(mockInventoryService.increaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          quantity: 2,
          movementType: StockMovementType.SALE_VOID_IN,
        }),
      );
    });

    it('reverses the DUE portion of Customer.dueBalance', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(completedSale);
      mockTx.sale.update.mockResolvedValue({
        id: 'sale-1',
        status: SaleStatus.VOIDED,
      });

      await service.void(
        context,
        'sale-1',
        { reason: 'wrong quantity entered' },
        actor,
      );

      expect(mockTx.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { dueBalance: { decrement: 200 } },
      });
    });
  });

  describe('createReturn', () => {
    const completedSale = {
      id: 'sale-1',
      locationId: 'loc-1',
      customerId: null,
      status: SaleStatus.COMPLETED,
      items: [{ productId: 'product-1', quantity: 5, unitCost: 60 }],
      payments: [],
    };

    it('rejects returning items against a sale that is not COMPLETED', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({
        ...completedSale,
        status: SaleStatus.VOIDED,
      });

      await expect(
        service.createReturn(
          context,
          'sale-1',
          {
            reason: 'damaged',
            items: [{ productId: 'product-1', quantity: 1 }],
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('restores stock via SALE_RETURN_IN', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(completedSale);
      mockTx.sale.create = mockTx.sale.create; // no-op, saleReturn uses a separate model
      (mockTx as any).saleReturn = {
        create: jest.fn().mockResolvedValue({ id: 'return-1' }),
      };

      await service.createReturn(
        context,
        'sale-1',
        {
          reason: 'damaged',
          items: [{ productId: 'product-1', quantity: 1 }],
        },
        actor,
      );

      expect(mockInventoryService.increaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          quantity: 1,
          movementType: StockMovementType.SALE_RETURN_IN,
        }),
      );
    });
  });
});
