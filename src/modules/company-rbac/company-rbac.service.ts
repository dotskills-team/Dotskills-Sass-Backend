import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/phase-1-prisma/client';
import {
  NotificationType,
  NotificationRelatedEntityType,
} from '../../generated/phase-1-prisma/enums';
import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { CompanyContext } from '../../common/types/company-context.type';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type {
  BootstrapCompanyRbacDto,
  CreateCompanyMemberDto,
  CreateCompanyRoleDto,
  ReplaceCompanyMemberLocationsDto,
  ReplaceCompanyMemberRolesDto,
  ReplaceCompanyMemberScopesDto,
  ReplaceCompanyRolePermissionsDto,
  UpdateCompanyMemberStatusDto,
  UpdateCompanyRoleDto,
} from './dto/company-rbac.dto';

const COMPANY_PERMISSION_CODES = Object.values(COMPANY_PERMISSIONS);

const DEFAULT_ROLES = [
  {
    code: 'COMPANY_OWNER',
    name: 'Company Owner',
    permissions: COMPANY_PERMISSION_CODES,
  },
  {
    code: 'COMPANY_ADMIN',
    name: 'Company Admin',
    permissions: COMPANY_PERMISSION_CODES,
  },
  {
    // Production-readiness role curation (design doc Section ৮'s
    // Owner/Branch-Manager/Cashier table) — Manager gets nearly every
    // Business Ops permission; SETTINGS_UPDATE and Location/Branch-scoped
    // restriction are the only two deliberate boundaries kept out of this
    // pass (see the plan's own flags), a Company Owner can add either
    // individually via the existing "Manage permissions" screen.
    code: 'MANAGER',
    name: 'Manager',
    permissions: [
      COMPANY_PERMISSIONS.RBAC_READ,
      COMPANY_PERMISSIONS.MEMBER_READ,
      COMPANY_PERMISSIONS.MEMBER_CREATE,
      COMPANY_PERMISSIONS.MEMBER_UPDATE,
      COMPANY_PERMISSIONS.MEMBER_ROLE_ASSIGN,
      COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN,
      COMPANY_PERMISSIONS.LOCATION_READ,
      COMPANY_PERMISSIONS.LOCATION_CREATE,
      COMPANY_PERMISSIONS.LOCATION_UPDATE,
      COMPANY_PERMISSIONS.CATEGORY_READ,
      COMPANY_PERMISSIONS.CATEGORY_CREATE,
      COMPANY_PERMISSIONS.CATEGORY_UPDATE,
      COMPANY_PERMISSIONS.UNIT_READ,
      COMPANY_PERMISSIONS.UNIT_CREATE,
      COMPANY_PERMISSIONS.UNIT_UPDATE,
      COMPANY_PERMISSIONS.PRODUCT_READ,
      COMPANY_PERMISSIONS.PRODUCT_CREATE,
      COMPANY_PERMISSIONS.PRODUCT_UPDATE,
      COMPANY_PERMISSIONS.PRODUCT_BULK_IMPORT,
      COMPANY_PERMISSIONS.CUSTOMER_READ,
      COMPANY_PERMISSIONS.CUSTOMER_CREATE,
      COMPANY_PERMISSIONS.CUSTOMER_UPDATE,
      COMPANY_PERMISSIONS.SUPPLIER_READ,
      COMPANY_PERMISSIONS.SUPPLIER_CREATE,
      COMPANY_PERMISSIONS.SUPPLIER_UPDATE,
      // SETTINGS_UPDATE deliberately excluded — company-wide toggles
      // (tax/multi-unit/etc.) are a structural decision, kept Owner-only.
      COMPANY_PERMISSIONS.SETTINGS_READ,
      COMPANY_PERMISSIONS.PURCHASE_ORDER_READ,
      COMPANY_PERMISSIONS.PURCHASE_ORDER_CREATE,
      COMPANY_PERMISSIONS.PURCHASE_ORDER_UPDATE,
      COMPANY_PERMISSIONS.PURCHASE_ORDER_CANCEL,
      COMPANY_PERMISSIONS.PURCHASE_ORDER_RECEIVE,
      COMPANY_PERMISSIONS.PURCHASE_RETURN_READ,
      COMPANY_PERMISSIONS.PURCHASE_RETURN_CREATE,
      COMPANY_PERMISSIONS.STOCK_TRANSFER_READ,
      COMPANY_PERMISSIONS.STOCK_TRANSFER_CREATE,
      COMPANY_PERMISSIONS.STOCK_TRANSFER_DISPATCH,
      COMPANY_PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      COMPANY_PERMISSIONS.SUPPLIER_PAYMENT_READ,
      COMPANY_PERMISSIONS.SUPPLIER_PAYMENT_CREATE,
      COMPANY_PERMISSIONS.SALE_READ,
      COMPANY_PERMISSIONS.SALE_CREATE,
      // Void/Return — Owner/Manager trust tier (design doc Section ৫.৫):
      // a Cashier who could both take cash and Void could pocket the cash
      // and erase the transaction, with stock reversal hiding it even
      // from a physical count.
      COMPANY_PERMISSIONS.SALE_VOID,
      COMPANY_PERMISSIONS.SALE_RETURN_READ,
      COMPANY_PERMISSIONS.SALE_RETURN_CREATE,
      COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_READ,
      COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_CREATE,
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_READ,
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_OPEN,
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_CLOSE,
      // Lets a Manager view/close a session a Cashier forgot to close —
      // see cash-drawer.service.ts's ownership-scoping logic.
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_MANAGE_ALL,
      COMPANY_PERMISSIONS.REPORT_READ,
      COMPANY_PERMISSIONS.PROFIT_REPORT_READ,
      COMPANY_PERMISSIONS.STOCK_ADJUSTMENT_READ,
      COMPANY_PERMISSIONS.STOCK_ADJUSTMENT_CREATE,
    ],
  },
  {
    // Renamed from STAFF (see the migration script) — a POS-focused,
    // deliberately narrow role. No RBAC_READ (a Cashier doesn't need to
    // see the company's role/member list), no Void/Return, no Purchase/
    // Stock-Transfer/Stock-Adjustment/Report access at all.
    code: 'CASHIER',
    name: 'Cashier',
    permissions: [
      COMPANY_PERMISSIONS.SALE_READ,
      COMPANY_PERMISSIONS.SALE_CREATE,
      // Cash Drawer READ/OPEN/CLOSE, but never MANAGE_ALL — scoped in the
      // service layer to only this cashier's own session.
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_READ,
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_OPEN,
      COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_CLOSE,
      COMPANY_PERMISSIONS.PRODUCT_READ,
      COMPANY_PERMISSIONS.CUSTOMER_READ,
      // Not in the original ask, but structurally required — POS and Cash
      // Drawer both need a Location selector to function at all.
      COMPANY_PERMISSIONS.LOCATION_READ,
    ],
  },
] as const;

const MEMBER_SELECT = {
  id: true,
  tenantId: true,
  companyId: true,
  employeeCode: true,
  designation: true,
  status: true,
  joinedAt: true,
  activatedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, fullName: true, status: true } },
  roles: {
    select: {
      expiresAt: true,
      companyRole: { select: { id: true, code: true, name: true } },
    },
  },
  scopes: {
    select: { id: true, scopeType: true, scopeKey: true, validUntil: true },
  },
  locations: {
    select: { locationId: true, location: { select: { name: true } } },
  },
} satisfies Prisma.CompanyMemberSelect;

@Injectable()
export class CompanyRbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async bootstrap(
    companyId: string,
    dto: BootstrapCompanyRbacDto,
    actor: AuthenticatedUser,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true, status: true },
    });
    if (!company) throw new NotFoundException('Company was not found');

    const permissions = await this.resolvePermissions(COMPANY_PERMISSION_CODES);
    const permissionByCode = new Map(
      permissions.map((item) => [item.code, item.id]),
    );
    const ownerUser = await this.resolveOptionalOwner(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      const roleIds = new Map<string, string>();
      for (const definition of DEFAULT_ROLES) {
        const role = await tx.companyRole.upsert({
          where: {
            tenantId_companyId_code: {
              tenantId: company.tenantId,
              companyId: company.id,
              code: definition.code,
            },
          },
          update: { name: definition.name, status: 'ACTIVE', isSystem: true },
          create: {
            tenantId: company.tenantId,
            companyId: company.id,
            code: definition.code,
            name: definition.name,
            isSystem: true,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        roleIds.set(definition.code, role.id);
        await tx.companyRolePermission.deleteMany({
          where: { companyRoleId: role.id },
        });
        await tx.companyRolePermission.createMany({
          data: definition.permissions.map((code) => ({
            companyRoleId: role.id,
            permissionId: permissionByCode.get(code)!,
            effect: 'ALLOW',
            assignedByUserId: actor.userId,
          })),
        });
      }

      let ownerMemberId: string | null = null;
      if (ownerUser) {
        const member = await tx.companyMember.upsert({
          where: {
            tenantId_companyId_userId: {
              tenantId: company.tenantId,
              companyId: company.id,
              userId: ownerUser.id,
            },
          },
          update: { status: 'ACTIVE', activatedAt: new Date() },
          create: {
            tenantId: company.tenantId,
            companyId: company.id,
            userId: ownerUser.id,
            status: 'ACTIVE',
            invitedAt: new Date(),
            joinedAt: new Date(),
            activatedAt: new Date(),
          },
          select: { id: true },
        });
        ownerMemberId = member.id;
        await tx.companyMemberRole.upsert({
          where: {
            companyMemberId_companyRoleId: {
              companyMemberId: member.id,
              companyRoleId: roleIds.get('COMPANY_OWNER')!,
            },
          },
          update: { expiresAt: null, assignedByUserId: actor.userId },
          create: {
            companyMemberId: member.id,
            companyRoleId: roleIds.get('COMPANY_OWNER')!,
            assignedByUserId: actor.userId,
          },
        });
        await tx.companyMemberScope.upsert({
          where: {
            companyMemberId_scopeType_scopeKey: {
              companyMemberId: member.id,
              scopeType: 'COMPANY',
              scopeKey: '*',
            },
          },
          update: { validUntil: null, assignedByUserId: actor.userId },
          create: {
            tenantId: company.tenantId,
            companyId: company.id,
            companyMemberId: member.id,
            scopeType: 'COMPANY',
            scopeKey: '*',
            assignedByUserId: actor.userId,
          },
        });
        const ownership = await tx.companyOwnership.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            companyMemberId: member.id,
            endedAt: null,
          },
          select: { id: true },
        });
        if (!ownership) {
          await tx.companyOwnership.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              companyMemberId: member.id,
              isPrimary: true,
              assignedByUserId: actor.userId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: company.tenantId,
          companyId: company.id,
          actorUserId: actor.userId,
          actorType: 'PLATFORM_MEMBER',
          action: 'COMPANY_RBAC_BOOTSTRAPPED',
          entityType: 'Company',
          entityId: company.id,
          afterData: {
            defaultRoles: DEFAULT_ROLES.map((role) => role.code),
            ownerMemberId,
          },
        },
      });
      return {
        companyId: company.id,
        roleCodes: [...roleIds.keys()],
        ownerMemberId,
      };
    });
    return { success: true, data: result };
  }

  async listPermissions() {
    const data = await this.prisma.permission.findMany({
      where: { code: { in: COMPANY_PERMISSION_CODES }, status: 'ACTIVE' },
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

  async listRoles(context: CompanyContext) {
    const data = await this.prisma.companyRole.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        _count: { select: { members: true, permissions: true } },
        permissions: {
          select: {
            effect: true,
            permission: { select: { code: true, name: true } },
          },
          orderBy: { permission: { code: 'asc' } },
        },
      },
      orderBy: { code: 'asc' },
    });
    return { success: true, count: data.length, data };
  }

  async createRole(
    context: CompanyContext,
    dto: CreateCompanyRoleDto,
    actor: AuthenticatedUser,
  ) {
    const code = this.normalizeRoleCode(dto.code);
    const permissions = await this.resolvePermissions(dto.permissionCodes);
    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const created = await tx.companyRole.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
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
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'COMPANY_ROLE_CREATED',
          'CompanyRole',
          created.id,
          null,
          created,
        );
        return created;
      });
      return { success: true, data: role };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'Role code already exists in this company',
      );
      throw error;
    }
  }

  async updateRole(
    context: CompanyContext,
    roleId: string,
    dto: UpdateCompanyRoleDto,
    actor: AuthenticatedUser,
  ) {
    const current = await this.requireRole(context, roleId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const role = await tx.companyRole.update({
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
        },
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_ROLE_UPDATED',
        'CompanyRole',
        roleId,
        current,
        role,
      );
      return role;
    });
    return { success: true, data: updated };
  }

  async replaceRolePermissions(
    context: CompanyContext,
    roleId: string,
    dto: ReplaceCompanyRolePermissionsDto,
    actor: AuthenticatedUser,
  ) {
    const role = await this.requireRole(context, roleId);
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
    if (role.code === 'COMPANY_OWNER') {
      const allAllowed = COMPANY_PERMISSION_CODES.every(
        (code) => effectByCode.get(code) === 'ALLOW',
      );
      if (!allAllowed) {
        throw new BadRequestException(
          'COMPANY_OWNER must retain every company permission',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.companyRolePermission.deleteMany({
        where: { companyRoleId: roleId },
      });
      await tx.companyRolePermission.createMany({
        data: permissions.map((permission) => ({
          companyRoleId: roleId,
          permissionId: permission.id,
          effect: effectByCode.get(permission.code)!,
          assignedByUserId: actor.userId,
        })),
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_ROLE_PERMISSIONS_REPLACED',
        'CompanyRole',
        roleId,
        null,
        dto.permissions,
      );
    });
    return this.listRoles(context);
  }

  async listMembers(context: CompanyContext) {
    const data = await this.prisma.companyMember.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: data.length, data };
  }

  async createMember(
    context: CompanyContext,
    dto: CreateCompanyMemberDto,
    actor: AuthenticatedUser,
  ) {
    const roles = await this.resolveCompanyRoles(context, dto.roleCodes);
    const email = dto.email.trim().toLowerCase();
    try {
      const member = await this.prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({
          where: { email },
          select: { id: true, deletedAt: true },
        });
        if (user?.deletedAt)
          throw new BadRequestException('User account is unavailable');
        if (!user) {
          if (!dto.password) {
            throw new BadRequestException(
              'Password is required for a new user',
            );
          }
          const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
            memoryCost: 65_536,
            timeCost: 3,
            parallelism: 1,
          });
          user = await tx.user.create({
            data: {
              email,
              fullName: dto.fullName.trim(),
              passwordHash,
              status: 'ACTIVE',
              emailVerifiedAt: new Date(),
              passwordChangedAt: new Date(),
            },
            select: { id: true, deletedAt: true },
          });
        }

        const created = await tx.companyMember.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            userId: user.id,
            employeeCode: dto.employeeCode?.trim() || null,
            designation: dto.designation?.trim() || null,
            status: 'ACTIVE',
            invitedAt: new Date(),
            joinedAt: new Date(),
            activatedAt: new Date(),
            roles: {
              create: roles.map((role) => ({
                companyRoleId: role.id,
                assignedByUserId: actor.userId,
              })),
            },
            scopes: {
              create: {
                tenantId: context.tenantId,
                companyId: context.companyId,
                scopeType: 'COMPANY',
                scopeKey: '*',
                assignedByUserId: actor.userId,
              },
            },
          },
          select: MEMBER_SELECT,
        });
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'COMPANY_MEMBER_CREATED',
          'CompanyMember',
          created.id,
          null,
          { email, roleCodes: roles.map((role) => role.code) },
        );
        await this.notificationService.create(tx, context, {
          type: NotificationType.STAFF_ACTIVITY,
          relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
          relatedEntityId: created.id,
          metadata: {
            memberName: created.user.fullName,
            action: 'MEMBER_CREATED',
          },
        });
        return created;
      });
      return { success: true, data: member };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'User is already a member or employee code already exists',
      );
      throw error;
    }
  }

  async replaceMemberRoles(
    context: CompanyContext,
    memberId: string,
    dto: ReplaceCompanyMemberRolesDto,
    actor: AuthenticatedUser,
  ) {
    const member = await this.requireMember(context, memberId);
    const roles = await this.resolveCompanyRoles(context, dto.roleCodes);
    const currentCodes = member.roles.map((item) => item.companyRole.code);
    const nextCodes = roles.map((role) => role.code);
    if (
      member.id === context.companyMemberId &&
      currentCodes.includes('COMPANY_OWNER') &&
      !nextCodes.includes('COMPANY_OWNER')
    ) {
      throw new BadRequestException(
        'You cannot remove your own COMPANY_OWNER role',
      );
    }
    if (
      currentCodes.includes('COMPANY_OWNER') &&
      !nextCodes.includes('COMPANY_OWNER')
    ) {
      await this.assertAnotherOwner(context, memberId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.companyMemberRole.deleteMany({
        where: { companyMemberId: memberId },
      });
      await tx.companyMemberRole.createMany({
        data: roles.map((role) => ({
          companyMemberId: memberId,
          companyRoleId: role.id,
          assignedByUserId: actor.userId,
        })),
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_MEMBER_ROLES_REPLACED',
        'CompanyMember',
        memberId,
        { roleCodes: currentCodes },
        { roleCodes: nextCodes },
      );
      const result = await tx.companyMember.findUniqueOrThrow({
        where: { id: memberId },
        select: MEMBER_SELECT,
      });
      await this.notificationService.create(tx, context, {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: memberId,
        metadata: {
          memberName: result.user.fullName,
          action: 'MEMBER_ROLES_UPDATED',
        },
      });
      return result;
    });
    return { success: true, data: updated };
  }

  async updateMemberStatus(
    context: CompanyContext,
    memberId: string,
    dto: UpdateCompanyMemberStatusDto,
    actor: AuthenticatedUser,
  ) {
    const member = await this.requireMember(context, memberId);
    if (member.id === context.companyMemberId && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot suspend or revoke yourself');
    }
    if (
      member.roles.some((item) => item.companyRole.code === 'COMPANY_OWNER') &&
      dto.status !== 'ACTIVE'
    ) {
      await this.assertAnotherOwner(context, memberId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.companyMember.update({
        where: { id: memberId },
        data: {
          status: dto.status,
          ...(dto.status === 'ACTIVE' ? { activatedAt: new Date() } : {}),
        },
        select: MEMBER_SELECT,
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_MEMBER_STATUS_CHANGED',
        'CompanyMember',
        memberId,
        { status: member.status },
        { status: dto.status },
      );
      return result;
    });
    return { success: true, data: updated };
  }

  async replaceMemberScopes(
    context: CompanyContext,
    memberId: string,
    dto: ReplaceCompanyMemberScopesDto,
    actor: AuthenticatedUser,
  ) {
    await this.requireMember(context, memberId);
    const keys = new Set<string>();
    for (const scope of dto.scopes) {
      if (scope.type === 'COMPANY' && scope.key !== '*') {
        throw new BadRequestException('COMPANY scope key must be "*"');
      }
      const composite = `${scope.type}:${scope.key}`;
      if (keys.has(composite))
        throw new BadRequestException('Duplicate scopes are not allowed');
      keys.add(composite);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.companyMemberScope.deleteMany({
        where: { companyMemberId: memberId },
      });
      await tx.companyMemberScope.createMany({
        data: dto.scopes.map((scope) => ({
          tenantId: context.tenantId,
          companyId: context.companyId,
          companyMemberId: memberId,
          scopeType: scope.type,
          scopeKey: scope.key,
          assignedByUserId: actor.userId,
        })),
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_MEMBER_SCOPES_REPLACED',
        'CompanyMember',
        memberId,
        null,
        dto.scopes,
      );
      return tx.companyMember.findUniqueOrThrow({
        where: { id: memberId },
        select: MEMBER_SELECT,
      });
    });
    return { success: true, data: updated };
  }

  /**
   * Full replace, same shape as replaceMemberScopes() — an empty
   * `locationIds` array is valid (revokes all Location access, matching
   * LBAC's own fail-safe default). Every id is existence-checked against
   * this company before writing — never trust a client-supplied id
   * without a scoped check, same discipline as every other module.
   */
  async replaceMemberLocations(
    context: CompanyContext,
    memberId: string,
    dto: ReplaceCompanyMemberLocationsDto,
    actor: AuthenticatedUser,
  ) {
    await this.requireMember(context, memberId);

    const uniqueIds = [...new Set(dto.locationIds)];
    if (uniqueIds.length > 0) {
      const found = await this.prisma.location.findMany({
        where: {
          id: { in: uniqueIds },
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        const foundIds = new Set(found.map((location) => location.id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Invalid locationIds for this company: ${missing.join(', ')}`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.companyMemberLocation.deleteMany({
        where: { companyMemberId: memberId },
      });
      if (uniqueIds.length > 0) {
        await tx.companyMemberLocation.createMany({
          data: uniqueIds.map((locationId) => ({
            tenantId: context.tenantId,
            companyId: context.companyId,
            companyMemberId: memberId,
            locationId,
            assignedByUserId: actor.userId,
          })),
        });
      }
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'COMPANY_MEMBER_LOCATIONS_REPLACED',
        'CompanyMember',
        memberId,
        null,
        { locationIds: uniqueIds },
      );
      const result = await tx.companyMember.findUniqueOrThrow({
        where: { id: memberId },
        select: MEMBER_SELECT,
      });
      await this.notificationService.create(tx, context, {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: memberId,
        metadata: {
          memberName: result.user.fullName,
          action: 'MEMBER_LOCATIONS_UPDATED',
        },
      });
      return result;
    });
    return { success: true, data: updated };
  }

  private async resolveOptionalOwner(dto: BootstrapCompanyRbacDto) {
    if (!dto.ownerUserId && !dto.ownerEmail) return null;
    const user = await this.prisma.user.findFirst({
      where: {
        ...(dto.ownerUserId ? { id: dto.ownerUserId } : {}),
        ...(dto.ownerEmail
          ? { email: dto.ownerEmail.trim().toLowerCase() }
          : {}),
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException('Owner user was not found or is inactive');
    return user;
  }

  private async resolvePermissions(rawCodes: readonly string[]) {
    const codes = [...new Set(rawCodes.map((code) => code.trim()))];
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

  private async resolveCompanyRoles(
    context: CompanyContext,
    rawCodes: string[],
  ) {
    const codes = [
      ...new Set(rawCodes.map((code) => this.normalizeRoleCode(code))),
    ];
    const roles = await this.prisma.companyRole.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        code: { in: codes },
        status: 'ACTIVE',
      },
      select: { id: true, code: true },
    });
    if (roles.length !== codes.length) {
      const found = new Set(roles.map((role) => role.code));
      throw new BadRequestException(
        `Invalid company role codes: ${codes.filter((code) => !found.has(code)).join(', ')}`,
      );
    }
    return roles;
  }

  private normalizeRoleCode(code: string) {
    const normalized = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_');
    if (!normalized) throw new BadRequestException('Role code is invalid');
    return normalized;
  }

  private async requireRole(context: CompanyContext, roleId: string) {
    const role = await this.prisma.companyRole.findFirst({
      where: {
        id: roleId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
      },
    });
    if (!role) throw new NotFoundException('Company role was not found');
    return role;
  }

  private async requireMember(context: CompanyContext, memberId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: {
        id: memberId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        roles: { select: { companyRole: { select: { code: true } } } },
      },
    });
    if (!member) throw new NotFoundException('Company member was not found');
    return member;
  }

  private async assertAnotherOwner(
    context: CompanyContext,
    excludedMemberId: string,
  ) {
    const count = await this.prisma.companyMember.count({
      where: {
        id: { not: excludedMemberId },
        tenantId: context.tenantId,
        companyId: context.companyId,
        status: 'ACTIVE',
        roles: {
          some: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            companyRole: { code: 'COMPANY_OWNER', status: 'ACTIVE' },
          },
        },
      },
    });
    if (count < 1)
      throw new BadRequestException(
        'The last active COMPANY_OWNER is protected',
      );
  }

  private createAudit(
    tx: Prisma.TransactionClient,
    context: CompanyContext,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        actorUserId,
        actorType: 'COMPANY_MEMBER',
        action,
        entityType,
        entityId,
        ...(beforeData === null ? {} : { beforeData: beforeData }),
        ...(afterData === null ? {} : { afterData: afterData }),
      },
    });
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
