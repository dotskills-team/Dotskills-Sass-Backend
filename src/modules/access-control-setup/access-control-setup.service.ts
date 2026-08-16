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
} from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";

import {
  COMPANY_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "../../common/constants/permission.constants";

import { PrismaService } from "../../prisma/prisma.service";

type PermissionDefinition = {
  code: string;
  moduleCode: string;
  resource: string;
  action: string;
  name: string;
};

const DEFINITIONS: PermissionDefinition[] = [
  // =====================================================
  // Platform Staff
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.STAFF_READ,
    moduleCode: "platform_access",
    resource: "staff",
    action: "read",
    name: "Read platform staff",
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_CREATE,
    moduleCode: "platform_access",
    resource: "staff",
    action: "create",
    name: "Create platform staff",
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_UPDATE,
    moduleCode: "platform_access",
    resource: "staff",
    action: "update",
    name: "Update platform staff",
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_STATUS,
    moduleCode: "platform_access",
    resource: "staff",
    action: "status",
    name: "Change platform staff status",
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN,
    moduleCode: "platform_access",
    resource: "staff",
    action: "role_assign",
    name: "Assign platform staff roles",
  },

  // =====================================================
  // Platform Roles
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.ROLE_READ,
    moduleCode: "platform_access",
    resource: "role",
    action: "read",
    name: "Read platform roles",
  },
  {
    code: PLATFORM_PERMISSIONS.ROLE_UPDATE,
    moduleCode: "platform_access",
    resource: "role",
    action: "update",
    name: "Update platform roles",
  },
  {
    code:
      PLATFORM_PERMISSIONS.ROLE_PERMISSION_ASSIGN,
    moduleCode: "platform_access",
    resource: "role",
    action: "permission_assign",
    name: "Assign platform role permissions",
  },

  // =====================================================
  // Company Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.COMPANY_READ,
    moduleCode: "company_management",
    resource: "company",
    action: "read",
    name: "Read companies",
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_CREATE,
    moduleCode: "company_management",
    resource: "company",
    action: "create",
    name: "Create companies",
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_UPDATE,
    moduleCode: "company_management",
    resource: "company",
    action: "update",
    name: "Update companies",
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_STATUS,
    moduleCode: "company_management",
    resource: "company",
    action: "status",
    name: "Change company status",
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_ACTIVATE,
    moduleCode: "company_management",
    resource: "company",
    action: "activate",
    name: "Activate companies",
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_SUSPEND,
    moduleCode: "company_management",
    resource: "company",
    action: "suspend",
    name: "Suspend companies",
  },

  // =====================================================
  // Company Owner Management
  // =====================================================
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_OWNER_READ,
    moduleCode: "company_management",
    resource: "company_owner",
    action: "read",
    name: "Read company owners",
  },
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_OWNER_CREATE,
    moduleCode: "company_management",
    resource: "company_owner",
    action: "create",
    name: "Create company owners",
  },
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_OWNER_UPDATE,
    moduleCode: "company_management",
    resource: "company_owner",
    action: "update",
    name: "Update company owners",
  },
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_OWNER_CHANGE,
    moduleCode: "company_management",
    resource: "company_owner",
    action: "change",
    name: "Change company owner",
  },
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_OWNER_STATUS,
    moduleCode: "company_management",
    resource: "company_owner",
    action: "status",
    name: "Change company owner status",
  },

  // =====================================================
  // Tenant Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.TENANT_CREATE,
    moduleCode: "tenant_management",
    resource: "tenant",
    action: "create",
    name: "Create tenants",
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_READ,
    moduleCode: "tenant_management",
    resource: "tenant",
    action: "read",
    name: "Read tenants",
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_UPDATE,
    moduleCode: "tenant_management",
    resource: "tenant",
    action: "update",
    name: "Update tenants",
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_STATUS,
    moduleCode: "tenant_management",
    resource: "tenant",
    action: "status",
    name: "Change tenant status",
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_DELETE,
    moduleCode: "tenant_management",
    resource: "tenant",
    action: "delete",
    name: "Delete tenants",
  },

  // =====================================================
  // Industry Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_READ,
    moduleCode: "industry_management",
    resource: "industry",
    action: "read",
    name: "Read industries",
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_CREATE,
    moduleCode: "industry_management",
    resource: "industry",
    action: "create",
    name: "Create industries",
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_UPDATE,
    moduleCode: "industry_management",
    resource: "industry",
    action: "update",
    name: "Update industries",
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_STATUS,
    moduleCode: "industry_management",
    resource: "industry",
    action: "status",
    name: "Change industry status",
  },
  {
    code:
      PLATFORM_PERMISSIONS.INDUSTRY_ACTIVATE,
    moduleCode: "industry_management",
    resource: "industry",
    action: "activate",
    name: "Activate industries",
  },
  {
    code:
      PLATFORM_PERMISSIONS.INDUSTRY_DEACTIVATE,
    moduleCode: "industry_management",
    resource: "industry",
    action: "deactivate",
    name: "Deactivate industries",
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_DELETE,
    moduleCode: "industry_management",
    resource: "industry",
    action: "delete",
    name: "Delete industries",
  },

  // =====================================================
  // Company RBAC Bootstrap
  // =====================================================
  {
    code:
      PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP,
    moduleCode: "platform_access",
    resource: "company_rbac",
    action: "bootstrap",
    name: "Bootstrap company RBAC",
  },

  // =====================================================
  // Feature Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.FEATURE_CREATE,
    moduleCode: "feature_management",
    resource: "feature",
    action: "create",
    name: "Create features",
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_READ,
    moduleCode: "feature_management",
    resource: "feature",
    action: "read",
    name: "Read features",
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_UPDATE,
    moduleCode: "feature_management",
    resource: "feature",
    action: "update",
    name: "Update features",
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_STATUS,
    moduleCode: "feature_management",
    resource: "feature",
    action: "status",
    name: "Change feature status",
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_ACTIVATE,
    moduleCode: "feature_management",
    resource: "feature",
    action: "activate",
    name: "Activate features",
  },
  {
    code:
      PLATFORM_PERMISSIONS.FEATURE_DEACTIVATE,
    moduleCode: "feature_management",
    resource: "feature",
    action: "deactivate",
    name: "Deactivate features",
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_ARCHIVE,
    moduleCode: "feature_management",
    resource: "feature",
    action: "archive",
    name: "Archive features",
  },

  // =====================================================
  // Plan Pricing
  // =====================================================
  {
    code:
      PLATFORM_PERMISSIONS.PLAN_PRICING_CREATE,
    moduleCode: "plan_pricing",
    resource: "plan_price",
    action: "create",
    name: "Create plan prices",
  },
  {
    code:
      PLATFORM_PERMISSIONS.PLAN_PRICING_READ,
    moduleCode: "plan_pricing",
    resource: "plan_price",
    action: "read",
    name: "Read plan prices",
  },
  {
    code:
      PLATFORM_PERMISSIONS.PLAN_PRICING_UPDATE,
    moduleCode: "plan_pricing",
    resource: "plan_price",
    action: "update",
    name: "Update plan prices",
  },
  {
    code:
      PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS,
    moduleCode: "plan_pricing",
    resource: "plan_price",
    action: "status",
    name: "Change plan price status",
  },

  // =====================================================
  // Platform Subscription Management
  // =====================================================
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_CREATE,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "create",
    name: "Create platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "read",
    name: "Read platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_UPDATE,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "update",
    name: "Update platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "change_plan",
    name: "Change platform subscription plan",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_CANCEL,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "cancel",
    name: "Cancel platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_RENEW,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "renew",
    name: "Renew platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_SUSPEND,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "suspend",
    name: "Suspend platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_REACTIVATE,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "reactivate",
    name: "Reactivate platform subscriptions",
  },
  {
    code:
      PLATFORM_PERMISSIONS.SUBSCRIPTION_EXPIRE,
    moduleCode: "subscription_management",
    resource: "subscription",
    action: "expire",
    name: "Expire platform subscriptions",
  },

  // =====================================================
  // Company RBAC
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.RBAC_READ,
    moduleCode: "company_access",
    resource: "rbac",
    action: "read",
    name: "Read company RBAC",
  },
  {
    code: COMPANY_PERMISSIONS.ROLE_CREATE,
    moduleCode: "company_access",
    resource: "role",
    action: "create",
    name: "Create company roles",
  },
  {
    code: COMPANY_PERMISSIONS.ROLE_UPDATE,
    moduleCode: "company_access",
    resource: "role",
    action: "update",
    name: "Update company roles",
  },
  {
    code:
      COMPANY_PERMISSIONS.ROLE_PERMISSION_ASSIGN,
    moduleCode: "company_access",
    resource: "role",
    action: "permission_assign",
    name: "Assign company role permissions",
  },

  // =====================================================
  // Company Member Management
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.MEMBER_READ,
    moduleCode: "company_access",
    resource: "member",
    action: "read",
    name: "Read company members",
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_CREATE,
    moduleCode: "company_access",
    resource: "member",
    action: "create",
    name: "Create company members",
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_UPDATE,
    moduleCode: "company_access",
    resource: "member",
    action: "update",
    name: "Update company members",
  },
  {
    code:
      COMPANY_PERMISSIONS.MEMBER_ROLE_ASSIGN,
    moduleCode: "company_access",
    resource: "member",
    action: "role_assign",
    name: "Assign company member roles",
  },
  {
    code:
      COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN,
    moduleCode: "company_access",
    resource: "member",
    action: "scope_assign",
    name: "Assign company member scopes",
  },

  // =====================================================
  // Company Subscription Management
  // =====================================================
  {
    code:
      COMPANY_PERMISSIONS.SUBSCRIPTION_READ,
    moduleCode: "company_subscription",
    resource: "subscription",
    action: "read",
    name: "Read own company subscription",
  },
  {
    code:
      COMPANY_PERMISSIONS.SUBSCRIPTION_AUTO_RENEW,
    moduleCode: "company_subscription",
    resource: "subscription",
    action: "auto_renew",
    name: "Update own company subscription auto-renew",
  },
  {
    code:
      COMPANY_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN,
    moduleCode: "company_subscription",
    resource: "subscription",
    action: "change_plan",
    name: "Change own company subscription plan",
  },
  {
    code:
      COMPANY_PERMISSIONS.SUBSCRIPTION_CANCEL,
    moduleCode: "company_subscription",
    resource: "subscription",
    action: "cancel",
    name: "Cancel own company subscription",
  },
  {
    code:
      COMPANY_PERMISSIONS.SUBSCRIPTION_REACTIVATE,
    moduleCode: "company_subscription",
    resource: "subscription",
    action: "reactivate",
    name: "Reactivate own company subscription",
  },
];

const SUPER_ADMIN_CODES: readonly string[] =
  Object.values(PLATFORM_PERMISSIONS);

const PLATFORM_ADMIN_CODES: readonly string[] = [
  PLATFORM_PERMISSIONS.STAFF_READ,
  PLATFORM_PERMISSIONS.STAFF_CREATE,
  PLATFORM_PERMISSIONS.STAFF_UPDATE,
  PLATFORM_PERMISSIONS.STAFF_STATUS,
  PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN,
  PLATFORM_PERMISSIONS.ROLE_READ,
  PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP,
];

function validateDefinitions() {
  const definedCodes = new Set(
    DEFINITIONS.map(
      (definition) => definition.code,
    ),
  );

  const missingPlatformCodes =
    Object.values(PLATFORM_PERMISSIONS).filter(
      (code) => !definedCodes.has(code),
    );

  const missingCompanyCodes =
    Object.values(COMPANY_PERMISSIONS).filter(
      (code) => !definedCodes.has(code),
    );

  const missingCodes = [
    ...missingPlatformCodes,
    ...missingCompanyCodes,
  ];

  if (missingCodes.length > 0) {
    throw new InternalServerErrorException(
      `Missing permission definitions: ${missingCodes.join(", ")}`,
    );
  }
}

@Injectable()
export class AccessControlSetupService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async setup(
    actor: AuthenticatedUser,
  ) {
    if (!actor.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException(
        "Only SUPER_ADMIN can run access-control setup",
      );
    }

    validateDefinitions();

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const permissionIds =
            new Map<string, string>();

          for (const definition of DEFINITIONS) {
            const existing =
              await tx.permission.findFirst({
                where: {
                  OR: [
                    {
                      code: definition.code,
                    },
                    {
                      moduleCode:
                        definition.moduleCode,
                      resource:
                        definition.resource,
                      action:
                        definition.action,
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
                    status: "ACTIVE",
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
                    status: "ACTIVE",
                  },
                  select: {
                    id: true,
                    code: true,
                  },
                });

            permissionIds.set(
              permission.code,
              permission.id,
            );
          }

          const roles =
            await tx.platformRole.findMany({
              where: {
                code: {
                  in: [
                    "SUPER_ADMIN",
                    "PLATFORM_ADMIN",
                  ],
                },
                status: "ACTIVE",
              },
              select: {
                id: true,
                code: true,
              },
            });

          for (const role of roles) {
            const codes =
              role.code === "SUPER_ADMIN"
                ? SUPER_ADMIN_CODES
                : PLATFORM_ADMIN_CODES;

            for (const code of codes) {
              const permissionId =
                permissionIds.get(code);

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
                  effect: "ALLOW",
                  assignedByUserId:
                    actor.userId,
                },
                create: {
                  platformRoleId: role.id,
                  permissionId,
                  effect: "ALLOW",
                  assignedByUserId:
                    actor.userId,
                },
              });
            }
          }

          await tx.auditLog.create({
            data: {
              actorUserId: actor.userId,
              actorType: "PLATFORM_MEMBER",
              action:
                "ACCESS_CONTROL_SETUP_COMPLETED",
              entityType: "Permission",
              afterData: {
                permissionCodes:
                  DEFINITIONS.map(
                    (item) => item.code,
                  ),
                mappedRoles:
                  roles.map(
                    (role) => role.code,
                  ),
              },
            },
          });

          return {
            permissionsUpserted:
              permissionIds.size,

            mappedRoles:
              roles.map(
                (role) => role.code,
              ),
          };
        },
      );

    return {
      success: true,
      data: result,
    };
  }
}


