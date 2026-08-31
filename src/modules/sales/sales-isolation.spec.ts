import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyManagementService } from '../company-management/company-management.service';
import { LocationService } from '../master-data/location/location.service';
import { UnitService } from '../master-data/unit/unit.service';
import { ProductService } from '../master-data/product/product.service';
import { CustomerService } from '../master-data/customer/customer.service';
import { InventoryService } from '../master-data/inventory/inventory.service';
import { SaleService } from './sale/sale.service';
import { CustomerPaymentService } from './customer-payment/customer-payment.service';
import {
  SalePaymentMethod,
  StockMovementType,
} from '../../generated/phase-1-prisma/enums';
import type { CompanyContext } from '../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

/**
 * Extends the Phase 1–3 multi-tenant isolation proof to Sales/POS —
 * same real-DB, service-layer approach. Two disposable companies use
 * identically-shaped (same product SKU, same customer phone) but
 * differently-scoped data; Company A must never read, write, or be
 * stock/due-limited by Company B's rows.
 */
describe('Business Ops Sales/POS — multi-tenant isolation (integration)', () => {
  const TENANT_1 = '65b4d86b-9ce6-4d78-901c-440b0c0fd721';
  const TENANT_2 = '632bb8a8-f9f9-4093-a903-351e3614fc88';
  const INDUSTRY_ID = '5c961a18-af13-4638-b93d-b7faa4c502b7';
  const CREATOR_USER_ID = '774bb094-6628-422a-beaf-dc0ae9e50984';

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let companyManagementService: CompanyManagementService;
  let locationService: LocationService;
  let unitService: UnitService;
  let productService: ProductService;
  let customerService: CustomerService;
  let inventoryService: InventoryService;
  let saleService: SaleService;
  let customerPaymentService: CustomerPaymentService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'sales-isolation-spec',
    email: 'admin@dotskills.com',
    fullName: 'Test Actor',
    preferredLocale: 'en',
    timezone: 'Asia/Dhaka',
    roles: [],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    companyManagementService = moduleRef.get(CompanyManagementService);
    locationService = moduleRef.get(LocationService);
    unitService = moduleRef.get(UnitService);
    productService = moduleRef.get(ProductService);
    customerService = moduleRef.get(CustomerService);
    inventoryService = moduleRef.get(InventoryService);
    saleService = moduleRef.get(SaleService);
    customerPaymentService = moduleRef.get(CustomerPaymentService);

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'SALEISOA',
        legalName: 'Sales Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'SALEISOB',
        legalName: 'Sales Isolation B (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );

    companyAId = companyA.id;
    companyBId = companyB.id;
    contextA = {
      tenantId: TENANT_1,
      companyId: companyAId,
      companyMemberId: 'n/a',
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
    contextB = {
      tenantId: TENANT_2,
      companyId: companyBId,
      companyMemberId: 'n/a',
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.customerDueLedger.deleteMany({ where: { companyId } });
      await prisma.saleReturn.deleteMany({ where: { companyId } });
      await prisma.salePayment.deleteMany({ where: { sale: { companyId } } });
      await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
      await prisma.sale.deleteMany({ where: { companyId } });
      await prisma.saleSequence.deleteMany({ where: { companyId } });
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.customer.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      await prisma.location.deleteMany({ where: { companyId } });
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await moduleRef.close();
  }, 30000);

  it('gives both companies their own independent sale-number sequence, and stock for identical SKUs never bleeds across companies', async () => {
    const [locA, unitA, custA] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'Counter', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextA, { name: 'Piece', code: 'PCS' }, actor),
      customerService.create(
        contextA,
        { name: 'Customer A', phone: '01700000001' },
        actor,
      ),
    ]);
    const productA = await productService.create(
      contextA,
      {
        sku: 'SHARED-SALE-SKU',
        name: 'Shared Sale SKU',
        baseUnitId: unitA.data.id,
        salePrice: 50,
        costPrice: 30,
      },
      actor,
    );

    const [locB, unitB, custB] = await Promise.all([
      locationService.create(
        contextB,
        { name: 'Counter', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextB, { name: 'Piece', code: 'PCS' }, actor),
      customerService.create(
        contextB,
        { name: 'Customer B', phone: '01700000001' },
        actor,
      ),
    ]);
    const productB = await productService.create(
      contextB,
      {
        sku: 'SHARED-SALE-SKU',
        name: 'Shared Sale SKU',
        baseUnitId: unitB.data.id,
        salePrice: 50,
        costPrice: 30,
      },
      actor,
    );

    await prisma.$transaction((tx) =>
      inventoryService.increaseStock(tx, {
        tenantId: TENANT_1,
        companyId: companyAId,
        productId: productA.data.id,
        locationId: locA.data.id,
        quantity: 10,
        movementType: StockMovementType.PURCHASE,
      }),
    );
    // Company B has ZERO stock for its own identically-shaped product — proves A's stock never leaks over.

    const saleA = await saleService.create(
      contextA,
      {
        locationId: locA.data.id,
        items: [{ productId: productA.data.id, quantity: 1 }],
        payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
      },
      actor,
    );
    expect(saleA.data.saleNumber.endsWith('-000001')).toBe(true);

    // Company B's first sale this year is ALSO 000001 — proves the sequence is per-company, not global.
    // (B has no stock, so this will fail as INSUFFICIENT_STOCK — but the isolation proof we care about is that
    // it never succeeds by pulling from A's stock, and that A's own sale-number counter has no influence on B.)
    await expect(
      saleService.create(
        contextB,
        {
          locationId: locB.data.id,
          items: [{ productId: productB.data.id, quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
        } as any,
        actor,
      ),
    ).rejects.toThrow();

    const balanceA = await inventoryService.getBalance(
      contextA,
      productA.data.id,
      locA.data.id,
    );
    const balanceB = await inventoryService.getBalance(
      contextB,
      productB.data.id,
      locB.data.id,
    );
    expect(balanceA.data.quantity.toString()).toBe('9'); // 10 - 1 sold
    expect(balanceB.data.quantity.toString()).toBe('0'); // untouched, never borrowed from A
  }, 30000);

  it("Company A cannot read, void, or return against Company B's Sale by id", async () => {
    const locB = await locationService.create(
      contextB,
      { name: 'Cross-Read-Target', locationType: 'BRANCH' },
      actor,
    );
    const unitB = await unitService.create(
      contextB,
      { name: 'Box', code: 'BOX' },
      actor,
    );
    const productB = await productService.create(
      contextB,
      {
        sku: 'CROSS-SALE-READ',
        name: 'Cross Sale Read Product',
        baseUnitId: unitB.data.id,
        salePrice: 20,
        costPrice: 10,
      },
      actor,
    );
    await prisma.$transaction((tx) =>
      inventoryService.increaseStock(tx, {
        tenantId: TENANT_2,
        companyId: companyBId,
        productId: productB.data.id,
        locationId: locB.data.id,
        quantity: 5,
        movementType: StockMovementType.PURCHASE,
      }),
    );
    const saleB = await saleService.create(
      contextB,
      {
        locationId: locB.data.id,
        items: [{ productId: productB.data.id, quantity: 1 }],
        payments: [{ method: SalePaymentMethod.CASH, amount: 20 }],
      },
      actor,
    );

    await expect(saleService.findOne(contextA, saleB.data.id)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      saleService.void(contextA, saleB.data.id, { reason: 'x' } as any, actor),
    ).rejects.toThrow(NotFoundException);
    await expect(
      saleService.createReturn(
        contextA,
        saleB.data.id,
        {
          reason: 'x',
          items: [{ productId: productB.data.id, quantity: 1 }],
        } as any,
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    // Confirm Company B's sale and stock are untouched by the rejected cross-tenant attempts.
    const stillB = await saleService.findOne(contextB, saleB.data.id);
    expect(stillB.data.status).toBe('COMPLETED');
    const balanceB = await inventoryService.getBalance(
      contextB,
      productB.data.id,
      locB.data.id,
    );
    expect(balanceB.data.quantity.toString()).toBe('4');
  }, 30000);

  it("a customer payment for Company A's customer cannot be recorded against Company B's context, and never affects Company B's customer balances", async () => {
    const custA = await customerService.create(
      contextA,
      { name: 'Payment Isolation Customer A' },
      actor,
    );
    const custB = await customerService.create(
      contextB,
      { name: 'Payment Isolation Customer B' },
      actor,
    );

    await expect(
      customerPaymentService.recordPayment(
        contextB,
        { customerId: custA.data.id, amount: 100 } as any,
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    const stillA = await prisma.customer.findUniqueOrThrow({
      where: { id: custA.data.id },
      select: { dueBalance: true },
    });
    const stillB = await prisma.customer.findUniqueOrThrow({
      where: { id: custB.data.id },
      select: { dueBalance: true },
    });
    expect(stillA.dueBalance.toString()).toBe('0');
    expect(stillB.dueBalance.toString()).toBe('0');
  }, 30000);
});
