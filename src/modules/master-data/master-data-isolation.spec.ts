import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyManagementService } from '../company-management/company-management.service';
import { LocationService } from './location/location.service';
import { ProductService } from './product/product.service';
import { UnitService } from './unit/unit.service';
import { CustomerService } from './customer/customer.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

/**
 * Proves the Business Ops Master Data module's multi-tenant isolation
 * (design document Section 9.4) at the service layer — real Prisma
 * against the real dev database, no mocks — since that's where the
 * actual tenantId+companyId filtering lives (the guard only resolves who
 * is asking; these services decide what they can see). Two disposable
 * companies are created via the real CompanyManagementService and torn
 * down afterward; neither real business data nor Renewal Test Co is
 * ever touched. This is deliberately NOT under test/*.e2e-spec.ts — that
 * harness's jest config is missing the src/ module-path mapping the main
 * `npm test` config already has (confirmed pre-existing and unrelated:
 * even the original app.e2e-spec.ts fails to resolve `src/...` imports
 * today) — fixing that shared config was out of scope for this change,
 * so this lives as a regular spec picked up by the already-working
 * runner instead.
 */
describe('Business Ops Master Data — multi-tenant isolation (integration)', () => {
  const TENANT_1 = '65b4d86b-9ce6-4d78-901c-440b0c0fd721';
  const TENANT_2 = '632bb8a8-f9f9-4093-a903-351e3614fc88';
  const INDUSTRY_ID = '5c961a18-af13-4638-b93d-b7faa4c502b7';
  const CREATOR_USER_ID = '774bb094-6628-422a-beaf-dc0ae9e50984';

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let companyManagementService: CompanyManagementService;
  let locationService: LocationService;
  let productService: ProductService;
  let unitService: UnitService;
  let customerService: CustomerService;

  let companyAId: string;
  let companyBId: string;
  let contextA: CompanyContext;
  let contextB: CompanyContext;
  const actor: AuthenticatedUser = {
    userId: CREATOR_USER_ID,
    sessionId: 'isolation-spec',
    email: 'admin@dotskills.com',
    fullName: 'Test Actor',
    preferredLocale: 'en',
    timezone: 'Asia/Dhaka',
    roles: [],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    prisma = moduleRef.get(PrismaService);
    companyManagementService = moduleRef.get(CompanyManagementService);
    locationService = moduleRef.get(LocationService);
    productService = moduleRef.get(ProductService);
    unitService = moduleRef.get(UnitService);
    customerService = moduleRef.get(CustomerService);

    const companyA = await companyManagementService.create(
      {
        tenantId: TENANT_1,
        industryId: INDUSTRY_ID,
        code: 'ISOA',
        legalName: 'Isolation Test A (disposable)',
        baseCurrencyCode: 'BDT',
      } as any,
      CREATOR_USER_ID,
    );
    const companyB = await companyManagementService.create(
      {
        tenantId: TENANT_2,
        industryId: INDUSTRY_ID,
        code: 'ISOB',
        legalName: 'Isolation Test B (disposable)',
        baseCurrencyCode: 'BDT',
      } as any,
      CREATOR_USER_ID,
    );

    companyAId = companyA.id;
    companyBId = companyB.id;
    contextA = { tenantId: TENANT_1, companyId: companyAId, companyMemberId: 'n/a', companyStatus: 'DRAFT', tenantStatus: 'ACTIVE', scopes: [] };
    contextB = { tenantId: TENANT_2, companyId: companyBId, companyMemberId: 'n/a', companyStatus: 'DRAFT', tenantStatus: 'ACTIVE', scopes: [] };
  }, 30000);

  afterAll(async () => {
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.product.deleteMany({ where: { companyId } });
      await prisma.unit.deleteMany({ where: { companyId } });
      await prisma.customer.deleteMany({ where: { companyId } });
      await prisma.supplier.deleteMany({ where: { companyId } });
      await prisma.category.deleteMany({ where: { companyId } });
      await prisma.location.deleteMany({ where: { companyId } });
      await prisma.companySettings.deleteMany({ where: { companyId } });
      await prisma.subscription.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await moduleRef.close();
  }, 30000);

  it('lets two different companies use the identical Location name, Unit code, Customer phone independently', async () => {
    const locA = await locationService.create(contextA, { name: 'Main Branch', locationType: 'BRANCH' as any }, actor);
    const locB = await locationService.create(contextB, { name: 'Main Branch', locationType: 'BRANCH' as any }, actor);
    expect(locA.data.name).toBe('Main Branch');
    expect(locB.data.name).toBe('Main Branch');
    expect(locA.data.id).not.toBe(locB.data.id);

    const unitA = await unitService.create(contextA, { name: 'Piece', code: 'PCS' }, actor);
    const unitB = await unitService.create(contextB, { name: 'Piece', code: 'PCS' }, actor);
    expect(unitA.data.code).toBe('PCS');
    expect(unitB.data.code).toBe('PCS');

    const custA = await customerService.create(contextA, { name: 'Karim', phone: '01700000000' }, actor);
    const custB = await customerService.create(contextB, { name: 'Rahim', phone: '01700000000' }, actor);
    expect(custA.data.phone).toBe('01700000000');
    expect(custB.data.phone).toBe('01700000000');

    const prodA = await productService.create(contextA, { sku: 'RICE-5KG', name: 'Rice 5kg', baseUnitId: unitA.data.id, barcode: '8801234567890' }, actor);
    const prodB = await productService.create(contextB, { sku: 'RICE-5KG', name: 'Rice 5kg', baseUnitId: unitB.data.id, barcode: '8801234567890' }, actor);
    expect(prodA.data.sku).toBe('RICE-5KG');
    expect(prodB.data.sku).toBe('RICE-5KG');
  }, 20000);

  it("Company A's context cannot read Company B's Location/Customer by id — 404, not leaked", async () => {
    const locB = await locationService.create(contextB, { name: 'Cross-Tenant-Read-Target', locationType: 'WAREHOUSE' as any }, actor);
    const custB = await customerService.create(contextB, { name: 'CrossTenantReadTarget', phone: '01711111111' }, actor);

    await expect(locationService.findOne(contextA, locB.data.id)).rejects.toThrow(NotFoundException);
    await expect(customerService.findOne(contextA, custB.data.id)).rejects.toThrow(NotFoundException);
  }, 20000);

  it("Company A's context cannot update Company B's resource, and Company B's row stays unchanged", async () => {
    const custB = await customerService.create(contextB, { name: 'CrossTenantWriteTarget', phone: '01722222222' }, actor);

    await expect(
      customerService.update(contextA, custB.data.id, { name: 'HACKED' }, actor),
    ).rejects.toThrow(NotFoundException);

    const stillB = await customerService.findOne(contextB, custB.data.id);
    expect(stillB.data.name).toBe('CrossTenantWriteTarget');
  }, 20000);

  it("Company A's list never returns any row belonging to Company B", async () => {
    await customerService.create(contextB, { name: 'OnlyInB', phone: '01733333333' }, actor);

    const listA = await customerService.list(contextA);
    const namesInA = listA.data.map((c) => c.name);
    expect(namesInA).not.toContain('OnlyInB');

    const idsInA = new Set(listA.data.map((c) => c.id));
    const listB = await customerService.list(contextB);
    for (const row of listB.data) {
      expect(idsInA.has(row.id)).toBe(false);
    }
  }, 20000);
});
