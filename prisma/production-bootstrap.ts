import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
} from '../src/generated/phase-1-prisma/client';

import { hashPassword } from '../src/common/utils/password.util';
import { seedPermissions } from './seeds/seed-permissions';

import {
  SUPER_ADMIN_PERMISSION_CODES,
} from '../src/common/constants/permission-catalog';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is missing in environment variables.`);
  }

  return value;
}

const databaseUrl = getRequiredEnv('DATABASE_URL');
const superAdminEmail = getRequiredEnv('SUPER_ADMIN_EMAIL');
const superAdminPassword = getRequiredEnv('SUPER_ADMIN_PASSWORD');
const superAdminFullName = getRequiredEnv('SUPER_ADMIN_FULL_NAME');

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

/**
 * Ensure SUPER_ADMIN platform role and its canonical permissions.
 */
async function ensureSuperAdminRole(): Promise<string> {
  const role = await prisma.platformRole.upsert({
    where: {
      code: 'SUPER_ADMIN',
    },
    update: {
      name: 'Super Admin',
      description:
        'Complete administrative access to the DotSkills platform.',
      isSystem: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      description:
        'Complete administrative access to the DotSkills platform.',
      isSystem: true,
      status: 'ACTIVE',
    },
    select: {
      id: true,
    },
  });

  const permissions = await prisma.permission.findMany({
    where: {
      code: {
        in: [...SUPER_ADMIN_PERMISSION_CODES],
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const permissionIdByCode = new Map(
    permissions.map((permission) => [
      permission.code,
      permission.id,
    ]),
  );

  const missingPermissions = SUPER_ADMIN_PERMISSION_CODES.filter(
    (code) => !permissionIdByCode.has(code),
  );

  if (missingPermissions.length > 0) {
    throw new Error(
      `Missing SUPER_ADMIN permissions: ${missingPermissions.join(', ')}`,
    );
  }

  const expectedPermissionIds = SUPER_ADMIN_PERMISSION_CODES.map(
    (code) => permissionIdByCode.get(code)!,
  );

  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      /*
       * Only SUPER_ADMIN role mappings are reconciled here.
       * No other role is touched.
       */
      await tx.platformRolePermission.deleteMany({
        where: {
          platformRoleId: role.id,
          permissionId: {
            notIn: expectedPermissionIds,
          },
        },
      });

      for (const permissionId of expectedPermissionIds) {
        await tx.platformRolePermission.upsert({
          where: {
            platformRoleId_permissionId: {
              platformRoleId: role.id,
              permissionId,
            },
          },
          update: {
            effect: 'ALLOW',
          },
          create: {
            platformRoleId: role.id,
            permissionId,
            effect: 'ALLOW',
          },
        });
      }
    },
    {
      timeout: 30_000,
    },
  );

  console.log(
    `SUPER_ADMIN role synced with ${expectedPermissionIds.length} permissions.`,
  );

  return role.id;
}

/**
 * Ensure the platform Super Admin account and role assignment.
 *
 * Existing user's password is NOT overwritten.
 */
async function ensureSuperAdminUser(
  superAdminRoleId: string,
): Promise<void> {
  let user = await prisma.user.findUnique({
    where: {
      email: superAdminEmail,
    },
  });

  if (!user) {
    const passwordHash = await hashPassword(superAdminPassword);
    const now = new Date();

    user = await prisma.user.create({
      data: {
        email: superAdminEmail,
        fullName: superAdminFullName,
        passwordHash,
        preferredLocale: 'bn-BD',
        timezone: 'Asia/Dhaka',
        status: 'ACTIVE',
        emailVerifiedAt: now,
        passwordChangedAt: now,
      },
    });

    console.log(`Created Super Admin user: ${user.email}`);
  } else {
    /*
     * IMPORTANT:
     * Existing user's password and personal data are not overwritten.
     */
    console.log(
      `Super Admin user already exists: ${user.email}`,
    );
  }

  const platformMember = await prisma.platformMember.upsert({
    where: {
      userId: user.id,
    },
    update: {
      status: 'ACTIVE',
    },
    create: {
      userId: user.id,
      employeeCode: 'SA-001',
      status: 'ACTIVE',
      invitedAt: new Date(),
      activatedAt: new Date(),
    },
  });

  await prisma.platformMemberRole.upsert({
    where: {
      platformMemberId_platformRoleId: {
        platformMemberId: platformMember.id,
        platformRoleId: superAdminRoleId,
      },
    },
    update: {},
    create: {
      platformMemberId: platformMember.id,
      platformRoleId: superAdminRoleId,
      assignedByUserId: user.id,
    },
  });

  console.log(
    `SUPER_ADMIN role assignment ensured for ${user.email}.`,
  );
}

/**
 * Production-safe bootstrap.
 *
 * This intentionally does NOT seed:
 * - Industries
 * - Features
 * - Plans
 * - Plan prices
 * - Plan features
 * - Companies
 * - Tenants
 * - Customers
 * - Products
 * - Sales
 * - Purchases
 * - Invoices
 * - Payments
 * - Other client/business data
 */
async function main(): Promise<void> {
  console.log(
    'Starting production-safe Super Admin bootstrap...',
  );

  console.log('1. Syncing Permission Catalog...');
  await seedPermissions(prisma);

  console.log('2. Ensuring SUPER_ADMIN role...');
  const superAdminRoleId = await ensureSuperAdminRole();

  console.log('3. Ensuring Super Admin account...');
  await ensureSuperAdminUser(superAdminRoleId);

  console.log(
    'Production-safe Super Admin bootstrap completed successfully.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      'Production Super Admin bootstrap failed:',
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });