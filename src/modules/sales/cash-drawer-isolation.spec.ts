import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyManagementService } from '../company-management/company-management.service';
import { CompanyRbacService } from '../company-rbac/company-rbac.service';
import { LocationService } from '../master-data/location/location.service';
import { UnitService } from '../master-data/unit/unit.service';
import { ProductService } from '../master-data/product/product.service';
import { InventoryService } from '../master-data/inventory/inventory.service';
import { SaleService } from './sale/sale.service';
import { CashDrawerSessionService } from './cash-drawer/cash-drawer.service';
import {
  SalePaymentMethod,
  StockMovementType,
} from '../../generated/phase-1-prisma/enums';
import type { CompanyContext } from '../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  createIsolationTenantFixtures,
  cleanupIsolationTenantFixtures,
  type IsolationTenantFixtures,
} from '../../test-utils/isolation-tenant-fixtures';

/**
 * Extends the Phase 1–4 multi-tenant isolation proof to CashDrawerSession —
 * same real-DB, service-layer approach. Two disposable companies, same
 * actor.userId (a shared platform user acting in each company scope, same
 * pattern proven safe in every prior isolation spec since a CompanyContext
 * always carries its own tenantId/companyId), prove Company A can never
 * read/close Company B's session, and that Company A's Sales are never
 * attributable to Company B's session even with identically-shaped setups.
 */
describe('Business Ops Cash Drawer Session — multi-tenant isolation (integration)', () => {
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
  let saleService: SaleService;
  let cashDrawerSessionService: CashDrawerSessionService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'cash-drawer-isolation-spec',
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
    saleService = moduleRef.get(SaleService);
    cashDrawerSessionService = moduleRef.get(CashDrawerSessionService);

    tenantFixtures = await createIsolationTenantFixtures(prisma, 'cashdrw');
    TENANT_1 = tenantFixtures.tenantAId;
    TENANT_2 = tenantFixtures.tenantBId;
    INDUSTRY_ID = tenantFixtures.industryId;

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'DRAWERISOA',
        legalName: 'Cash Drawer Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'DRAWERISOB',
        legalName: 'Cash Drawer Isolation B (disposable)',
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
      await prisma.saleReturn.deleteMany({ where: { companyId } });
      await prisma.salePayment.deleteMany({ where: { sale: { companyId } } });
      await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
      await prisma.sale.deleteMany({ where: { companyId } });
      await prisma.saleSequence.deleteMany({ where: { companyId } });
      await prisma.cashDrawerSession.deleteMany({ where: { companyId } });
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

  it("Company A cannot read or close Company B's CashDrawerSession by id", async () => {
    const locB = await locationService.create(
      contextB,
      { name: 'B Counter', locationType: 'BRANCH' },
      actor,
    );

    const sessionB = await cashDrawerSessionService.openSession(
      contextB,
      { locationId: locB.data.id, openingBalance: 1000 },
      actor,
    );

    await expect(
      cashDrawerSessionService.findOne(contextA, sessionB.data.id, actor),
    ).rejects.toThrow(NotFoundException);
    await expect(
      cashDrawerSessionService.closeSession(
        contextA,
        sessionB.data.id,
        { actualClosingBalance: 999 } as any,
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    // Confirm Company B's session is untouched by the rejected cross-tenant attempt.
    const stillB = await cashDrawerSessionService.findOne(
      contextB,
      sessionB.data.id,
      actor,
    );
    expect(stillB.data.status).toBe('OPEN');
    expect(stillB.data.actualClosingBalance).toBeNull();

    await cashDrawerSessionService.closeSession(
      contextB,
      sessionB.data.id,
      { actualClosingBalance: 1000 },
      actor,
    );
  }, 30000);

  it("a CASH Sale rung up in Company A's context is never attributable to Company B's open session, even with an identically-scoped Location/product setup", async () => {
    const [locA, unitA] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'A Counter', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextA, { name: 'Piece', code: 'PCS' }, actor),
    ]);
    const productA = await productService.create(
      contextA,
      {
        sku: 'DRAWER-ISO-SKU',
        name: 'Drawer Iso Product',
        baseUnitId: unitA.data.id,
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

    const locB = await locationService.create(
      contextB,
      { name: 'B Counter 2', locationType: 'BRANCH' },
      actor,
    );
    // Company B opens a session at a Location that happens to have the same
    // human name pattern as Company A's — proves scoping is by real id, not name.
    const sessionB = await cashDrawerSessionService.openSession(
      contextB,
      { locationId: locB.data.id, openingBalance: 2000 },
      actor,
    );

    // Company A has NO open session anywhere — this sale must be untracked (cashDrawerSessionId null),
    // and must under no circumstances attach itself to Company B's open session.
    const saleA = await saleService.create(
      contextA,
      {
        locationId: locA.data.id,
        items: [{ productId: productA.data.id, quantity: 1 }],
        payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
      },
      actor,
    );

    const rawSaleA = await prisma.sale.findUniqueOrThrow({
      where: { id: saleA.data.id },
      select: { cashDrawerSessionId: true },
    });
    expect(rawSaleA.cashDrawerSessionId).toBeNull();

    // Closing Company B's session must show expectedClosingBalance unaffected by Company A's sale.
    const closedB = await cashDrawerSessionService.closeSession(
      contextB,
      sessionB.data.id,
      { actualClosingBalance: 2000 },
      actor,
    );
    expect(closedB.data.expectedClosingBalance?.toString()).toBe('2000'); // 2000 opening + 0 cash sales, A's sale never counted
    expect(closedB.data.variance?.toString()).toBe('0');
  }, 30000);
});
