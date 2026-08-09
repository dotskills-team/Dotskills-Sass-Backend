import type {
  PrismaClient,
} from '../../src/generated/phase-1-prisma/client';

import { PERMISSION_CATALOG } from './data/permission-catalog';

export async function seedPermissions(
  prisma: PrismaClient,
): Promise<void> {
  console.log('Seeding permission catalog...');

  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        moduleCode: permission.moduleCode,
        resource: permission.resource,
        action: permission.action,
        name: permission.name,
        description: permission.description,
        isSystem: true,
        status: 'ACTIVE',
      },
      create: {
        code: permission.code,
        moduleCode: permission.moduleCode,
        resource: permission.resource,
        action: permission.action,
        name: permission.name,
        description: permission.description,
        isSystem: true,
        status: 'ACTIVE',
      },
    });
  }

  console.log(
    `Seeded ${PERMISSION_CATALOG.length} permissions.`,
  );
}