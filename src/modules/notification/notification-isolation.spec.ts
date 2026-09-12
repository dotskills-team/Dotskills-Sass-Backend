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
import { NotificationService } from './notification.service';
import {
  NotificationType,
  NotificationRelatedEntityType,
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
 * Mandatory multi-tenant isolation proof for the Notification Bell feature
 * (plan Section ৯) — same real-DB, service-layer approach as every prior
 * isolation spec this session. Proves two things: (1) Company A can never
 * read or mark-read Company B's Notification by id even when it knows the
 * real id; (2) a real Out-of-Stock event triggered in Company A never
 * creates a Notification row in Company B, even given an identically-shaped
 * product/location setup in both companies.
 */
describe('Notification — multi-tenant isolation (integration)', () => {
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
  let notificationService: NotificationService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'notification-isolation-spec',
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
    notificationService = moduleRef.get(NotificationService);

    tenantFixtures = await createIsolationTenantFixtures(prisma, 'notif');
    TENANT_1 = tenantFixtures.tenantAId;
    TENANT_2 = tenantFixtures.tenantBId;
    INDUSTRY_ID = tenantFixtures.industryId;

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'NOTIFISOA',
        legalName: 'Notification Isolation A (disposable)',
        baseCurrencyCode: 'BDT',
      },
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'NOTIFISOB',
        legalName: 'Notification Isolation B (disposable)',
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
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.stockMovement.deleteMany({ where: { companyId } });
      await prisma.inventory.deleteMany({ where: { companyId } });
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      // Notification.locationId is onDelete:Restrict on Location (the stock
      // hook always sets it) — must go before location.deleteMany().
      await prisma.notification.deleteMany({ where: { companyId } });
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

  it("Company A cannot read or mark-read Company B's Notification by id", async () => {
    const notificationB = await prisma.$transaction((tx) =>
      notificationService.create(tx, contextB, {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: contextB.companyMemberId,
        metadata: { memberName: 'B Owner', action: 'MEMBER_CREATED' },
      }),
    );

    const listedByA = await notificationService.listForCompany(contextA, {});
    expect(listedByA.data.some((n) => n.id === notificationB.id)).toBe(false);

    await expect(
      notificationService.markRead(contextA, notificationB.id),
    ).rejects.toThrow(NotFoundException);

    // Confirm Company B's notification is untouched by the rejected cross-tenant attempt.
    const stillUnread = await prisma.notification.findUniqueOrThrow({
      where: { id: notificationB.id },
    });
    expect(stillUnread.isRead).toBe(false);

    const marked = await notificationService.markRead(
      contextB,
      notificationB.id,
    );
    expect(marked.data.isRead).toBe(true);
  }, 30000);

  it('a real Out-of-Stock event triggered in Company A never creates a Notification row in Company B, even with an identically-shaped product/location setup', async () => {
    const [locA, unitA] = await Promise.all([
      locationService.create(
        contextA,
        { name: 'A Counter', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextA, { name: 'Piece', code: 'PCS' }, actor),
    ]);
    const [locB, unitB] = await Promise.all([
      locationService.create(
        contextB,
        { name: 'A Counter', locationType: 'BRANCH' as any },
        actor,
      ),
      unitService.create(contextB, { name: 'Piece', code: 'PCS' }, actor),
    ]);

    const productA = await productService.create(
      contextA,
      {
        sku: 'NOTIF-ISO-SKU',
        name: 'Notif Iso Product',
        baseUnitId: unitA.data.id,
        salePrice: 50,
        costPrice: 30,
      },
      actor,
    );
    const productB = await productService.create(
      contextB,
      {
        sku: 'NOTIF-ISO-SKU',
        name: 'Notif Iso Product',
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
        quantity: 5,
        movementType: StockMovementType.PURCHASE,
      }),
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

    // Only Company A's stock is decremented to zero — must fire OUT_OF_STOCK
    // only for Company A, never for Company B despite the identical setup.
    await prisma.$transaction((tx) =>
      inventoryService.decreaseStock(tx, {
        tenantId: TENANT_1,
        companyId: companyAId,
        productId: productA.data.id,
        locationId: locA.data.id,
        quantity: 5,
        movementType: StockMovementType.SALE,
        allowNegative: false,
      }),
    );

    const notificationsA = await prisma.notification.findMany({
      where: { companyId: companyAId, type: NotificationType.OUT_OF_STOCK },
    });
    expect(notificationsA).toHaveLength(1);
    expect(notificationsA[0].relatedEntityId).toBe(productA.data.id);

    // Company B legitimately has an unrelated STAFF_ACTIVITY notification
    // from the previous test — scope this check to OUT_OF_STOCK specifically,
    // the type this test actually triggers.
    const outOfStockNotificationsB = await prisma.notification.findMany({
      where: { companyId: companyBId, type: NotificationType.OUT_OF_STOCK },
    });
    expect(outOfStockNotificationsB).toHaveLength(0);
  }, 30000);
});
