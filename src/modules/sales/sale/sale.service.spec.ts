import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import {
  SalePaymentMethod,
  SaleStatus,
  StockMovementType,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { UnitConversionService } from '../../master-data/unit/unit-conversion.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import { NotificationService } from '../../notification/notification.service';
import { SaleService } from './sale.service';

/**
 * Unit-Conversion made every line-item value into a `Prisma.Decimal` by
 * the time it reaches `inventoryService` (even at factor 1, the
 * no-conversion case) — this asymmetric matcher compares via
 * `.toString()` instead of `toHaveBeenCalledWith`'s default deep-equal,
 * which would otherwise fail a Decimal against a plain number even when
 * the represented value is identical.
 */
function decimalMatch(expected: string) {
  return {
    asymmetricMatch: (actual: { toString(): string }) =>
      actual?.toString?.() === expected,
    toString: () => `Decimal(${expected})`,
  };
}

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
    productVariant: { findMany: jest.fn() },
    unit: { findFirst: jest.fn() },
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
    getBalance: jest.fn(),
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
        UnitConversionService,
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
      {
        id: 'product-1',
        name: 'Rice',
        salePrice: new Prisma.Decimal(100),
        costPrice: new Prisma.Decimal(60),
        baseUnitId: 'base-unit-1',
      },
    ]);
    mockTx.$queryRaw.mockResolvedValue([{ lastNumber: 1 }]);
    mockTx.sale.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'sale-1', ...data, items: [], payments: [] }),
    );
    mockInventoryService.decreaseStock.mockResolvedValue({});
    mockInventoryService.getBalance.mockResolvedValue({
      success: true,
      data: { quantity: new Prisma.Decimal(1000) },
    });
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

      expect(
        mockLocationAccessService.assertHasLocationAccess,
      ).toHaveBeenCalledWith(context, 'loc-1');
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
      expect(createCall.data.subtotal).toEqual(decimalMatch('200'));
      expect(createCall.data.itemDiscountTotal).toEqual(decimalMatch('20'));
      expect(createCall.data.saleDiscountAmount).toEqual(decimalMatch('10'));
      expect(createCall.data.taxAmount).toEqual(decimalMatch('17'));
      expect(createCall.data.totalAmount).toEqual(decimalMatch('187'));
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
      expect(createCall.data.items.create[0].unitPrice).toEqual(
        decimalMatch('100'),
      );
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
          quantity: decimalMatch('1'),
          movementType: StockMovementType.SALE,
          unitCost: decimalMatch('60'),
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
        dueBalance: new Prisma.Decimal(0),
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
            amount: decimalMatch('100'),
            customerId: 'customer-1',
          }),
        }),
      );
      expect(mockTx.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { dueBalance: { increment: decimalMatch('100') } },
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
        dueBalance: new Prisma.Decimal(0),
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
          dueBalance: new Prisma.Decimal(0), // before = 0 <= 50
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
          dueBalance: new Prisma.Decimal(200), // already over the 50 limit before this sale
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
          dueBalance: new Prisma.Decimal(0),
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

  describe('create — offline-sync (idempotency + needs-review)', () => {
    const offlineSaleInput = {
      locationId: 'loc-1',
      items: [{ productId: 'product-1', quantity: 5 }],
      payments: [{ method: SalePaymentMethod.CASH, amount: 500 }],
    };

    describe('idempotent replay', () => {
      it('returns the existing Sale instead of creating a duplicate when idempotencyKey was already used', async () => {
        const existingSale = {
          id: 'sale-existing',
          idempotencyKey: 'offline-key-1',
        };
        mockPrisma.sale.findFirst.mockResolvedValue(existingSale);

        const result = await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-1' },
          actor,
        );

        expect(result).toEqual({
          success: true,
          data: existingSale,
          warnings: [],
        });
        expect(mockTx.sale.create).not.toHaveBeenCalled();
      });

      it('checks for an existing sale scoped to tenant+company+idempotencyKey', async () => {
        mockPrisma.sale.findFirst.mockResolvedValue(null);

        await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-2' },
          actor,
        );

        expect(mockPrisma.sale.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenantId: 'tenant-1',
              companyId: 'company-1',
              idempotencyKey: 'offline-key-2',
            },
          }),
        );
      });

      it('never checks for an existing sale when idempotencyKey is omitted (normal online sale, unchanged behavior)', async () => {
        await service.create(context, offlineSaleInput, actor);

        expect(mockPrisma.sale.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('needs-review (offline replay finds insufficient stock at sync time)', () => {
      beforeEach(() => {
        mockPrisma.sale.findFirst.mockResolvedValue(null);
      });

      it('records the sale as NEEDS_REVIEW and skips stock decrement when the offline replay finds insufficient stock', async () => {
        mockInventoryService.getBalance.mockResolvedValue({
          success: true,
          data: { quantity: new Prisma.Decimal(0) },
        });

        await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-3' },
          actor,
        );

        const createCall = mockTx.sale.create.mock.calls[0][0];
        expect(createCall.data.status).toBe(SaleStatus.NEEDS_REVIEW);
        expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
      });

      it('notifies with SALE_NEEDS_REVIEW when flagged', async () => {
        mockInventoryService.getBalance.mockResolvedValue({
          success: true,
          data: { quantity: new Prisma.Decimal(0) },
        });

        await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-4' },
          actor,
        );

        expect(mockNotificationService.create).toHaveBeenCalledWith(
          mockTx,
          context,
          expect.objectContaining({
            type: 'SALE_NEEDS_REVIEW',
            relatedEntityType: 'SALE',
          }),
        );
      });

      it('returns a NEEDS_REVIEW_INSUFFICIENT_STOCK warning instead of rejecting the sale', async () => {
        mockInventoryService.getBalance.mockResolvedValue({
          success: true,
          data: { quantity: new Prisma.Decimal(0) },
        });

        const result = await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-5' },
          actor,
        );

        expect(result.success).toBe(true);
        expect(result.warnings).toContain('NEEDS_REVIEW_INSUFFICIENT_STOCK');
      });

      it('proceeds as a normal COMPLETED sale (decrementing stock as usual) when the offline replay finds sufficient stock', async () => {
        mockInventoryService.getBalance.mockResolvedValue({
          success: true,
          data: { quantity: new Prisma.Decimal(1000) },
        });

        await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-6' },
          actor,
        );

        expect(mockInventoryService.decreaseStock).toHaveBeenCalled();
        const createCall = mockTx.sale.create.mock.calls[0][0];
        expect(createCall.data.status).toBeUndefined(); // omitted -> defaults to COMPLETED at the DB level
      });

      it('never runs the offline-sync stock pre-check for a normal online sale (no idempotencyKey) — insufficient stock still rejects the whole sale via the existing decreaseStock path, unchanged', async () => {
        mockInventoryService.decreaseStock.mockRejectedValue(
          new ConflictException('INSUFFICIENT_STOCK'),
        );

        await expect(
          service.create(context, offlineSaleInput as any, actor),
        ).rejects.toThrow(BadRequestException);
        expect(mockInventoryService.getBalance).not.toHaveBeenCalled();
      });

      it('skips the stock pre-check entirely when allowNegativeStock is true, even for an offline replay', async () => {
        mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
          allowNegativeStock: true,
          enableTax: false,
          defaultTaxRate: 0,
          maxCustomerDueLimit: null,
        });

        await service.create(
          context,
          { ...offlineSaleInput, idempotencyKey: 'offline-key-7' },
          actor,
        );

        expect(mockInventoryService.getBalance).not.toHaveBeenCalled();
        expect(mockInventoryService.decreaseStock).toHaveBeenCalled();
      });
    });
  });

  describe('void', () => {
    const completedSale = {
      id: 'sale-1',
      locationId: 'loc-1',
      customerId: 'customer-1',
      status: SaleStatus.COMPLETED,
      items: [
        {
          productId: 'product-1',
          quantity: new Prisma.Decimal(2),
          unitCost: new Prisma.Decimal(60),
        },
      ],
      payments: [
        { method: SalePaymentMethod.DUE, amount: new Prisma.Decimal(200) },
      ],
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
          quantity: decimalMatch('2'),
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
        data: { dueBalance: { decrement: decimalMatch('200') } },
      });
    });
  });

  describe('approveNeedsReview', () => {
    const needsReviewSale = {
      id: 'sale-2',
      locationId: 'loc-1',
      customerId: null,
      status: SaleStatus.NEEDS_REVIEW,
      items: [
        {
          productId: 'product-1',
          variantId: null,
          unitId: undefined,
          quantity: new Prisma.Decimal(5),
          unitCost: new Prisma.Decimal(60),
        },
      ],
      payments: [],
    };

    it('rejects approving a sale that is not NEEDS_REVIEW', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({
        ...needsReviewSale,
        status: SaleStatus.COMPLETED,
      });

      await expect(
        service.approveNeedsReview(context, 'sale-2', actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('decrements stock via the normal SALE movement type and sets status to COMPLETED when stock is now sufficient', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(needsReviewSale);
      mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
        allowNegativeStock: false,
      });
      mockInventoryService.decreaseStock.mockResolvedValue({});
      mockTx.sale.update.mockResolvedValue({
        id: 'sale-2',
        status: SaleStatus.COMPLETED,
      });

      const result = await service.approveNeedsReview(context, 'sale-2', actor);

      expect(mockInventoryService.decreaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'product-1',
          quantity: decimalMatch('5'),
          movementType: StockMovementType.SALE,
          referenceId: 'sale-2',
          allowNegative: false,
        }),
      );
      expect(mockTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: SaleStatus.COMPLETED },
        }),
      );
      expect(result.success).toBe(true);
    });

    it('translates a still-insufficient-stock ConflictException into a BadRequestException and never updates the sale', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(needsReviewSale);
      mockPrisma.companySettings.findUniqueOrThrow.mockResolvedValue({
        allowNegativeStock: false,
      });
      mockInventoryService.decreaseStock.mockRejectedValue(
        new ConflictException('INSUFFICIENT_STOCK'),
      );

      await expect(
        service.approveNeedsReview(context, 'sale-2', actor),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.sale.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectNeedsReview', () => {
    const needsReviewSaleWithDue = {
      id: 'sale-3',
      locationId: 'loc-1',
      customerId: 'customer-1',
      status: SaleStatus.NEEDS_REVIEW,
      items: [
        {
          productId: 'product-1',
          variantId: null,
          unitId: undefined,
          quantity: new Prisma.Decimal(5),
          unitCost: new Prisma.Decimal(60),
        },
      ],
      payments: [
        { method: SalePaymentMethod.DUE, amount: new Prisma.Decimal(500) },
      ],
    };

    it('rejects rejecting a sale that is not NEEDS_REVIEW', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({
        ...needsReviewSaleWithDue,
        status: SaleStatus.COMPLETED,
      });

      await expect(
        service.rejectNeedsReview(
          context,
          'sale-3',
          { reason: 'x' } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks the sale VOIDED and never touches Inventory (nothing was ever decremented)', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(needsReviewSaleWithDue);
      mockTx.sale.update.mockResolvedValue({
        id: 'sale-3',
        status: SaleStatus.VOIDED,
      });

      await service.rejectNeedsReview(
        context,
        'sale-3',
        { reason: 'customer no longer wants the item' },
        actor,
      );

      expect(mockTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SaleStatus.VOIDED,
            voidReason: 'customer no longer wants the item',
          }),
        }),
      );
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
    });

    it('reverses the DUE portion of Customer.dueBalance, same as void()', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(needsReviewSaleWithDue);
      mockTx.sale.update.mockResolvedValue({
        id: 'sale-3',
        status: SaleStatus.VOIDED,
      });

      await service.rejectNeedsReview(
        context,
        'sale-3',
        { reason: 'x' },
        actor,
      );

      expect(mockTx.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { dueBalance: { decrement: decimalMatch('500') } },
      });
    });
  });

  describe('createReturn', () => {
    const completedSale = {
      id: 'sale-1',
      locationId: 'loc-1',
      customerId: null,
      status: SaleStatus.COMPLETED,
      items: [
        {
          productId: 'product-1',
          quantity: new Prisma.Decimal(5),
          unitCost: new Prisma.Decimal(60),
        },
      ],
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
          quantity: decimalMatch('1'),
          movementType: StockMovementType.SALE_RETURN_IN,
        }),
      );
    });
  });
});
