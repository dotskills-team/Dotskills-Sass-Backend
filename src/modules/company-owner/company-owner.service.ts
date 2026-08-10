import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateCompanyOwnerDto } from './dto/create-company-owner.dto';
import { UpdateCompanyOwnerDto } from './dto/update-company-owner.dto';
import { UpdateCompanyOwnerStatusDto } from './dto/update-company-owner-status.dto';

import {
  CompanyMembershipStatus,
  CompanyStatus,
} from 'src/generated/phase-1-prisma/enums';

@Injectable()
export class CompanyOwnerService {
  private readonly OWNER_ROLE_CODE = 'COMPANY_OWNER';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ============================================================
   * CREATE / ASSIGN COMPANY OWNER
   * ============================================================
   */
  async create(
    dto: CreateCompanyOwnerDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /**
       * ========================================================
       * 1. VERIFY COMPANY
       * ========================================================
       */
      const company = await tx.company.findUnique({
        where: {
          id: dto.companyId,
        },
        select: {
          id: true,
          tenantId: true,
          status: true,
          legalName: true,
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.status === CompanyStatus.CLOSED) {
        throw new BadRequestException(
          'Cannot assign owner to a closed company',
        );
      }

      /**
       * ========================================================
       * 2. VERIFY TENANT
       * ========================================================
       */
      const tenant = await tx.tenant.findUnique({
        where: {
          id: company.tenantId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException(
          'Company tenant not found',
        );
      }

      /**
       * ========================================================
       * 3. NORMALIZE EMAIL
       * ========================================================
       */
      const normalizedEmail = dto.email
        .trim()
        .toLowerCase();

      /**
       * ========================================================
       * 4. FIND EXISTING USER
       * ========================================================
       */
      let user = await tx.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      let userCreated = false;

      /**
       * ========================================================
       * 5. CREATE USER IF NOT EXISTS
       * ========================================================
       */
      if (!user) {
        const passwordHash = await bcrypt.hash(
          dto.password,
          12,
        );

        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            phone: dto.phone,
            fullName: dto.fullName.trim(),
            passwordHash,
            status: 'ACTIVE',
          },
        });

        userCreated = true;
      } else {
        /**
         * Existing account validation
         */
        if (user.status === 'LOCKED') {
          throw new BadRequestException(
            'Existing user account is locked',
          );
        }

        if (user.status === 'SUSPENDED') {
          throw new BadRequestException(
            'Existing user account is suspended',
          );
        }

        if (user.status === 'INACTIVE') {
          throw new BadRequestException(
            'Existing user account is inactive',
          );
        }
      }

      /**
       * ========================================================
       * 6. CREATE / REUSE COMPANY MEMBER
       * ========================================================
       */
      let companyMember =
        await tx.companyMember.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            userId: user.id,
          },
        });

      if (!companyMember) {
        companyMember =
          await tx.companyMember.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              userId: user.id,
              designation:
                dto.designation ?? 'Company Owner',
              status:
                CompanyMembershipStatus.ACTIVE,
              joinedAt: new Date(),
              activatedAt: new Date(),
            },
          });
      } else {
        /**
         * Existing membership validation
         */
        if (
          companyMember.status ===
          CompanyMembershipStatus.REVOKED
        ) {
          throw new ConflictException(
            'User membership for this company has been revoked',
          );
        }

        if (
          companyMember.status ===
          CompanyMembershipStatus.SUSPENDED
        ) {
          throw new BadRequestException(
            'Company membership is suspended',
          );
        }

        /**
         * Reactivate / update membership
         */
        companyMember =
          await tx.companyMember.update({
            where: {
              id: companyMember.id,
            },
            data: {
              status:
                CompanyMembershipStatus.ACTIVE,

              activatedAt:
                companyMember.activatedAt ??
                new Date(),

              designation:
                dto.designation ??
                companyMember.designation,
            },
          });
      }

      /**
       * ========================================================
       * 7. FIND / CREATE COMPANY OWNER ROLE
       * ========================================================
       */
      let ownerRole =
        await tx.companyRole.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            code: this.OWNER_ROLE_CODE,
          },
        });

      if (!ownerRole) {
        ownerRole =
          await tx.companyRole.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              code: this.OWNER_ROLE_CODE,
              name: 'Company Owner',
              description:
                'Full administrative access to the company',
              isSystem: true,
              status: 'ACTIVE',
            },
          });
      }

      /**
       * ========================================================
       * 8. FIND CURRENT PRIMARY OWNER
       * ========================================================
       */
      const oldPrimaryOwnership =
        await tx.companyOwnership.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            isPrimary: true,
            endedAt: null,
          },
        });

      /**
       * ========================================================
       * 9. ASSIGN OWNER ROLE
       * ========================================================
       */
      await tx.companyMemberRole.upsert({
        where: {
          companyMemberId_companyRoleId: {
            companyMemberId: companyMember.id,
            companyRoleId: ownerRole.id,
          },
        },

        create: {
          companyMemberId: companyMember.id,
          companyRoleId: ownerRole.id,
          assignedByUserId: actorUserId,
        },

        update: {
          assignedByUserId: actorUserId,
          assignedAt: new Date(),
          expiresAt: null,
        },
      });

      /**
       * ========================================================
       * 10. END OLD PRIMARY OWNER
       * ========================================================
       */
      if (
        oldPrimaryOwnership &&
        oldPrimaryOwnership.companyMemberId !==
          companyMember.id
      ) {
        await tx.companyOwnership.update({
          where: {
            id: oldPrimaryOwnership.id,
          },

          data: {
            endedAt: new Date(),
            isPrimary: false,
          },
        });

        /**
         * Remove owner role from previous owner.
         */
        await tx.companyMemberRole.deleteMany({
          where: {
            companyMemberId:
              oldPrimaryOwnership.companyMemberId,

            companyRoleId: ownerRole.id,
          },
        });
      }

      /**
       * ========================================================
       * 11. FIND EXISTING OWNERSHIP
       * ========================================================
       */
      const existingOwnership =
        await tx.companyOwnership.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            companyMemberId: companyMember.id,
            endedAt: null,
          },
        });

      let ownership;

      if (existingOwnership) {
        ownership =
          await tx.companyOwnership.update({
            where: {
              id: existingOwnership.id,
            },

            data: {
              isPrimary: true,
              assignedByUserId: actorUserId,
            },
          });
      } else {
        ownership =
          await tx.companyOwnership.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              companyMemberId: companyMember.id,
              isPrimary: true,
              startedAt: new Date(),
              assignedByUserId: actorUserId,
            },
          });
      }

      /**
       * ========================================================
       * 12. AUDIT DATA
       * ========================================================
       *
       * IMPORTANT:
       * Do NOT create Prisma.InputJsonObject and mutate it.
       *
       * Direct object construction is used here.
       */
      const beforeData = oldPrimaryOwnership
        ? {
            oldOwnerMemberId:
              oldPrimaryOwnership.companyMemberId,

            oldOwnershipId:
              oldPrimaryOwnership.id,
          }
        : {};

      const afterData = {
        companyId: company.id,
        companyMemberId: companyMember.id,
        userId: user.id,
        ownerRoleId: ownerRole.id,
        isPrimary: true,
        userCreated,
      };

      /**
       * ========================================================
       * 13. AUDIT LOG
       * ========================================================
       */
      await tx.auditLog.create({
        data: {
          tenantId: company.tenantId,

          companyId: company.id,

          actorUserId,

          actorType: 'PLATFORM_MEMBER',

          action: userCreated
            ? 'COMPANY_OWNER_CREATED'
            : 'COMPANY_OWNER_ASSIGNED',

          entityType: 'CompanyOwnership',

          entityId: ownership.id,

          beforeData,

          afterData,
        },
      });

      /**
       * ========================================================
       * 14. RESPONSE
       * ========================================================
       */
      return {
        success: true,

        message: userCreated
          ? 'Company owner created successfully'
          : 'Existing user assigned as company owner',

        data: {
          company: {
            id: company.id,
            legalName: company.legalName,
          },

          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
          },

          companyMember: {
            id: companyMember.id,
            status: companyMember.status,
            designation:
              companyMember.designation,
          },

          ownership: {
            id: ownership.id,
            isPrimary: ownership.isPrimary,
            startedAt: ownership.startedAt,
          },

          role: {
            id: ownerRole.id,
            code: ownerRole.code,
            name: ownerRole.name,
          },

          /**
           * SECURITY NOTE:
           * Password is returned only for newly created users.
           */
          credentials: userCreated
            ? {
                email: normalizedEmail,
                password: dto.password,
              }
            : null,
        },
      };
    });
  }

  /**
   * ============================================================
   * GET ALL COMPANY OWNERS
   * ============================================================
   */
  async findAll(companyId: string) {
    /**
     * Verify company
     */
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    /**
     * Get active owners
     */
    const owners =
      await this.prisma.companyOwnership.findMany({
        where: {
          companyId: company.id,
          tenantId: company.tenantId,
          endedAt: null,
        },

        orderBy: [
          {
            isPrimary: 'desc',
          },
          {
            startedAt: 'asc',
          },
        ],

        include: {
          companyMember: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  fullName: true,
                  status: true,
                  lastLoginAt: true,
                },
              },

              roles: {
                include: {
                  companyRole: true,
                },
              },
            },
          },
        },
      });

    return {
      success: true,
      items: owners,
      total: owners.length,
    };
  }

  /**
   * ============================================================
   * GET SINGLE COMPANY OWNER
   * ============================================================
   */
  async findOne(
    companyId: string,
    ownerMemberId: string,
  ) {
    const ownership =
      await this.prisma.companyOwnership.findFirst({
        where: {
          companyId,
          companyMemberId: ownerMemberId,
          endedAt: null,
        },

        include: {
          company: {
            select: {
              id: true,
              tenantId: true,
              legalName: true,
              status: true,
            },
          },

          companyMember: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  fullName: true,
                  status: true,
                  lastLoginAt: true,
                },
              },

              roles: {
                include: {
                  companyRole: true,
                },
              },
            },
          },
        },
      });

    if (!ownership) {
      throw new NotFoundException(
        'Company owner not found',
      );
    }

    return {
      success: true,
      data: ownership,
    };
  }

  /**
   * ============================================================
   * UPDATE COMPANY OWNER
   * ============================================================
   */
  async update(
    companyId: string,
    ownerMemberId: string,
    dto: UpdateCompanyOwnerDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /**
       * ========================================================
       * 1. FIND ACTIVE OWNERSHIP
       * ========================================================
       */
      const ownership =
        await tx.companyOwnership.findFirst({
          where: {
            companyId,
            companyMemberId: ownerMemberId,
            endedAt: null,
          },

          select: {
            id: true,
            tenantId: true,

            companyMember: {
              select: {
                id: true,
                userId: true,
                designation: true,
              },
            },
          },
        });

      if (!ownership) {
        throw new NotFoundException(
          'Company owner not found',
        );
      }

      /**
       * ========================================================
       * 2. GET EXISTING USER
       * ========================================================
       */
      const existingUser =
        await tx.user.findUnique({
          where: {
            id: ownership.companyMember.userId,
          },

          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        });

      if (!existingUser) {
        throw new NotFoundException(
          'Owner user account not found',
        );
      }

      /**
       * ========================================================
       * 3. NORMALIZE EMAIL
       * ========================================================
       */
      const normalizedEmail =
        dto.email !== undefined
          ? dto.email.trim().toLowerCase()
          : undefined;

      /**
       * ========================================================
       * 4. EMAIL DUPLICATE CHECK
       * ========================================================
       */
      if (
        normalizedEmail !== undefined &&
        normalizedEmail !== existingUser.email
      ) {
        const emailExists =
          await tx.user.findUnique({
            where: {
              email: normalizedEmail,
            },

            select: {
              id: true,
            },
          });

        if (
          emailExists &&
          emailExists.id !== existingUser.id
        ) {
          throw new ConflictException(
            'Email address is already in use',
          );
        }
      }

      /**
       * ========================================================
       * 5. UPDATE USER
       * ========================================================
       */
      const user = await tx.user.update({
        where: {
          id: existingUser.id,
        },

        data: {
          ...(normalizedEmail !== undefined && {
            email: normalizedEmail,
          }),

          ...(dto.fullName !== undefined && {
            fullName: dto.fullName.trim(),
          }),

          ...(dto.phone !== undefined && {
            phone: dto.phone,
          }),
        },

        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
        },
      });

      /**
       * ========================================================
       * 6. UPDATE COMPANY MEMBER
       * ========================================================
       */
      const member =
        await tx.companyMember.update({
          where: {
            id: ownerMemberId,
          },

          data: {
            ...(dto.designation !== undefined && {
              designation: dto.designation.trim(),
            }),
          },

          select: {
            id: true,
            designation: true,
            status: true,
          },
        });

      /**
       * ========================================================
       * 7. AUDIT DATA
       * ========================================================
       *
       * IMPORTANT:
       * Direct object creation.
       * No Prisma.InputJsonObject mutation.
       */
      const beforeData = {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          phone: existingUser.phone,
        },

        companyMember: {
          id: ownership.companyMember.id,
          designation:
            ownership.companyMember.designation,
        },
      };

      const afterData = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
        },

        companyMember: {
          id: member.id,
          designation: member.designation,
        },
      };

      /**
       * ========================================================
       * 8. AUDIT LOG
       * ========================================================
       */
      await tx.auditLog.create({
        data: {
          tenantId: ownership.tenantId,

          companyId,

          actorUserId,

          actorType: 'PLATFORM_MEMBER',

          action: 'COMPANY_OWNER_UPDATED',

          entityType: 'CompanyOwnership',

          entityId: ownership.id,

          beforeData,

          afterData,
        },
      });

      /**
       * ========================================================
       * 9. RESPONSE
       * ========================================================
       */
      return {
        success: true,

        message:
          'Company owner updated successfully',

        data: {
          user,

          companyMember: member,

          ownershipId: ownership.id,
        },
      };
    });
  }

  /**
   * ============================================================
   * CHANGE PRIMARY COMPANY OWNER
   * ============================================================
   */
  async changeOwner(
    companyId: string,
    newOwnerMemberId: string,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /**
       * ========================================================
       * 1. VERIFY COMPANY
       * ========================================================
       */
      const company = await tx.company.findUnique({
        where: {
          id: companyId,
        },

        select: {
          id: true,
          tenantId: true,
          status: true,
        },
      });

      if (!company) {
        throw new NotFoundException(
          'Company not found',
        );
      }

      if (company.status === CompanyStatus.CLOSED) {
        throw new BadRequestException(
          'Cannot change owner of a closed company',
        );
      }

      /**
       * ========================================================
       * 2. VERIFY NEW MEMBER
       * ========================================================
       */
      const newMember =
        await tx.companyMember.findFirst({
          where: {
            id: newOwnerMemberId,
            companyId: company.id,
            tenantId: company.tenantId,
          },

          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

      if (!newMember) {
        throw new NotFoundException(
          'Company member not found',
        );
      }

      if (
        newMember.status !==
        CompanyMembershipStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Only active company members can become owner',
        );
      }

      /**
       * ========================================================
       * 3. FIND OWNER ROLE
       * ========================================================
       */
      const ownerRole =
        await tx.companyRole.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            code: this.OWNER_ROLE_CODE,
          },
        });

      if (!ownerRole) {
        throw new NotFoundException(
          'COMPANY_OWNER role not found. Bootstrap company RBAC first.',
        );
      }

      /**
       * ========================================================
       * 4. FIND CURRENT PRIMARY OWNER
       * ========================================================
       */
      const oldOwnership =
        await tx.companyOwnership.findFirst({
          where: {
            companyId: company.id,
            tenantId: company.tenantId,
            isPrimary: true,
            endedAt: null,
          },
        });

      /**
       * ========================================================
       * 5. ALREADY PRIMARY OWNER
       * ========================================================
       */
      if (
        oldOwnership &&
        oldOwnership.companyMemberId ===
          newOwnerMemberId
      ) {
        throw new BadRequestException(
          'This member is already the primary company owner',
        );
      }

      /**
       * ========================================================
       * 6. END OLD OWNERSHIP
       * ========================================================
       */
      if (oldOwnership) {
        await tx.companyOwnership.update({
          where: {
            id: oldOwnership.id,
          },

          data: {
            endedAt: new Date(),
            isPrimary: false,
          },
        });

        /**
         * Remove owner role from old owner.
         */
        await tx.companyMemberRole.deleteMany({
          where: {
            companyMemberId:
              oldOwnership.companyMemberId,

            companyRoleId: ownerRole.id,
          },
        });
      }

      /**
       * ========================================================
       * 7. ASSIGN OWNER ROLE TO NEW MEMBER
       * ========================================================
       */
      await tx.companyMemberRole.upsert({
        where: {
          companyMemberId_companyRoleId: {
            companyMemberId: newOwnerMemberId,
            companyRoleId: ownerRole.id,
          },
        },

        create: {
          companyMemberId: newOwnerMemberId,
          companyRoleId: ownerRole.id,
          assignedByUserId: actorUserId,
        },

        update: {
          assignedAt: new Date(),
          assignedByUserId: actorUserId,
          expiresAt: null,
        },
      });

      /**
       * ========================================================
       * 8. CHECK EXISTING ACTIVE OWNERSHIP
       * ========================================================
       */
      const existingNewOwnership =
        await tx.companyOwnership.findFirst({
          where: {
            tenantId: company.tenantId,
            companyId: company.id,
            companyMemberId: newOwnerMemberId,
            endedAt: null,
          },
        });

      let ownership;

      if (existingNewOwnership) {
        ownership =
          await tx.companyOwnership.update({
            where: {
              id: existingNewOwnership.id,
            },

            data: {
              isPrimary: true,
              assignedByUserId: actorUserId,
            },
          });
      } else {
        ownership =
          await tx.companyOwnership.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              companyMemberId: newOwnerMemberId,
              isPrimary: true,
              startedAt: new Date(),
              assignedByUserId: actorUserId,
            },
          });
      }

      /**
       * ========================================================
       * 9. AUDIT BEFORE DATA
       * ========================================================
       *
       * IMPORTANT FIX:
       *
       * Do NOT do:
       *
       * const beforeData: Prisma.InputJsonObject = {};
       * beforeData.foo = ...
       *
       * Because InputJsonObject is readonly.
       *
       * Instead, construct the object directly.
       */
      const beforeData = oldOwnership
        ? {
            oldOwnerMemberId:
              oldOwnership.companyMemberId,

            oldOwnershipId:
              oldOwnership.id,
          }
        : {};

      /**
       * ========================================================
       * 10. AUDIT AFTER DATA
       * ========================================================
       */
      const afterData = {
        newOwnerMemberId,

        userId: newMember.userId,

        ownershipId: ownership.id,

        isPrimary: true,
      };

      /**
       * ========================================================
       * 11. AUDIT LOG
       * ========================================================
       */
      await tx.auditLog.create({
        data: {
          tenantId: company.tenantId,

          companyId: company.id,

          actorUserId,

          actorType: 'PLATFORM_MEMBER',

          action: 'COMPANY_OWNER_CHANGED',

          entityType: 'CompanyOwnership',

          entityId: ownership.id,

          beforeData,

          afterData,
        },
      });

      /**
       * ========================================================
       * 12. RESPONSE
       * ========================================================
       */
      return {
        success: true,

        message:
          'Company owner changed successfully',

        data: {
          ownershipId: ownership.id,

          companyId: company.id,

          companyMemberId: newOwnerMemberId,

          user: newMember.user,

          isPrimary: true,
        },
      };
    });
  }

  /**
   * ============================================================
   * UPDATE OWNER STATUS
   * ============================================================
   */
  async updateStatus(
    companyId: string,
    ownerMemberId: string,
    dto: UpdateCompanyOwnerStatusDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /**
       * ========================================================
       * 1. FIND ACTIVE OWNER
       * ========================================================
       */
      const ownership =
        await tx.companyOwnership.findFirst({
          where: {
            companyId,
            companyMemberId: ownerMemberId,
            endedAt: null,
          },

          select: {
            id: true,
            tenantId: true,
            companyMemberId: true,
            isPrimary: true,
          },
        });

      if (!ownership) {
        throw new NotFoundException(
          'Company owner not found',
        );
      }

      /**
       * ========================================================
       * 2. PRIMARY OWNER PROTECTION
       * ========================================================
       */
      if (
        ownership.isPrimary &&
        (dto.status ===
          CompanyMembershipStatus.SUSPENDED ||
          dto.status ===
            CompanyMembershipStatus.REVOKED)
      ) {
        throw new BadRequestException(
          'Transfer primary ownership before suspending or revoking the owner',
        );
      }

      /**
       * ========================================================
       * 3. GET CURRENT MEMBER
       * ========================================================
       */
      const currentMember =
        await tx.companyMember.findUnique({
          where: {
            id: ownerMemberId,
          },

          select: {
            id: true,
            status: true,
            activatedAt: true,
          },
        });

      if (!currentMember) {
        throw new NotFoundException(
          'Company member not found',
        );
      }

      /**
       * ========================================================
       * 4. NO-OP PROTECTION
       * ========================================================
       */
      if (
        currentMember.status === dto.status
      ) {
        return {
          success: true,

          message:
            'Company owner status is already up to date',

          data: currentMember,
        };
      }

      /**
       * ========================================================
       * 5. UPDATE MEMBER STATUS
       * ========================================================
       */
      const member =
        await tx.companyMember.update({
          where: {
            id: ownerMemberId,
          },

          data: {
            status: dto.status,

            ...(dto.status ===
              CompanyMembershipStatus.ACTIVE && {
              activatedAt:
                currentMember.activatedAt ??
                new Date(),
            }),
          },

          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                status: true,
              },
            },
          },
        });

      /**
       * ========================================================
       * 6. AUDIT DATA
       * ========================================================
       */
      const beforeData = {
        status: currentMember.status,
      };

      const afterData = {
        status: member.status,
      };

      /**
       * ========================================================
       * 7. AUDIT LOG
       * ========================================================
       */
      await tx.auditLog.create({
        data: {
          tenantId: ownership.tenantId,

          companyId,

          actorUserId,

          actorType: 'PLATFORM_MEMBER',

          action:
            'COMPANY_OWNER_STATUS_UPDATED',

          entityType: 'CompanyMember',

          entityId: ownerMemberId,

          beforeData,

          afterData,
        },
      });

      /**
       * ========================================================
       * 8. RESPONSE
       * ========================================================
       */
      return {
        success: true,

        message:
          'Company owner status updated successfully',

        data: member,
      };
    });
  }
}