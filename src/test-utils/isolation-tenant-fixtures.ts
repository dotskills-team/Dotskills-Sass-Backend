import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

export interface IsolationTenantFixtures {
  tenantAId: string;
  tenantBId: string;
  industryId: string;
}

/**
 * Shared setup for every multi-tenant isolation spec (Sales/Purchase/
 * Inventory/Notification/Stock Adjustment/Cash Drawer/Company Logo/
 * Master Data/Company Member Location): creates two disposable Tenants +
 * one disposable Industry, all with randomly-suffixed codes/slugs so
 * concurrent spec files (or repeated runs) never collide on the unique
 * constraints — replaces the old pattern of hardcoding real seeded
 * Tenant/Industry UUIDs, which broke every time those rows were
 * regenerated (e.g. a full local DB reseed).
 *
 * `prefix` should be short and spec-specific (e.g. "sales", "notif") —
 * it only affects the human-readable name/code, never uniqueness itself
 * (the random suffix already guarantees that).
 */
export async function createIsolationTenantFixtures(
  prisma: PrismaService,
  prefix: string,
): Promise<IsolationTenantFixtures> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);

  const [tenantA, tenantB, industry] = await Promise.all([
    prisma.tenant.create({
      data: {
        code: `${prefix}A${suffix}`.toUpperCase().slice(0, 40),
        name: `${prefix} Isolation Tenant A (disposable)`,
        slug: `${prefix}-a-${suffix}`.toLowerCase().slice(0, 120),
        status: 'ACTIVE',
      },
    }),
    prisma.tenant.create({
      data: {
        code: `${prefix}B${suffix}`.toUpperCase().slice(0, 40),
        name: `${prefix} Isolation Tenant B (disposable)`,
        slug: `${prefix}-b-${suffix}`.toLowerCase().slice(0, 120),
        status: 'ACTIVE',
      },
    }),
    prisma.industry.create({
      data: {
        code: `${prefix}IND${suffix}`.toUpperCase().slice(0, 50),
        name: `${prefix} Isolation Industry (disposable)`,
        status: 'ACTIVE',
      },
    }),
  ]);

  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    industryId: industry.id,
  };
}

/**
 * Deletes the fixtures created by createIsolationTenantFixtures(). Must be
 * called only after every Company referencing them has already been
 * deleted — Company.tenant/Company.industry are both onDelete: Restrict.
 */
export async function cleanupIsolationTenantFixtures(
  prisma: PrismaService,
  fixtures: IsolationTenantFixtures,
): Promise<void> {
  await prisma.tenant.delete({ where: { id: fixtures.tenantAId } });
  await prisma.tenant.delete({ where: { id: fixtures.tenantBId } });
  await prisma.industry.delete({ where: { id: fixtures.industryId } });
}
