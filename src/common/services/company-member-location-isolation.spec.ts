import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyManagementService } from '../../modules/company-management/company-management.service';
import { CompanyRbacService } from '../../modules/company-rbac/company-rbac.service';
import { LocationService } from '../../modules/master-data/location/location.service';
import { UnitService } from '../../modules/master-data/unit/unit.service';
import { ProductService } from '../../modules/master-data/product/product.service';
import { InventoryService } from '../../modules/master-data/inventory/inventory.service';
import { SaleService } from '../../modules/sales/sale/sale.service';
import { LocationAccessService } from './location-access.service';
import {
  SalePaymentMethod,
  StockMovementType,
} from '../../generated/phase-1-prisma/enums';
import type { CompanyContext } from '../types/company-context.type';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Mandatory multi-tenant isolation proof for the LBAC plan's chunk (f) —
 * same real-DB, service-layer approach as every prior isolation spec this
 * session. Proves two things the plan explicitly calls for: (1) Company A's
 * CompanyMemberLocation assignment is never readable from Company B's
 * context, even when both companies have an identically-named Location;
 * (2) a Company A actor genuinely assigned to their own Location is
 * correctly rejected when asked to act (via the real SaleService.create()
 * call site, not just the isolated primitive) against Company B's
 * same-shaped Location id.
 */
describe('CompanyMemberLocation — multi-tenant isolation (integration)', () => {
  const TENANT_1 = '65b4d86b-9ce6-4d78-901c-440b0c0fd721';
  const TENANT_2 = '632bb8a8-f9f9-4093-a903-351e3614fc88';
  const INDUSTRY_ID = '5c961a18-af13-4638-b93d-b7faa4c502b7';
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
  let locationAccessService: LocationAccessService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  let managerAMemberId: string;
  let managerContextA: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'company-member-location-isolation-spec',
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
    locationAccessService = moduleRef.get(LocationAccessService);

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'LOCISOA',
        legalName: 'Location Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'LOCISOB',
        legalName: 'Location Isolation B (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    companyAId = companyA.id;
    companyBId = companyB.id;

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

    // A real, non-Owner Manager-tier member in Company A — Owner/Admin hold
    // LOCATION_ACCESS_ALL automatically, which would make this isolation
    // proof trivially pass for the wrong reason (bypassing the restriction
    // entirely rather than exercising real CompanyMemberLocation scoping).
    const managerA = await companyRbacService.createMember(
      contextA,
      {
        email: 'loc-iso-manager-a@dotskills.test',
        fullName: 'Location Isolation Manager A',
        password: 'a-strong-password-123',
        roleCodes: ['MANAGER'],
      },
      actor,
    );
    managerAMemberId = managerA.data.id;
    managerContextA = {
      tenantId: TENANT_1,
      companyId: companyAId,
      companyMemberId: managerAMemberId,
      companyStatus: 'DRAFT',
      tenantStatus: 'ACTIVE',
      scopes: [],
    };
  }, 30000);

  afterAll(async () => {
    if (managerAMemberId) {
      await prisma.companyMemberLocation.deleteMany({
        where: { companyMemberId: managerAMemberId },
      });
    }
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.saleReturn.deleteMany({ where: { companyId } });
      await prisma.salePayment.deleteMany({ where: { sale: { companyId } } });
      await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
      await prisma.sale.deleteMany({ where: { companyId } });
      await prisma.saleSequence.deleteMany({ where: { companyId } });
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      await prisma.location.deleteMany({ where: { companyId } });
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      // RBAC rows — companyOwnership is onDelete:Restrict on companyMember,
      // so it must go first; deleting companyMember/companyRole cascades
      // their own child rows (companyMemberRole, companyMemberScope,
      // companyMemberLocation, companyRolePermission).
      await prisma.companyOwnership.deleteMany({ where: { companyId } });
      await prisma.companyMember.deleteMany({ where: { companyId } });
      await prisma.companyRole.deleteMany({ where: { companyId } });
      await prisma.notification.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await moduleRef.close();
  }, 30000);

  it("Company A's real Manager, assigned only to Company A's Location, is correctly scoped — Company B's identically-named Location never leaks into the assigned set, and enforcement never falls back to name matching", async () => {
    const [locA, locB] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'Shared-Name Location', locationType: 'BRANCH' as any },
        actor,
      ),
      locationService.create(
        contextB,
        { name: 'Shared-Name Location', locationType: 'BRANCH' as any },
        actor,
      ),
    ]);

    // Real assignment row — no dedicated assignment API exists yet in this
    // build order (that's chunk (g)'s frontend-facing endpoint); the direct
    // write here exercises exactly the same table the real endpoint will
    // write to, matching this session's precedent of testing the mechanism
    // ahead of its own convenience API.
    await prisma.companyMemberLocation.create({
      data: {
        tenantId: TENANT_1,
        companyId: companyAId,
        companyMemberId: managerAMemberId,
        locationId: locA.data.id,
      },
    });

    const assigned =
      await locationAccessService.getAssignedLocationIds(managerContextA);
    expect(assigned).toEqual([locA.data.id]);
    expect(assigned).not.toContain(locB.data.id);

    await expect(
      locationAccessService.assertHasLocationAccess(
        managerContextA,
        locA.data.id,
      ),
    ).resolves.toBeUndefined();
    await expect(
      locationAccessService.assertHasLocationAccess(
        managerContextA,
        locB.data.id,
      ),
    ).rejects.toThrow(ForbiddenException);
  }, 30000);

  it("Company A's Manager cannot use SaleService.create() against Company B's same-shaped Location id, and correctly succeeds against their own assigned Location", async () => {
    const [locA, locB] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'Sale-Test Location', locationType: 'BRANCH' as any },
        actor,
      ),
      locationService.create(
        contextB,
        { name: 'Sale-Test Location', locationType: 'BRANCH' as any },
        actor,
      ),
    ]);
    const unitA = await unitService.create(
      contextA,
      { name: 'Piece', code: 'PCS' },
      actor,
    );
    const productA = await productService.create(
      contextA,
      {
        sku: 'LOC-ISO-SALE-SKU',
        name: 'Location Isolation Sale Product',
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

    await prisma.companyMemberLocation.create({
      data: {
        tenantId: TENANT_1,
        companyId: companyAId,
        companyMemberId: managerAMemberId,
        locationId: locA.data.id,
      },
    });

    // Cross-tenant attempt: Company A's Manager tries to sell "at" Company
    // B's Location id (a real id belonging to a different company entirely,
    // not just an unassigned one) — must be rejected before any stock or
    // company-scoping logic even runs.
    await expect(
      saleService.create(
        managerContextA,
        {
          locationId: locB.data.id,
          items: [{ productId: productA.data.id, quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
        } as any,
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);

    // Positive control — the same Manager, same product, their own assigned
    // Location, succeeds normally.
    const saleA = await saleService.create(
      managerContextA,
      {
        locationId: locA.data.id,
        items: [{ productId: productA.data.id, quantity: 1 }],
        payments: [{ method: SalePaymentMethod.CASH, amount: 50 }],
      },
      actor,
    );
    expect(saleA.data.status).toBe('COMPLETED');

    // Confirm no Sale was ever written against Company B's Location as a
    // side effect of the rejected attempt.
    const leaked = await prisma.sale.findFirst({
      where: { locationId: locB.data.id },
    });
    expect(leaked).toBeNull();
  }, 30000);
});
