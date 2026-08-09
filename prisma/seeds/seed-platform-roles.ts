import type {
  Prisma,
  PrismaClient,
} from '../../src/generated/phase-1-prisma/client';

import { PLATFORM_ROLE_CATALOG } from './data/platform-role-catalog';

export async function seedPlatformRoles(
  prisma: PrismaClient,
): Promise<void> {
  console.log('Seeding platform system roles...');

  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
    },
  });

  const permissionIdByCode = new Map<string, string>(
    permissions.map(
      (permission: { id: string; code: string }) => [
        permission.code,
        permission.id,
      ],
    ),
  );

  for (const roleDefinition of PLATFORM_ROLE_CATALOG) {
    const role = await prisma.platformRole.upsert({
      where: {
        code: roleDefinition.code,
      },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
        status: 'ACTIVE',
      },
      create: {
        code: roleDefinition.code,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
        status: 'ACTIVE',
      },
    });

    const expectedPermissionIds: string[] =
      roleDefinition.permissionCodes.map(
        (permissionCode: string): string => {
          const permissionId =
            permissionIdByCode.get(permissionCode);

          if (!permissionId) {
            throw new Error(
              `Permission "${permissionCode}" was not found for role "${role.code}".`,
            );
          }

          return permissionId;
        },
      );

    await prisma.$transaction(
      async (
        transaction: Prisma.TransactionClient,
      ): Promise<void> => {
        await transaction.platformRolePermission.deleteMany({
          where: {
            platformRoleId: role.id,
            permissionId: {
              notIn: expectedPermissionIds,
            },
          },
        });

        for (const permissionId of expectedPermissionIds) {
          await transaction.platformRolePermission.upsert({
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
    );

    console.log(
      `Seeded role ${role.code} with ${expectedPermissionIds.length} permissions.`,
    );
  }
}