import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { Prisma } from "../../generated/phase-1-prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreatePlatformStaffDto,
  PlatformStaffListQueryDto,
  ReplacePlatformRolesDto,
  UpdatePlatformStaffDto,
  UpdatePlatformStaffStatusDto,
} from "./dto/platform-staff.dto";

const PLATFORM_MEMBER_SELECT = {
  id: true,
  employeeCode: true,
  status: true,
  invitedAt: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      lastLoginAt: true,
    },
  },
  roles: {
    select: {
      assignedAt: true,
      platformRole: {
        select: { id: true, code: true, name: true, status: true },
      },
    },
  },
} satisfies Prisma.PlatformMemberSelect;

@Injectable()
export class PlatformStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PlatformStaffListQueryDto) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const search = query.search?.trim();
    const where: Prisma.PlatformMemberWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.platformMember.findMany({
        where,
        select: PLATFORM_MEMBER_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.platformMember.count({ where }),
    ]);
    return { success: true, data, meta: { page, limit, total } };
  }

  async getById(id: string) {
    const member = await this.prisma.platformMember.findUnique({
      where: { id },
      select: PLATFORM_MEMBER_SELECT,
    });
    if (!member) throw new NotFoundException("Platform staff was not found");
    return { success: true, data: member };
  }

  async create(dto: CreatePlatformStaffDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const roles = await this.resolveRoles(dto.roleCodes, actor);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    try {
      const member = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            fullName: dto.fullName.trim(),
            passwordHash,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
            passwordChangedAt: new Date(),
            platformMember: {
              create: {
                employeeCode: dto.employeeCode?.trim() || null,
                status: "ACTIVE",
                invitedAt: new Date(),
                activatedAt: new Date(),
                roles: {
                  create: roles.map((role) => ({
                    platformRoleId: role.id,
                    assignedByUserId: actor.userId,
                  })),
                },
              },
            },
          },
          select: { platformMember: { select: { id: true } } },
        });
        const memberId = user.platformMember!.id;
        await tx.auditLog.create({
          data: {
            actorUserId: actor.userId,
            actorType: "PLATFORM_MEMBER",
            action: "PLATFORM_STAFF_CREATED",
            entityType: "PlatformMember",
            entityId: memberId,
            afterData: { email, roleCodes: roles.map((role) => role.code) },
          },
        });
        return tx.platformMember.findUniqueOrThrow({
          where: { id: memberId },
          select: PLATFORM_MEMBER_SELECT,
        });
      });
      return { success: true, data: member };
    } catch (error) {
      this.throwKnownConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlatformStaffDto, actor: AuthenticatedUser) {
    await this.requireMember(id);
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const member = await tx.platformMember.update({
          where: { id },
          data: {
            ...(dto.employeeCode !== undefined
              ? { employeeCode: dto.employeeCode.trim() || null }
              : {}),
            user: {
              update: {
                ...(dto.fullName !== undefined
                  ? { fullName: dto.fullName.trim() }
                  : {}),
              },
            },
          },
          select: PLATFORM_MEMBER_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.userId,
            actorType: "PLATFORM_MEMBER",
            action: "PLATFORM_STAFF_UPDATED",
            entityType: "PlatformMember",
            entityId: id,
            afterData: dto as Prisma.InputJsonValue,
          },
        });
        return member;
      });
      return { success: true, data: updated };
    } catch (error) {
      this.throwKnownConflict(error);
      throw error;
    }
  }

  async replaceRoles(
    id: string,
    dto: ReplacePlatformRolesDto,
    actor: AuthenticatedUser,
  ) {
    const target = await this.requireMember(id);
    const roles = await this.resolveRoles(dto.roleCodes, actor);
    const currentCodes = target.roles.map((item) => item.platformRole.code);
    const nextCodes = roles.map((role) => role.code);
    if (
      target.userId === actor.userId &&
      currentCodes.includes("SUPER_ADMIN") &&
      !nextCodes.includes("SUPER_ADMIN")
    ) {
      throw new BadRequestException("You cannot remove your own SUPER_ADMIN role");
    }
    if (currentCodes.includes("SUPER_ADMIN") && !nextCodes.includes("SUPER_ADMIN")) {
      await this.assertAnotherActiveSuperAdmin(id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.platformMemberRole.deleteMany({ where: { platformMemberId: id } });
      await tx.platformMemberRole.createMany({
        data: roles.map((role) => ({
          platformMemberId: id,
          platformRoleId: role.id,
          assignedByUserId: actor.userId,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: "PLATFORM_MEMBER",
          action: "PLATFORM_STAFF_ROLES_REPLACED",
          entityType: "PlatformMember",
          entityId: id,
          beforeData: { roleCodes: currentCodes },
          afterData: { roleCodes: nextCodes },
        },
      });
      return tx.platformMember.findUniqueOrThrow({
        where: { id },
        select: PLATFORM_MEMBER_SELECT,
      });
    });
    return { success: true, data: updated };
  }

  async updateStatus(
    id: string,
    dto: UpdatePlatformStaffStatusDto,
    actor: AuthenticatedUser,
  ) {
    const target = await this.requireMember(id);
    if (target.userId === actor.userId && dto.status !== "ACTIVE") {
      throw new BadRequestException("You cannot suspend or revoke yourself");
    }
    if (
      target.roles.some((item) => item.platformRole.code === "SUPER_ADMIN") &&
      dto.status !== "ACTIVE"
    ) {
      await this.assertAnotherActiveSuperAdmin(id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const member = await tx.platformMember.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === "ACTIVE" ? { activatedAt: new Date() } : {}),
        },
        select: PLATFORM_MEMBER_SELECT,
      });
      if (dto.status !== "ACTIVE") {
        await tx.authSession.updateMany({
          where: { userId: target.userId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: `PLATFORM_${dto.status}` },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: "PLATFORM_MEMBER",
          action: "PLATFORM_STAFF_STATUS_CHANGED",
          entityType: "PlatformMember",
          entityId: id,
          beforeData: { status: target.status },
          afterData: { status: dto.status },
        },
      });
      return member;
    });
    return { success: true, data: updated };
  }

  private async requireMember(id: string) {
    const member = await this.prisma.platformMember.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        roles: { select: { platformRole: { select: { code: true } } } },
      },
    });
    if (!member) throw new NotFoundException("Platform staff was not found");
    return member;
  }

  private async resolveRoles(rawCodes: string[], actor: AuthenticatedUser) {
    const codes = [...new Set(rawCodes.map((code) => code.trim().toUpperCase()))];
    if (!codes.length) throw new BadRequestException("At least one role is required");
    if (codes.includes("SUPER_ADMIN") && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Only a SUPER_ADMIN can assign SUPER_ADMIN");
    }
    const roles = await this.prisma.platformRole.findMany({
      where: { code: { in: codes }, status: "ACTIVE" },
      select: { id: true, code: true },
    });
    if (roles.length !== codes.length) {
      const found = new Set(roles.map((role) => role.code));
      throw new BadRequestException(
        `Invalid or inactive role codes: ${codes.filter((code) => !found.has(code)).join(", ")}`,
      );
    }
    return roles;
  }

  private async assertAnotherActiveSuperAdmin(excludedMemberId: string) {
    const count = await this.prisma.platformMember.count({
      where: {
        id: { not: excludedMemberId },
        status: "ACTIVE",
        roles: {
          some: { platformRole: { code: "SUPER_ADMIN", status: "ACTIVE" } },
        },
      },
    });
    if (count < 1) throw new BadRequestException("The last active SUPER_ADMIN is protected");
  }

  private throwKnownConflict(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("Email or employee code already exists");
    }
  }
}
