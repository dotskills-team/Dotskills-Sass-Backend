// import { ForbiddenException, Injectable } from "@nestjs/common";
// import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
// import {
//   COMPANY_PERMISSIONS,
//   PLATFORM_PERMISSIONS,
// } from "../../common/constants/permission.constants";
// import { PrismaService } from "../../prisma/prisma.service";

// type PermissionDefinition = {
//   code: string;
//   moduleCode: string;
//   resource: string;
//   action: string;
//   name: string;
// };

// const DEFINITIONS: PermissionDefinition[] = [
//   { code: PLATFORM_PERMISSIONS.STAFF_READ, moduleCode: "platform_access", resource: "staff", action: "read", name: "Read platform staff" },
//   { code: PLATFORM_PERMISSIONS.STAFF_CREATE, moduleCode: "platform_access", resource: "staff", action: "create", name: "Create platform staff" },
//   { code: PLATFORM_PERMISSIONS.STAFF_UPDATE, moduleCode: "platform_access", resource: "staff", action: "update", name: "Update platform staff" },
//   { code: PLATFORM_PERMISSIONS.STAFF_STATUS, moduleCode: "platform_access", resource: "staff", action: "status", name: "Change platform staff status" },
//   { code: PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN, moduleCode: "platform_access", resource: "staff", action: "role_assign", name: "Assign platform staff roles" },
//   { code: PLATFORM_PERMISSIONS.ROLE_READ, moduleCode: "platform_access", resource: "role", action: "read", name: "Read platform roles" },
//   { code: PLATFORM_PERMISSIONS.ROLE_UPDATE, moduleCode: "platform_access", resource: "role", action: "update", name: "Update platform roles" },
//   { code: PLATFORM_PERMISSIONS.ROLE_PERMISSION_ASSIGN, moduleCode: "platform_access", resource: "role", action: "permission_assign", name: "Assign platform role permissions" },
//   { code: PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP, moduleCode: "platform_access", resource: "company_rbac", action: "bootstrap", name: "Bootstrap company RBAC" },
//   { code: COMPANY_PERMISSIONS.RBAC_READ, moduleCode: "company_access", resource: "rbac", action: "read", name: "Read company RBAC" },
//   { code: COMPANY_PERMISSIONS.ROLE_CREATE, moduleCode: "company_access", resource: "role", action: "create", name: "Create company roles" },
//   { code: COMPANY_PERMISSIONS.ROLE_UPDATE, moduleCode: "company_access", resource: "role", action: "update", name: "Update company roles" },
//   { code: COMPANY_PERMISSIONS.ROLE_PERMISSION_ASSIGN, moduleCode: "company_access", resource: "role", action: "permission_assign", name: "Assign company role permissions" },
//   { code: COMPANY_PERMISSIONS.MEMBER_READ, moduleCode: "company_access", resource: "member", action: "read", name: "Read company members" },
//   { code: COMPANY_PERMISSIONS.MEMBER_CREATE, moduleCode: "company_access", resource: "member", action: "create", name: "Create company members" },
//   { code: COMPANY_PERMISSIONS.MEMBER_UPDATE, moduleCode: "company_access", resource: "member", action: "update", name: "Update company members" },
//   { code: COMPANY_PERMISSIONS.MEMBER_ROLE_ASSIGN, moduleCode: "company_access", resource: "member", action: "role_assign", name: "Assign company member roles" },
//   { code: COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN, moduleCode: "company_access", resource: "member", action: "scope_assign", name: "Assign company member scopes" },
// ];

// const SUPER_ADMIN_CODES = Object.values(PLATFORM_PERMISSIONS);
// const PLATFORM_ADMIN_CODES = [
//   PLATFORM_PERMISSIONS.STAFF_READ,
//   PLATFORM_PERMISSIONS.STAFF_CREATE,
//   PLATFORM_PERMISSIONS.STAFF_UPDATE,
//   PLATFORM_PERMISSIONS.STAFF_STATUS,
//   PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN,
//   PLATFORM_PERMISSIONS.ROLE_READ,
//   PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP,
// ];

// @Injectable()
// export class AccessControlSetupService {
//   constructor(private readonly prisma: PrismaService) {}

//   async setup(actor: AuthenticatedUser) {
//     if (!actor.roles.includes("SUPER_ADMIN")) {
//       throw new ForbiddenException("Only SUPER_ADMIN can run access-control setup");
//     }

//     const result = await this.prisma.$transaction(async (tx) => {
//       const permissionIds = new Map<string, string>();
//       for (const definition of DEFINITIONS) {
//         const existing = await tx.permission.findFirst({
//           where: {
//             OR: [
//               { code: definition.code },
//               {
//                 moduleCode: definition.moduleCode,
//                 resource: definition.resource,
//                 action: definition.action,
//               },
//             ],
//           },
//           select: { id: true },
//         });
//         const permission = existing
//           ? await tx.permission.update({
//               where: { id: existing.id },
//               data: { ...definition, isSystem: true, status: "ACTIVE" },
//               select: { id: true, code: true },
//             })
//           : await tx.permission.create({
//               data: { ...definition, isSystem: true, status: "ACTIVE" },
//               select: { id: true, code: true },
//             });
//         permissionIds.set(permission.code, permission.id);
//       }

//       const roles = await tx.platformRole.findMany({
//         where: { code: { in: ["SUPER_ADMIN", "PLATFORM_ADMIN"] }, status: "ACTIVE" },
//         select: { id: true, code: true },
//       });
//       for (const role of roles) {
//         const codes = role.code === "SUPER_ADMIN" ? SUPER_ADMIN_CODES : PLATFORM_ADMIN_CODES;
//         for (const code of codes) {
//           await tx.platformRolePermission.upsert({
//             where: {
//               platformRoleId_permissionId: {
//                 platformRoleId: role.id,
//                 permissionId: permissionIds.get(code)!,
//               },
//             },
//             update: { effect: "ALLOW", assignedByUserId: actor.userId },
//             create: {
//               platformRoleId: role.id,
//               permissionId: permissionIds.get(code)!,
//               effect: "ALLOW",
//               assignedByUserId: actor.userId,
//             },
//           });
//         }
//       }

//       await tx.auditLog.create({
//         data: {
//           actorUserId: actor.userId,
//           actorType: "PLATFORM_MEMBER",
//           action: "ACCESS_CONTROL_SETUP_COMPLETED",
//           entityType: "Permission",
//           afterData: {
//             permissionCodes: DEFINITIONS.map((item) => item.code),
//             mappedRoles: roles.map((role) => role.code),
//           },
//         },
//       });
//       return {
//         permissionsUpserted: permissionIds.size,
//         mappedRoles: roles.map((role) => role.code),
//       };
//     });
//     return { success: true, data: result };
//   }
// }

import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

import {
  COMPANY_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from '../../common/constants/permission.constants';

import {
  PERMISSION_CATALOG as DEFINITIONS,
  PLATFORM_ADMIN_PERMISSION_CODES as PLATFORM_ADMIN_CODES,
  SUPER_ADMIN_PERMISSION_CODES as SUPER_ADMIN_CODES,
} from '../../common/constants/permission-catalog';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * নিচের permission definitions এবং role→permission mapping এখন
 * `../../common/constants/permission-catalog.ts`-এ single source of
 * truth হিসেবে রাখা হয়েছে — `prisma db seed`-ও এই একই catalog ব্যবহার
 * করে, যাতে দুই bootstrap-পথ কখনো ভিন্ন permission তৈরি না করে।
 */

function validateDefinitions() {
  const definedCodes = new Set(
    DEFINITIONS.map((definition) => definition.code),
  );

  const missingPlatformCodes = Object.values(PLATFORM_PERMISSIONS).filter(
    (code) => !definedCodes.has(code),
  );

  const missingCompanyCodes = Object.values(COMPANY_PERMISSIONS).filter(
    (code) => !definedCodes.has(code),
  );

  const missingCodes = [...missingPlatformCodes, ...missingCompanyCodes];

  if (missingCodes.length > 0) {
    throw new InternalServerErrorException(
      `Missing permission definitions: ${missingCodes.join(', ')}`,
    );
  }
}

@Injectable()
export class AccessControlSetupService {
  constructor(private readonly prisma: PrismaService) {}

  async setup(actor: AuthenticatedUser) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can run access-control setup',
      );
    }

    validateDefinitions();

    const result = await this.prisma.$transaction(async (tx) => {
      const permissionIds = new Map<string, string>();

      for (const definition of DEFINITIONS) {
        const existing = await tx.permission.findFirst({
          where: {
            OR: [
              {
                code: definition.code,
              },
              {
                moduleCode: definition.moduleCode,
                resource: definition.resource,
                action: definition.action,
              },
            ],
          },
          select: {
            id: true,
          },
        });

        const permission = existing
          ? await tx.permission.update({
              where: {
                id: existing.id,
              },
              data: {
                ...definition,
                isSystem: true,
                status: 'ACTIVE',
              },
              select: {
                id: true,
                code: true,
              },
            })
          : await tx.permission.create({
              data: {
                ...definition,
                isSystem: true,
                status: 'ACTIVE',
              },
              select: {
                id: true,
                code: true,
              },
            });

        permissionIds.set(permission.code, permission.id);
      }

      const roles = await tx.platformRole.findMany({
        where: {
          code: {
            in: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          code: true,
        },
      });

      for (const role of roles) {
        const codes =
          role.code === 'SUPER_ADMIN'
            ? SUPER_ADMIN_CODES
            : PLATFORM_ADMIN_CODES;

        for (const code of codes) {
          const permissionId = permissionIds.get(code);

          if (!permissionId) {
            throw new InternalServerErrorException(
              `Permission ID missing for code: ${code}`,
            );
          }

          await tx.platformRolePermission.upsert({
            where: {
              platformRoleId_permissionId: {
                platformRoleId: role.id,
                permissionId,
              },
            },
            update: {
              effect: 'ALLOW',
              assignedByUserId: actor.userId,
            },
            create: {
              platformRoleId: role.id,
              permissionId,
              effect: 'ALLOW',
              assignedByUserId: actor.userId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'PLATFORM_MEMBER',
          action: 'ACCESS_CONTROL_SETUP_COMPLETED',
          entityType: 'Permission',
          afterData: {
            permissionCodes: DEFINITIONS.map((item) => item.code),
            mappedRoles: roles.map((role) => role.code),
          },
        },
      });

      return {
        permissionsUpserted: permissionIds.size,

        mappedRoles: roles.map((role) => role.code),
      };
    });

    return {
      success: true,
      data: result,
    };
  }
}
