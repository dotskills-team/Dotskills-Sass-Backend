import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// import {
//   AuditActorType,
//   PlanStatus,
//   Prisma,
// } from '../../generated/phase-1-prisma';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlanDto } from './dto/query-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuditActorType, PlanStatus } from 'src/generated/phase-1-prisma/enums';
import { Prisma } from 'src/generated/phase-1-prisma/client';

interface AuditContext {
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize plan code.
   */
  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  /**
   * Normalize plan name.
   */
  private normalizeName(name: string): string {
    return name.trim();
  }

  /**
   * Create Plan
   */
  async create(dto: CreatePlanDto, context: AuditContext) {
    const code = this.normalizeCode(dto.code);
    const name = this.normalizeName(dto.name);

    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (existingPlan) {
      throw new ConflictException(`Plan with code "${code}" already exists`);
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      const createdPlan = await tx.plan.create({
        data: {
          code,
          name,
          description: dto.description?.trim() || null,
          trialDays: dto.trialDays ?? 0,
          isPublic: dto.isPublic ?? true,
          status: PlanStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          trialDays: true,
          isPublic: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,
          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_CREATED',
          entityType: 'PLAN',
          entityId: createdPlan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: Prisma.JsonNull,

          afterData: {
            id: createdPlan.id,
            code: createdPlan.code,
            name: createdPlan.name,
            description: createdPlan.description,
            trialDays: createdPlan.trialDays,
            isPublic: createdPlan.isPublic,
            status: createdPlan.status,
          },

          metadata: {
            source: 'PLAN_SERVICE',
          },
        },
      });

      return createdPlan;
    });

    return {
      success: true,
      message: 'Plan created successfully',
      data: plan,
    };
  }

  /**
   * Get Plans
   */
  async findAll(query: QueryPlanDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const isPublic =
      query.isPublic !== undefined ? query.isPublic === 'true' : undefined;

    const where: Prisma.PlanWhereInput = {
      ...(query.status && {
        status: query.status,
      }),

      ...(isPublic !== undefined && {
        isPublic,
      }),

      ...(query.search?.trim() && {
        OR: [
          {
            code: {
              contains: query.search.trim(),
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: query.search.trim(),
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [plans, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          trialDays: true,
          isPublic: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          _count: {
            select: {
              features: true,
              prices: true,
              subscriptions: true,
            },
          },
        },
      }),

      this.prisma.plan.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Plans retrieved successfully',

      data: plans,

      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get Single Plan
   */
  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        trialDays: true,
        isPublic: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        features: {
          select: {
            enabled: true,
            limits: true,
            createdAt: true,
            updatedAt: true,

            feature: {
              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
              },
            },
          },

          orderBy: {
            createdAt: 'asc',
          },
        },

        prices: {
          select: {
            id: true,
            billingCycle: true,
            currencyCode: true,
            amount: true,
            effectiveFrom: true,
            effectiveTo: true,
            isActive: true,
            createdAt: true,
          },

          orderBy: {
            effectiveFrom: 'desc',
          },
        },

        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return {
      success: true,
      message: 'Plan retrieved successfully',
      data: plan,
    };
  }

  /**
   * Update Plan
   */
  async update(id: string, dto: UpdatePlanDto, context: AuditContext) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        trialDays: true,
        isPublic: true,
        isDefaultTrial: true,
        status: true,
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plan not found');
    }

    if (existingPlan.status === PlanStatus.ARCHIVED) {
      throw new BadRequestException('Archived plan cannot be updated');
    }

    const data: Prisma.PlanUpdateInput = {};

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);

      const duplicate = await this.prisma.plan.findFirst({
        where: {
          code,
          NOT: {
            id,
          },
        },

        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException(`Plan with code "${code}" already exists`);
      }

      data.code = code;
    }

    if (dto.name !== undefined) {
      data.name = this.normalizeName(dto.name);
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }

    if (dto.trialDays !== undefined) {
      data.trialDays = dto.trialDays;
    }

    if (dto.isPublic !== undefined) {
      data.isPublic = dto.isPublic;
    }

    if (dto.isDefaultTrial !== undefined) {
      data.isDefaultTrial = dto.isDefaultTrial;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    const updatedPlan = await this.prisma.$transaction(async (tx) => {
      /**
       * Exactly one Plan may be the default-trial Plan at a time (mirrors
       * CompanyOwnership.isPrimary's existing "only one" pattern) — a new
       * Company's auto-trial subscription always uses whichever Plan this
       * flag is currently on, so ambiguity here would be a real business bug.
       */
      if (dto.isDefaultTrial === true) {
        await tx.plan.updateMany({
          where: { NOT: { id }, isDefaultTrial: true },
          data: { isDefaultTrial: false },
        });
      }

      const plan = await tx.plan.update({
        where: {
          id,
        },

        data,

        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          trialDays: true,
          isPublic: true,
          isDefaultTrial: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_UPDATED',

          entityType: 'PLAN',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: {
            code: existingPlan.code,
            name: existingPlan.name,
            description: existingPlan.description,
            trialDays: existingPlan.trialDays,
            isPublic: existingPlan.isPublic,
            isDefaultTrial: existingPlan.isDefaultTrial,
            status: existingPlan.status,
          },

          afterData: {
            code: plan.code,
            name: plan.name,
            description: plan.description,
            trialDays: plan.trialDays,
            isPublic: plan.isPublic,
            isDefaultTrial: plan.isDefaultTrial,
            status: plan.status,
          },

          metadata: {
            source: 'PLAN_SERVICE',
          },
        },
      });

      return plan;
    });

    return {
      success: true,
      message: 'Plan updated successfully',
      data: updatedPlan,
    };
  }

  /**
   * Change Plan Status
   */
  async updateStatus(id: string, status: PlanStatus, context: AuditContext) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isPublic: true,
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plan not found');
    }

    if (existingPlan.status === PlanStatus.ARCHIVED) {
      throw new BadRequestException('Archived plan status cannot be changed');
    }

    if (existingPlan.status === status) {
      throw new BadRequestException(`Plan is already ${status}`);
    }

    const updatedPlan = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.update({
        where: {
          id,
        },

        data: {
          status,

          ...(status === PlanStatus.INACTIVE && {
            isPublic: false,
          }),
        },

        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          isPublic: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_STATUS_CHANGED',

          entityType: 'PLAN',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: {
            status: existingPlan.status,
            isPublic: existingPlan.isPublic,
          },

          afterData: {
            status: plan.status,
            isPublic: plan.isPublic,
          },

          metadata: {
            source: 'PLAN_SERVICE',
          },
        },
      });

      return plan;
    });

    return {
      success: true,
      message: 'Plan status updated successfully',
      data: updatedPlan,
    };
  }

  /**
   * Archive Plan
   */
  async archive(id: string, context: AuditContext) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isPublic: true,

        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plan not found');
    }

    if (existingPlan.status === PlanStatus.ARCHIVED) {
      throw new BadRequestException('Plan is already archived');
    }

    if (existingPlan._count.subscriptions > 0) {
      throw new BadRequestException(
        'Plan cannot be archived because subscriptions are associated with it',
      );
    }

    const archivedPlan = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.update({
        where: {
          id,
        },

        data: {
          status: PlanStatus.ARCHIVED,

          isPublic: false,
        },

        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          isPublic: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_ARCHIVED',

          entityType: 'PLAN',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: {
            status: existingPlan.status,
            isPublic: existingPlan.isPublic,
          },

          afterData: {
            status: plan.status,
            isPublic: plan.isPublic,
          },

          metadata: {
            source: 'PLAN_SERVICE',
          },
        },
      });

      return plan;
    });

    return {
      success: true,
      message: 'Plan archived successfully',
      data: archivedPlan,
    };
  }
}
