import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpdateFeatureStatusDto } from './dto/update-feature-status.dto';
import { QueryFeatureDto } from './dto/query-feature.dto';

import {
  AuditActorType,
  FeatureStatus,
  Prisma,
} from '../../generated/phase-1-prisma/client';

interface AuditContext {
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class FeatureService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    dto: CreateFeatureDto,
    context: AuditContext,
  ) {
    const name = dto.name.trim();

    const code = dto.code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    const module = dto.module
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    const description =
      dto.description?.trim() || null;

    const existing =
      await this.prisma.feature.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
          code: true,
        },
      });

    if (existing) {
      throw new ConflictException(
        `Feature with code "${code}" already exists`,
      );
    }

    const feature =
      await this.prisma.$transaction(
        async (tx) => {
          const created =
            await tx.feature.create({
              data: {
                name,
                code,
                module,
                description,
                status:
                  FeatureStatus.ACTIVE,
              },

              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                context.actorUserId ?? null,

              actorType:
                context.actorUserId
                  ? AuditActorType.PLATFORM_MEMBER
                  : AuditActorType.SYSTEM,

              action:
                'FEATURE_CREATED',

              entityType:
                'FEATURE',

              entityId:
                created.id,

              requestId:
                context.requestId ?? null,

              ipAddress:
                context.ipAddress ?? null,

              userAgent:
                context.userAgent ?? null,

              beforeData:
                Prisma.JsonNull,

              afterData: {
                id: created.id,
                code: created.code,
                name: created.name,
                module: created.module,
                description:
                  created.description,
                status:
                  created.status,
              },

              metadata: {
                source:
                  'FEATURE_SERVICE',
              },
            },
          });

          return created;
        },
      );

    return {
      success: true,
      message:
        'Feature created successfully',
      data: feature,
    };
  }

  // =========================================================
  // GET ALL
  // =========================================================

  async findAll(
    query: QueryFeatureDto,
  ) {
    const search =
      query.search?.trim();

    const status =
      query.status;

    const module =
      query.module?.trim();

    const features =
      await this.prisma.feature.findMany({
        where: {
          ...(status && {
            status,
          }),

          ...(module && {
            module: {
              equals: module
                .toUpperCase(),
            },
          }),

          ...(search && {
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
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }),
        },

        orderBy: [
          {
            module: 'asc',
          },
          {
            name: 'asc',
          },
        ],

        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return {
      success: true,
      message:
        'Features retrieved successfully',
      data: features,
      meta: {
        total: features.length,
      },
    };
  }

  // =========================================================
  // GET ONE
  // =========================================================

  async findOne(
    id: string,
  ) {
    const feature =
      await this.prisma.feature.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          _count: {
            select: {
              planFeatures: true,
            },
          },
        },
      });

    if (!feature) {
      throw new NotFoundException(
        'Feature not found',
      );
    }

    return {
      success: true,
      message:
        'Feature retrieved successfully',
      data: feature,
    };
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    id: string,
    dto: UpdateFeatureDto,
    context: AuditContext,
  ) {
    const existing =
      await this.prisma.feature.findUnique({
        where: {
          id,
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

    if (!existing) {
      throw new NotFoundException(
        'Feature not found',
      );
    }

    if (
      existing.status ===
      FeatureStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Archived feature cannot be modified',
      );
    }

    if (
      dto.name === undefined &&
      dto.code === undefined &&
      dto.module === undefined &&
      dto.description === undefined
    ) {
      throw new BadRequestException(
        'No fields provided for update',
      );
    }

    const data: Prisma.FeatureUpdateInput =
      {};

    if (dto.name !== undefined) {
      data.name =
        dto.name.trim();
    }

    if (dto.code !== undefined) {
      const code = dto.code
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

      if (code !== existing.code) {
        const duplicate =
          await this.prisma.feature.findUnique({
            where: {
              code,
            },
            select: {
              id: true,
            },
          });

        if (
          duplicate &&
          duplicate.id !== id
        ) {
          throw new ConflictException(
            `Feature with code "${code}" already exists`,
          );
        }
      }

      data.code = code;
    }

    if (dto.module !== undefined) {
      data.module =
        dto.module
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_');
    }

    if (dto.description !== undefined) {
      data.description =
        dto.description?.trim() || null;
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const feature =
            await tx.feature.update({
              where: {
                id,
              },

              data,

              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                context.actorUserId ?? null,

              actorType:
                context.actorUserId
                  ? AuditActorType.PLATFORM_MEMBER
                  : AuditActorType.SYSTEM,

              action:
                'FEATURE_UPDATED',

              entityType:
                'FEATURE',

              entityId: id,

              requestId:
                context.requestId ?? null,

              ipAddress:
                context.ipAddress ?? null,

              userAgent:
                context.userAgent ?? null,

              beforeData: {
                code:
                  existing.code,
                name:
                  existing.name,
                module:
                  existing.module,
                description:
                  existing.description,
                status:
                  existing.status,
              },

              afterData: {
                code:
                  feature.code,
                name:
                  feature.name,
                module:
                  feature.module,
                description:
                  feature.description,
                status:
                  feature.status,
              },

              metadata: {
                source:
                  'FEATURE_SERVICE',
              },
            },
          });

          return feature;
        },
      );

    return {
      success: true,
      message:
        'Feature updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // UPDATE STATUS
  // =========================================================

  async updateStatus(
    id: string,
    dto: UpdateFeatureStatusDto,
    context: AuditContext,
  ) {
    const existing =
      await this.prisma.feature.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          code: true,
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Feature not found',
      );
    }

    if (
      existing.status ===
      FeatureStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Archived feature status cannot be changed',
      );
    }

    if (
      existing.status === dto.status
    ) {
      throw new BadRequestException(
        `Feature is already ${dto.status}`,
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const feature =
            await tx.feature.update({
              where: {
                id,
              },

              data: {
                status:
                  dto.status,
              },

              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                context.actorUserId ?? null,

              actorType:
                context.actorUserId
                  ? AuditActorType.PLATFORM_MEMBER
                  : AuditActorType.SYSTEM,

              action:
                'FEATURE_STATUS_UPDATED',

              entityType:
                'FEATURE',

              entityId: id,

              requestId:
                context.requestId ?? null,

              ipAddress:
                context.ipAddress ?? null,

              userAgent:
                context.userAgent ?? null,

              beforeData: {
                status:
                  existing.status,
              },

              afterData: {
                status:
                  feature.status,
              },

              metadata: {
                source:
                  'FEATURE_SERVICE',
              },
            },
          });

          return feature;
        },
      );

    return {
      success: true,
      message:
        'Feature status updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // ACTIVATE
  // =========================================================

  async activate(
    id: string,
    context: AuditContext,
  ) {
    return this.changeStatus(
      id,
      FeatureStatus.ACTIVE,
      'FEATURE_ACTIVATED',
      context,
    );
  }

  // =========================================================
  // DEACTIVATE
  // =========================================================

  async deactivate(
    id: string,
    context: AuditContext,
  ) {
    return this.changeStatus(
      id,
      FeatureStatus.INACTIVE,
      'FEATURE_DEACTIVATED',
      context,
    );
  }

  // =========================================================
  // ARCHIVE
  // =========================================================

  async archive(
    id: string,
    context: AuditContext,
  ) {
    const existing =
      await this.prisma.feature.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Feature not found',
      );
    }

    if (
      existing.status ===
      FeatureStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Feature is already archived',
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const feature =
            await tx.feature.update({
              where: {
                id,
              },

              data: {
                status:
                  FeatureStatus.ARCHIVED,
              },

              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                context.actorUserId ?? null,

              actorType:
                context.actorUserId
                  ? AuditActorType.PLATFORM_MEMBER
                  : AuditActorType.SYSTEM,

              action:
                'FEATURE_ARCHIVED',

              entityType:
                'FEATURE',

              entityId: id,

              requestId:
                context.requestId ?? null,

              ipAddress:
                context.ipAddress ?? null,

              userAgent:
                context.userAgent ?? null,

              beforeData: {
                status:
                  existing.status,
              },

              afterData: {
                status:
                  FeatureStatus.ARCHIVED,
              },

              metadata: {
                source:
                  'FEATURE_SERVICE',
              },
            },
          });

          return feature;
        },
      );

    return {
      success: true,
      message:
        'Feature archived successfully',
      data: updated,
    };
  }

  // =========================================================
  // INTERNAL STATUS CHANGE
  // =========================================================

  private async changeStatus(
    id: string,
    status: FeatureStatus,
    action: string,
    context: AuditContext,
  ) {
    const existing =
      await this.prisma.feature.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          code: true,
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Feature not found',
      );
    }

    if (
      existing.status ===
      FeatureStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Archived feature cannot be activated or deactivated',
      );
    }

    if (
      existing.status === status
    ) {
      throw new BadRequestException(
        `Feature is already ${status}`,
      );
    }

    const updated =
      await this.prisma.$transaction(
        async (tx) => {
          const feature =
            await tx.feature.update({
              where: {
                id,
              },

              data: {
                status,
              },

              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                context.actorUserId ?? null,

              actorType:
                context.actorUserId
                  ? AuditActorType.PLATFORM_MEMBER
                  : AuditActorType.SYSTEM,

              action,

              entityType:
                'FEATURE',

              entityId: id,

              requestId:
                context.requestId ?? null,

              ipAddress:
                context.ipAddress ?? null,

              userAgent:
                context.userAgent ?? null,

              beforeData: {
                status:
                  existing.status,
              },

              afterData: {
                status:
                  feature.status,
              },

              metadata: {
                source:
                  'FEATURE_SERVICE',
              },
            },
          });

          return feature;
        },
      );

    return {
      success: true,
      message:
        'Feature status changed successfully',
      data: updated,
    };
  }
}