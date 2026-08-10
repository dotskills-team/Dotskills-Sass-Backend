import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const EXPECTED_PERMISSION_COUNT = 29;

const EXPECTED_ROLES = [
  { code: 'AUDITOR', permissionCount: 7 },
  { code: 'COMPLIANCE_OFFICER', permissionCount: 7 },
  { code: 'FINANCE_MANAGER', permissionCount: 6 },
  { code: 'PLATFORM_ADMIN', permissionCount: 15 },
  { code: 'PLATFORM_STAFF', permissionCount: 3 },
  { code: 'SALES_MANAGER', permissionCount: 7 },
  { code: 'SUPER_ADMIN', permissionCount: 21 },
  { code: 'SUPPORT_MANAGER', permissionCount: 4 },
] as const;

const EXPECTED_ROLE_CODES = EXPECTED_ROLES.map((role) => role.code);

@Injectable()
export class PlatformRbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      where: {
        isSystem: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        moduleCode: true,
        resource: true,
        action: true,
        name: true,
        description: true,
        status: true,
      },
      orderBy: [{ moduleCode: 'asc' }, { code: 'asc' }],
    });

    return {
      success: true,
      count: permissions.length,
      data: permissions,
    };
  }

  async getRoles() {
    const roles = await this.prisma.platformRole.findMany({
      where: {
        code: { in: [...EXPECTED_ROLE_CODES] },
        isSystem: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        status: true,
        _count: {
          select: {
            permissions: true,
            members: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return {
      success: true,
      count: roles.length,
      data: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        status: role.status,
        permissionCount: role._count.permissions,
        memberCount: role._count.members,
      })),
    };
  }

  async getRoleByCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase();

    const role = await this.prisma.platformRole.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        status: true,
        permissions: {
          where: { effect: 'ALLOW' },
          select: {
            effect: true,
            conditions: true,
            permission: {
              select: {
                id: true,
                code: true,
                moduleCode: true,
                resource: true,
                action: true,
                name: true,
                description: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(
        `Platform role "${code}" was not found.`,
      );
    }

    const permissions = [...role.permissions].sort((left, right) =>
      left.permission.code.localeCompare(right.permission.code),
    );

    return {
      success: true,
      data: {
        ...role,
        permissions,
        permissionCount: permissions.length,
      },
    };
  }

  async getSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();

    if (!email) {
      throw new Error('SUPER_ADMIN_EMAIL is missing in .env');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        emailVerifiedAt: true,
        passwordHash: true,
        platformMember: {
          select: {
            id: true,
            employeeCode: true,
            status: true,
            activatedAt: true,
            roles: {
              select: {
                platformRole: {
                  select: {
                    code: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Super Admin user "${email}" was not found.`,
      );
    }

    const roleCodes =
      user.platformMember?.roles.map(
        (assignment) => assignment.platformRole.code,
      ) ?? [];

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
        passwordHashExists: Boolean(user.passwordHash),
        platformMember: user.platformMember,
        platformMemberActive: user.platformMember?.status === 'ACTIVE',
        roleCodes,
        superAdminRoleAssigned: roleCodes.includes('SUPER_ADMIN'),
      },
    };
  }

  async getSeedStatus() {
    const [permissionCount, roles, superAdminResult] = await Promise.all([
      this.prisma.permission.count({
        where: {
          isSystem: true,
          status: 'ACTIVE',
        },
      }),
      this.prisma.platformRole.findMany({
        where: {
          code: { in: [...EXPECTED_ROLE_CODES] },
          isSystem: true,
          status: 'ACTIVE',
        },
        select: {
          code: true,
          _count: {
            select: { permissions: true },
          },
        },
      }),
      this.getSuperAdmin().catch(() => null),
    ]);

    const actualRolePermissionCounts = new Map(
      roles.map((role) => [role.code, role._count.permissions]),
    );

    const roleStatus = EXPECTED_ROLES.map((expectedRole) => {
      const actualPermissionCount =
        actualRolePermissionCounts.get(expectedRole.code) ?? 0;

      return {
        code: expectedRole.code,
        exists: actualRolePermissionCounts.has(expectedRole.code),
        expectedPermissionCount: expectedRole.permissionCount,
        actualPermissionCount,
        valid:
          actualRolePermissionCounts.has(expectedRole.code) &&
          actualPermissionCount === expectedRole.permissionCount,
      };
    });

    const superAdmin = superAdminResult?.data;
    const permissionsValid =
      permissionCount === EXPECTED_PERMISSION_COUNT;
    const rolesValid =
      roles.length === EXPECTED_ROLES.length &&
      roleStatus.every((role) => role.valid);
    const superAdminValid = Boolean(
      superAdmin &&
        superAdmin.status === 'ACTIVE' &&
        superAdmin.platformMemberActive &&
        superAdmin.passwordHashExists &&
        superAdmin.superAdminRoleAssigned,
    );

    return {
      success: true,
      data: {
        permissions: {
          expected: EXPECTED_PERMISSION_COUNT,
          actual: permissionCount,
          valid: permissionsValid,
        },
        roles: {
          expected: EXPECTED_ROLES.length,
          actual: roles.length,
          items: roleStatus,
          valid: rolesValid,
        },
        superAdmin: {
          exists: Boolean(superAdmin),
          userActive: superAdmin?.status === 'ACTIVE',
          platformMemberActive:
            superAdmin?.platformMemberActive ?? false,
          passwordHashExists:
            superAdmin?.passwordHashExists ?? false,
          roleAssigned:
            superAdmin?.superAdminRoleAssigned ?? false,
          valid: superAdminValid,
        },
        valid: permissionsValid && rolesValid && superAdminValid,
      },
    };
  }
}
