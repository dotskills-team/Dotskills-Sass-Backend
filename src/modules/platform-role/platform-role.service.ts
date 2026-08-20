import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { SUPER_ADMIN_PERMISSION_CODES } from '../../common/constants/permission-catalog';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreatePlatformRoleDto,
  ReplacePlatformRolePermissionsDto,
  UpdatePlatformRoleDto,
  UpdatePlatformRoleStatusDto,
} from './dto/platform-role.dto';

const PLATFORM_PERMISSION_CODES: string[] = Object.values(PLATFORM_PERMISSIONS);

const ROLE_LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  status: true,
  _count: { select: { members: true, permissions: true } },
  permissions: {
    select: {
      effect: true,
      permission: { select: { code: true, name: true } },
    },
    orderBy: { permission: { code: 'asc' as const } },
  },
} satisfies Prisma.PlatformRoleSelect;

/**
 * `company-rbac.service.ts`-এর role-management method-গুলোর সাথে exactly mirror করে লেখা
 * (single-tenant vs company-scoped পার্থক্য বাদে) — একই validation/audit/conflict-handling
 * pattern। `permissions` table company-rbac-এর সাথে shared, তাই এখানে সবসময়
 * `PLATFORM_PERMISSION_CODES`-এর whitelist দিয়েই resolve করা হয় (company code কখনো leak
 * করে না) — `listPermissions()`-এ company-rbac-এর `listPermissions()`-এর মতোই।
 */
@Injectable()
export class PlatformRoleService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions() {
    const data = await this.prisma.permission.findMany({
      where: { code: { in: PLATFORM_PERMISSION_CODES }, status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        moduleCode: true,
        resource: true,
        action: true,
        name: true,
        description: true,
      },
      orderBy: { code: 'asc' },
    });
    return { success: true, count: data.length, data };
  }

  async listRoles() {
    const data = await this.prisma.platformRole.findMany({
      select: ROLE_LIST_SELECT,
      orderBy: { code: 'asc' },
    });
    return { success: true, count: data.length, data };
  }

  async getRole(roleId: string) {
    const role = await this.prisma.platformRole.findUnique({
      where: { id: roleId },
      select: ROLE_LIST_SELECT,
    });
    if (!role) throw new NotFoundException('Platform role was not found');
    return { success: true, data: role };
  }

  async createRole(dto: CreatePlatformRoleDto, actor: AuthenticatedUser) {
    const code = this.normalizeRoleCode(dto.code);
    const permissions = await this.resolvePermissions(dto.permissionCodes);

    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const created = await tx.platformRole.create({
          data: {
            code,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            isSystem: false,
            permissions: {
              create: permissions.map((permission) => ({
                permissionId: permission.id,
                effect: 'ALLOW',
                assignedByUserId: actor.userId,
              })),
            },
          },
          select: { id: true, code: true, name: true, description: true },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actor.userId,
            actorType: 'PLATFORM_MEMBER',
            action: 'PLATFORM_ROLE_CREATED',
            entityType: 'PlatformRole',
            entityId: created.id,
            afterData: created,
          },
        });

        return created;
      });
      return { success: true, data: role };
    } catch (error) {
      this.throwKnownConflict(error, 'Role code already exists');
      throw error;
    }
  }

  async updateRole(
    roleId: string,
    dto: UpdatePlatformRoleDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.requireRole(roleId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const role = await tx.platformRole.update({
        where: { id: roleId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isSystem: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'PLATFORM_MEMBER',
          action: 'PLATFORM_ROLE_UPDATED',
          entityType: 'PlatformRole',
          entityId: roleId,
          beforeData: current,
          afterData: role,
        },
      });

      return role;
    });

    return { success: true, data: updated };
  }

  async updateStatus(
    roleId: string,
    dto: UpdatePlatformRoleStatusDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.requireRole(roleId);

    if (current.isSystem && dto.status === 'INACTIVE') {
      throw new BadRequestException(
        'System roles (including SUPER_ADMIN) cannot be deactivated',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const role = await tx.platformRole.update({
        where: { id: roleId },
        data: { status: dto.status },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isSystem: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'PLATFORM_MEMBER',
          action: 'PLATFORM_ROLE_STATUS_CHANGED',
          entityType: 'PlatformRole',
          entityId: roleId,
          beforeData: { status: current.status },
          afterData: { status: role.status },
        },
      });

      return role;
    });

    return { success: true, data: updated };
  }

  async replaceRolePermissions(
    roleId: string,
    dto: ReplacePlatformRolePermissionsDto,
    actor: AuthenticatedUser,
  ) {
    const role = await this.requireRole(roleId);

    const uniqueCodes = [
      ...new Set(dto.permissions.map((item) => item.code.trim())),
    ];
    if (uniqueCodes.length !== dto.permissions.length) {
      throw new BadRequestException(
        'Duplicate permission codes are not allowed',
      );
    }

    const permissions = await this.resolvePermissions(uniqueCodes);
    const effectByCode = new Map(
      dto.permissions.map((item) => [item.code.trim(), item.effect]),
    );

    if (role.code === 'SUPER_ADMIN') {
      const allAllowed = SUPER_ADMIN_PERMISSION_CODES.every(
        (code) => effectByCode.get(code) === 'ALLOW',
      );
      if (!allAllowed) {
        throw new BadRequestException(
          'SUPER_ADMIN must retain every platform permission',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.platformRolePermission.deleteMany({
        where: { platformRoleId: roleId },
      });
      await tx.platformRolePermission.createMany({
        data: permissions.map((permission) => ({
          platformRoleId: roleId,
          permissionId: permission.id,
          effect: effectByCode.get(permission.code)!,
          assignedByUserId: actor.userId,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: 'PLATFORM_MEMBER',
          action: 'PLATFORM_ROLE_PERMISSIONS_REPLACED',
          entityType: 'PlatformRole',
          entityId: roleId,
          afterData: dto.permissions.map((item) => ({
            code: item.code,
            effect: item.effect,
          })),
        },
      });
    });

    return this.listRoles();
  }

  private async resolvePermissions(rawCodes: readonly string[]) {
    const codes = [...new Set(rawCodes.map((code) => code.trim()))];
    const invalid = codes.filter(
      (code) => !PLATFORM_PERMISSION_CODES.includes(code),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown platform permission codes: ${invalid.join(', ')}`,
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes }, status: 'ACTIVE' },
      select: { id: true, code: true },
    });
    if (permissions.length !== codes.length) {
      const found = new Set(permissions.map((permission) => permission.code));
      throw new BadRequestException(
        `Missing or inactive permission codes: ${codes.filter((code) => !found.has(code)).join(', ')}. Run the access-control seed first.`,
      );
    }
    return permissions;
  }

  private normalizeRoleCode(code: string) {
    const normalized = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_');
    if (!normalized) throw new BadRequestException('Role code is invalid');
    return normalized;
  }

  private async requireRole(roleId: string) {
    const role = await this.prisma.platformRole.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        status: true,
      },
    });
    if (!role) throw new NotFoundException('Platform role was not found');
    return role;
  }

  private throwKnownConflict(error: unknown, message: string): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
