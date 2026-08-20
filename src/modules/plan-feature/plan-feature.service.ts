import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// import {
//   AuditActorType,
//   FeatureStatus,
//   PlanStatus,
//   Prisma,
// } from '../../generated/phase-1-prisma';

import { PrismaService } from '../../prisma/prisma.service';

import { AssignPlanFeatureDto } from './dto/assign-plan-feature.dto';
import { QueryPlanFeatureDto } from './dto/query-plan-feature.dto';
import { UpdatePlanFeatureDto } from './dto/update-plan-feature.dto';
import {
  AuditActorType,
  FeatureStatus,
  PlanStatus,
} from 'src/generated/phase-1-prisma/enums';
import { Prisma } from 'src/generated/phase-1-prisma/client';

interface AuditContext {
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class PlanFeatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that plan exists and can be modified.
   */
  private async getModifiablePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id: planId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.status === PlanStatus.ARCHIVED) {
      throw new BadRequestException('Archived plan cannot be modified');
    }

    return plan;
  }

  /**
   * Validate feature.
   */
  private async getFeature(featureId: string) {
    const feature = await this.prisma.feature.findUnique({
      where: {
        id: featureId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        module: true,
        description: true,
        status: true,
      },
    });

    if (!feature) {
      throw new NotFoundException('Feature not found');
    }

    if (feature.status !== FeatureStatus.ACTIVE) {
      throw new BadRequestException(`Feature "${feature.code}" is not active`);
    }

    return feature;
  }

  /**
   * Assign feature to plan.
   */
  async assign(
    planId: string,
    dto: AssignPlanFeatureDto,
    context: AuditContext,
  ) {
    const plan = await this.getModifiablePlan(planId);

    const feature = await this.getFeature(dto.featureId);

    const existing = await this.prisma.planFeature.findUnique({
      where: {
        planId_featureId: {
          planId,
          featureId: dto.featureId,
        },
      },
      select: {
        planId: true,
        featureId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Feature "${feature.code}" is already assigned to plan "${plan.code}"`,
      );
    }

    const planFeature = await this.prisma.$transaction(async (tx) => {
      const created = await tx.planFeature.create({
        data: {
          planId,
          featureId: dto.featureId,
          enabled: dto.enabled ?? true,
          limits:
            dto.limits !== undefined
              ? (dto.limits as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },

        select: {
          planId: true,
          featureId: true,
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
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_FEATURE_ASSIGNED',

          entityType: 'PLAN_FEATURE',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: Prisma.JsonNull,

          afterData: {
            planId,
            planCode: plan.code,
            featureId: feature.id,
            featureCode: feature.code,
            enabled: created.enabled,
            limits: created.limits,
          },

          metadata: {
            source: 'PLAN_FEATURE_SERVICE',
          },
        },
      });

      return created;
    });

    return {
      success: true,
      message: 'Feature assigned to plan successfully',
      data: planFeature,
    };
  }

  /**
   * Get all features assigned to a plan.
   */
  async findAll(planId: string, query: QueryPlanFeatureDto) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id: planId,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const enabled =
      query.enabled !== undefined ? query.enabled === 'true' : undefined;

    const search = query.search?.trim();

    const planFeatures = await this.prisma.planFeature.findMany({
      where: {
        planId,

        ...(query.featureId && {
          featureId: query.featureId,
        }),

        ...(enabled !== undefined && {
          enabled,
        }),

        ...(search && {
          feature: {
            OR: [
              {
                code: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                module: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        }),
      },

      orderBy: {
        createdAt: 'asc',
      },

      select: {
        planId: true,
        featureId: true,
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
    });

    return {
      success: true,
      message: 'Plan features retrieved successfully',
      data: planFeatures,
      meta: {
        total: planFeatures.length,
      },
    };
  }

  /**
   * Get one assigned feature.
   */
  async findOne(planId: string, featureId: string) {
    const planFeature = await this.prisma.planFeature.findUnique({
      where: {
        planId_featureId: {
          planId,
          featureId,
        },
      },

      select: {
        planId: true,
        featureId: true,
        enabled: true,
        limits: true,
        createdAt: true,
        updatedAt: true,

        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },

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
    });

    if (!planFeature) {
      throw new NotFoundException('Plan feature assignment not found');
    }

    return {
      success: true,
      message: 'Plan feature retrieved successfully',
      data: planFeature,
    };
  }

  /**
   * Update plan feature.
   */
  async update(
    planId: string,
    featureId: string,
    dto: UpdatePlanFeatureDto,
    context: AuditContext,
  ) {
    const plan = await this.getModifiablePlan(planId);

    const existing = await this.prisma.planFeature.findUnique({
      where: {
        planId_featureId: {
          planId,
          featureId,
        },
      },

      select: {
        planId: true,
        featureId: true,
        enabled: true,
        limits: true,

        feature: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Plan feature assignment not found');
    }

    if (existing.feature.status !== FeatureStatus.ACTIVE) {
      throw new BadRequestException(
        'Inactive or archived feature cannot be modified',
      );
    }

    if (dto.enabled === undefined && dto.limits === undefined) {
      throw new BadRequestException('No fields provided for update');
    }

    const data: Prisma.PlanFeatureUpdateInput = {};

    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
    }

    if (dto.limits !== undefined) {
      data.limits = dto.limits as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const planFeature = await tx.planFeature.update({
        where: {
          planId_featureId: {
            planId,
            featureId,
          },
        },

        data,

        select: {
          planId: true,
          featureId: true,
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
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_FEATURE_UPDATED',

          entityType: 'PLAN_FEATURE',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: {
            enabled: existing.enabled,
            limits: existing.limits,
          },

          afterData: {
            enabled: planFeature.enabled,
            limits: planFeature.limits,
          },

          metadata: {
            source: 'PLAN_FEATURE_SERVICE',
            planId,
            featureId,
            featureCode: existing.feature.code,
          },
        },
      });

      return planFeature;
    });

    return {
      success: true,
      message: 'Plan feature updated successfully',
      data: updated,
    };
  }

  /**
   * Remove feature from plan.
   */
  async remove(planId: string, featureId: string, context: AuditContext) {
    const plan = await this.getModifiablePlan(planId);

    const existing = await this.prisma.planFeature.findUnique({
      where: {
        planId_featureId: {
          planId,
          featureId,
        },
      },

      select: {
        planId: true,
        featureId: true,
        enabled: true,
        limits: true,

        feature: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Plan feature assignment not found');
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.planFeature.delete({
        where: {
          planId_featureId: {
            planId,
            featureId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId ?? null,

          actorType: context.actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,

          action: 'PLAN_FEATURE_REMOVED',

          entityType: 'PLAN_FEATURE',

          entityId: plan.id,

          requestId: context.requestId ?? null,

          ipAddress: context.ipAddress ?? null,

          userAgent: context.userAgent ?? null,

          beforeData: {
            planId,
            featureId,
            featureCode: existing.feature.code,
            enabled: existing.enabled,
            limits: existing.limits,
          },

          afterData: Prisma.JsonNull,

          metadata: {
            source: 'PLAN_FEATURE_SERVICE',
          },
        },
      });

      return existing;
    });

    return {
      success: true,
      message: 'Feature removed from plan successfully',
      data: {
        planId: removed.planId,
        featureId: removed.featureId,
        featureCode: removed.feature.code,
      },
    };
  }
}
