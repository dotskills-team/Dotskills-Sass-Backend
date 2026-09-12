import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyManagementService } from '../../company-management/company-management.service';
import { CompanyRbacService } from '../../company-rbac/company-rbac.service';
import { LocationService } from '../location/location.service';
import { UnitService } from '../unit/unit.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';
import { StockAdjustmentService } from './stock-adjustment.service';
import {
  StockAdjustmentReason,
  StockMovementType,
} from '../../../generated/phase-1-prisma/enums';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import {
  createIsolationTenantFixtures,
  cleanupIsolationTenantFixtures,
  type IsolationTenantFixtures,
} from '../../../test-utils/isolation-tenant-fixtures';

/**
 * Extends the Phase 1–5 multi-tenant isolation proof to Manual Stock
 * Adjustment — same real-DB, service-layer approach. Proves the explicit
 * per-line `tx.product.findFirst`/`tx.location.findFirst` existence check
 * (added specifically because this endpoint accepts arbitrary client-
 * supplied ids in a bulk array) actually rejects a foreign company's real
 * id, rather than silently writing an Inventory row against it.
 */
describe('Business Ops Stock Adjustment — multi-tenant isolation (integration)', () => {
  let TENANT_1: string;
  let TENANT_2: string;
  let INDUSTRY_ID: string;
  let tenantFixtures: IsolationTenantFixtures;
  const CREATOR_USER_ID = '774bb094-6628-422a-beaf-dc0ae9e50984';

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let companyManagementService: CompanyManagementService;
  let companyRbacService: CompanyRbacService;
  let locationService: LocationService;
  let unitService: UnitService;
  let productService: ProductService;
  let inventoryService: InventoryService;
  let stockAdjustmentService: StockAdjustmentService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'stock-adjustment-isolation-spec',
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
    companyRbacService = moduleRef.get(CompanyRbacService);
    locationService = moduleRef.get(LocationService);
    unitService = moduleRef.get(UnitService);
    productService = moduleRef.get(ProductService);
    inventoryService = moduleRef.get(InventoryService);
    stockAdjustmentService = moduleRef.get(StockAdjustmentService);

    tenantFixtures = await createIsolationTenantFixtures(prisma, 'stkadj');
    TENANT_1 = tenantFixtures.tenantAId;
    TENANT_2 = tenantFixtures.tenantBId;
    INDUSTRY_ID = tenantFixtures.industryId;

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'ADJISOA',
        legalName: 'Stock Adjustment Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'ADJISOB',
        legalName: 'Stock Adjustment Isolation B (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );

    companyAId = companyA.id;
    companyBId = companyB.id;

    // A real Owner CompanyMember is required so LocationAccessService's
    // permission-resolution queries (LOCATION_ACCESS_ALL, auto-inherited by
    // COMPANY_OWNER) have a real companyMemberId to resolve — 'n/a' would
    // fail the underlying UUID column, not just resolve to "no access".
    const bootstrapA = await companyRbacService.bootstrap(
      companyAId,
      { ownerUserId: CREATOR_USER_ID },
      actor,
    );
    const bootstrapB = await companyRbacService.bootstrap(
      companyBId,
      { ownerUserId: CREATOR_USER_ID },
      actor,
    );

    contextA = {
      tenantId: TENANT_1,
      companyId: companyAId,
      companyMemberId: bootstrapA.data.ownerMemberId!,
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
    contextB = {
      tenantId: TENANT_2,
      companyId: companyBId,
      companyMemberId: bootstrapB.data.ownerMemberId!,
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.stockAdjustment.deleteMany({ where: { companyId } });
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      await prisma.location.deleteMany({ where: { companyId } });
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      // RBAC rows created by bootstrap() in beforeAll — companyOwnership is
      // onDelete:Restrict on companyMember, so it must go first; deleting
      // companyMember/companyRole cascades their own child rows.
      await prisma.companyOwnership.deleteMany({ where: { companyId } });
      await prisma.companyMember.deleteMany({ where: { companyId } });
      await prisma.companyRole.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await cleanupIsolationTenantFixtures(prisma, tenantFixtures);
    await moduleRef.close();
  }, 30000);

  it("Company A submitting a line against Company B's real productId/locationId is rejected per-line, never writes into Company A's inventory against a foreign id", async () => {
    const locB = await locationService.create(
      contextB,
      { name: 'B Only Location', locationType: 'BRANCH' },
      actor,
    );
    const unitB = await unitService.create(
      contextB,
      { name: 'Piece', code: 'PCS' },
      actor,
    );
    const productB = await productService.create(
      contextB,
      {
        sku: 'CROSS-ADJ-SKU',
        name: 'Cross Adjustment Product',
        baseUnitId: unitB.data.id,
        salePrice: 10,
        costPrice: 5,
      },
      actor,
    );

    const result = await stockAdjustmentService.create(
      contextA,
      {
        items: [
          {
            productId: productB.data.id,
            locationId: locB.data.id,
            changeQuantity: 10,
            reason: StockAdjustmentReason.OPENING_STOCK,
          },
        ],
      },
      actor,
    );

    expect(result.data.lines[0]).toMatchObject({ status: 'ERROR' });
    expect(result.data.summary).toEqual({ appliedCount: 0, errorCount: 1 });

    // Confirm no Inventory row was ever created in Company A pointing at Company B's product.
    const leakedInventory = await prisma.inventory.findFirst({
      where: { companyId: companyAId, productId: productB.data.id },
    });
    expect(leakedInventory).toBeNull();

    // Confirm Company B's own product stock is untouched by the rejected cross-tenant attempt.
    const stillB = await inventoryService.getBalance(
      contextB,
      productB.data.id,
      locB.data.id,
    );
    expect(stillB.data.quantity.toString()).toBe('0');
  }, 30000);

  it("Company A cannot read Company B's StockAdjustment batch by id, and per-company data with identically-shaped setups never bleeds across", async () => {
    const [locA, unitA] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'Shared-Name Location 2', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextA, { name: 'Box', code: 'BOX' }, actor),
    ]);
    const productA = await productService.create(
      contextA,
      {
        sku: 'SHARED-ADJ-SKU',
        name: 'Shared Adjustment Product',
        baseUnitId: unitA.data.id,
        salePrice: 10,
        costPrice: 5,
      },
      actor,
    );

    const [locB, unitB] = await Promise.all([
      locationService.create(
        contextB,
        { name: 'Shared-Name Location 2', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextB, { name: 'Box', code: 'BOX' }, actor),
    ]);
    const productB = await productService.create(
      contextB,
      {
        sku: 'SHARED-ADJ-SKU',
        name: 'Shared Adjustment Product',
        baseUnitId: unitB.data.id,
        salePrice: 10,
        costPrice: 5,
      },
      actor,
    );

    const batchA = await stockAdjustmentService.create(
      contextA,
      {
        items: [
          {
            productId: productA.data.id,
            locationId: locA.data.id,
            changeQuantity: 25,
            reason: StockAdjustmentReason.OPENING_STOCK,
          },
        ],
      },
      actor,
    );
    const batchB = await stockAdjustmentService.create(
      contextB,
      {
        items: [
          {
            productId: productB.data.id,
            locationId: locB.data.id,
            changeQuantity: 99,
            reason: StockAdjustmentReason.OPENING_STOCK,
          },
        ],
      },
      actor,
    );

    expect(batchA.data.lines[0]).toMatchObject({ status: 'APPLIED' });
    expect(batchB.data.lines[0]).toMatchObject({ status: 'APPLIED' });

    await expect(
      stockAdjustmentService.findOne(contextA, batchB.data.batchId),
    ).rejects.toThrow(NotFoundException);

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
    expect(balanceA.data.quantity.toString()).toBe('25');
    expect(balanceB.data.quantity.toString()).toBe('99');

    // Company A's list() never returns Company B's batch.
    const listA = await stockAdjustmentService.list(contextA);
    expect(listA.data.some((b) => b.id === batchB.data.batchId)).toBe(false);
  }, 30000);
});
