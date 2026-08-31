import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyManagementService } from '../../company-management/company-management.service';
import { LocationService } from '../location/location.service';
import { UnitService } from '../unit/unit.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from './inventory.service';
import { StockMovementType } from '../../../generated/phase-1-prisma/enums';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';

/**
 * Extends the Phase 1 multi-tenant isolation proof (master-data-isolation.spec.ts)
 * to the Inventory/StockMovement ledger — same real-DB, service-layer approach.
 * Two disposable companies use identically-shaped (same SKU, same location name)
 * but differently-scoped Product/Location rows; Company A's stock operations
 * must never read, write, or be blocked by Company B's balances.
 */
describe('Business Ops Inventory Ledger — multi-tenant isolation (integration)', () => {
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
  let inventoryService: InventoryService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  let locA: string, locB: string, prodA: string, prodB: string;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'inventory-isolation-spec',
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
    inventoryService = moduleRef.get(InventoryService);

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'INVISOA',
        legalName: 'Inventory Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'INVISOB',
        legalName: 'Inventory Isolation B (disposable)',
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

    const [locationA, locationB] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'Main', locationType: 'BRANCH' as any },
        actor,
      ),
      locationService.create(
        contextB,
        { name: 'Main', locationType: 'BRANCH' as any },
        actor,
      ),
    ]);
    locA = locationA.data.id;
    locB = locationB.data.id;

    const [unitA, unitB] = await Promise.all([
      unitService.create(contextA, { name: 'Piece', code: 'PCS' }, actor),
      unitService.create(contextB, { name: 'Piece', code: 'PCS' }, actor),
    ]);

    const [productA, productB] = await Promise.all([
      productService.create(
        contextA,
        {
          sku: 'SHARED-SKU',
          name: 'Shared SKU Product',
          baseUnitId: unitA.data.id,
        },
        actor,
      ),
      productService.create(
        contextB,
        {
          sku: 'SHARED-SKU',
          name: 'Shared SKU Product',
          baseUnitId: unitB.data.id,
        },
        actor,
      ),
    ]);
    prodA = productA.data.id;
    prodB = productB.data.id;
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      await prisma.location.deleteMany({ where: { companyId } });
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await moduleRef.close();
  }, 30000);

  it("increaseStock for Company A never affects Company B's balance, even with the identical SKU/location name", async () => {
    await prisma.$transaction((tx) =>
      inventoryService.increaseStock(tx, {
        tenantId: TENANT_1,
        companyId: companyAId,
        productId: prodA,
        locationId: locA,
        quantity: 50,
        movementType: StockMovementType.PURCHASE,
      }),
    );

    const balanceA = await inventoryService.getBalance(contextA, prodA, locA);
    const balanceB = await inventoryService.getBalance(contextB, prodB, locB);

    expect(balanceA.data.quantity.toString()).toBe('50');
    expect(balanceB.data.quantity.toString()).toBe('0');
  });

  it("decreaseStock rejects for Company A when Company A's own stock is insufficient, regardless of Company B's stock level for the same SKU", async () => {
    // Give Company B plenty of stock — must have zero influence on Company A's check.
    await prisma.$transaction((tx) =>
      inventoryService.increaseStock(tx, {
        tenantId: TENANT_2,
        companyId: companyBId,
        productId: prodB,
        locationId: locB,
        quantity: 1000,
        movementType: StockMovementType.PURCHASE,
      }),
    );

    // Company A only has 50 (from the previous test) — asking for 100 must fail.
    await expect(
      prisma.$transaction((tx) =>
        inventoryService.decreaseStock(tx, {
          tenantId: TENANT_1,
          companyId: companyAId,
          productId: prodA,
          locationId: locA,
          quantity: 100,
          movementType: StockMovementType.SALE,
          allowNegative: false,
        }),
      ),
    ).rejects.toThrow(ConflictException);

    const balanceA = await inventoryService.getBalance(contextA, prodA, locA);
    expect(balanceA.data.quantity.toString()).toBe('50');
  });

  it("Company A's StockMovement history never includes any of Company B's movements", async () => {
    await prisma.$transaction((tx) =>
      inventoryService.decreaseStock(tx, {
        tenantId: TENANT_1,
        companyId: companyAId,
        productId: prodA,
        locationId: locA,
        quantity: 5,
        movementType: StockMovementType.SALE,
        allowNegative: false,
      }),
    );

    const movementsA = await inventoryService.listMovements(contextA, prodA);
    const movementsB = await inventoryService.listMovements(contextB, prodB);

    const idsInA = new Set(movementsA.data.map((m) => m.id));
    for (const movement of movementsB.data) {
      expect(idsInA.has(movement.id)).toBe(false);
    }
    // Company A should see exactly its own 2 movements (the 50 purchase + the 5 sale), not Company B's 1000 purchase.
    expect(movementsA.count).toBe(2);
  });
});
