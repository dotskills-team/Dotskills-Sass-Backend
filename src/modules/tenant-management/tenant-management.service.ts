import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { Prisma } from '../../generated/phase-1-prisma/client';
import {
  AuditActorType,
  TenantStatus,
} from '../../generated/phase-1-prisma/enums';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';

@Injectable()
export class TenantManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CREATE TENANT
   */
  async create(dto: CreateTenantDto, actorUserId: string) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();

    /**
     * Check duplicate code / slug
     */
    const existing = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          {
            code,
          },
          {
            slug,
          },
        ],
      },
      select: {
        id: true,
        code: true,
        slug: true,
      },
    });

    if (existing) {
      if (existing.code === code) {
        throw new ConflictException('Tenant code already exists');
      }

      if (existing.slug === slug) {
        throw new ConflictException('Tenant slug already exists');
      }
    }

    /**
     * Create tenant + audit log
     */
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          code,
          name,
          slug,
          status: TenantStatus.DRAFT,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: created.id,
          actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'TENANT_CREATED',
          entityType: 'TENANT',
          entityId: created.id,
          afterData: {
            id: created.id,
            code: created.code,
            name: created.name,
            slug: created.slug,
            status: created.status,
          },
        },
      });

      return created;
    });

    return {
      success: true,
      message: 'Tenant created successfully',
      data: tenant,
    };
  }

  /**
   * GET ALL TENANTS
   */
  async findAll(query: TenantQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

    /**
     * Status filter
     */
    if (query.status) {
      where.status = query.status;
    }

    /**
     * Search
     */
    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
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
          slug: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              companies: true,
              members: true,
              subscriptions: true,
              invitations: true,
            },
          },
        },
      }),

      this.prisma.tenant.count({
        where,
      }),
    ]);

    return {
      success: true,
      message: 'Tenants fetched successfully',
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET SINGLE TENANT
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            companies: true,
            members: true,
            subscriptions: true,
            invitations: true,
            ownerships: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      success: true,
      message: 'Tenant fetched successfully',
      data: tenant,
    };
  }

  /**
   * UPDATE TENANT
   */
  async update(id: string, dto: UpdateTenantDto, actorUserId: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const data: Prisma.TenantUpdateInput = {};

    /**
     * Update name
     */
    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Tenant name cannot be empty');
      }

      data.name = name;
    }

    /**
     * Update slug
     */
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();

      if (!slug) {
        throw new BadRequestException('Tenant slug cannot be empty');
      }

      const slugExists = await this.prisma.tenant.findFirst({
        where: {
          slug,
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
      });

      if (slugExists) {
        throw new ConflictException('Tenant slug already exists');
      }

      data.slug = slug;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No valid fields provided for update');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenant.update({
        where: {
          id,
        },
        data,
      });

      await tx.auditLog.create({
        data: {
          tenantId: result.id,
          actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'TENANT_UPDATED',
          entityType: 'TENANT',
          entityId: result.id,
          beforeData: {
            name: existing.name,
            slug: existing.slug,
          },
          afterData: {
            name: result.name,
            slug: result.slug,
          },
        },
      });

      return result;
    });

    return {
      success: true,
      message: 'Tenant updated successfully',
      data: updated,
    };
  }

  /**
   * UPDATE TENANT STATUS
   */
  async updateStatus(
    id: string,
    dto: UpdateTenantStatusDto,
    actorUserId: string,
  ) {
    const existing = await this.prisma.tenant.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    /**
     * Cancelled tenant cannot be activated
     * through normal status update.
     */
    if (existing.status === TenantStatus.CANCELLED) {
      throw new BadRequestException('Cancelled tenant cannot change status');
    }

    const nextStatus = dto.status;

    const data: Prisma.TenantUpdateInput = {
      status: nextStatus,
    };

    /**
     * ACTIVE timestamp
     */
    if (nextStatus === TenantStatus.ACTIVE && !existing.activatedAt) {
      data.activatedAt = new Date();
    }

    /**
     * SUSPENDED timestamp
     */
    if (nextStatus === TenantStatus.SUSPENDED) {
      data.suspendedAt = new Date();
    } else {
      data.suspendedAt = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenant.update({
        where: {
          id,
        },
        data,
      });

      await tx.auditLog.create({
        data: {
          tenantId: result.id,
          actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'TENANT_STATUS_CHANGED',
          entityType: 'TENANT',
          entityId: result.id,
          beforeData: {
            status: existing.status,
          },
          afterData: {
            status: result.status,
          },
        },
      });

      return result;
    });

    return {
      success: true,
      message: 'Tenant status updated successfully',
      data: updated,
    };
  }

  /**
   * CANCEL TENANT
   *
   * No hard delete.
   *
   * Tenant is a core SaaS entity and has
   * multiple dependent records.
   */
  async remove(id: string, actorUserId: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    if (existing.status === TenantStatus.CANCELLED) {
      throw new BadRequestException('Tenant is already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenant.update({
        where: {
          id,
        },
        data: {
          status: TenantStatus.CANCELLED,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: result.id,
          actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'TENANT_CANCELLED',
          entityType: 'TENANT',
          entityId: result.id,
          beforeData: {
            status: existing.status,
          },
          afterData: {
            status: result.status,
          },
        },
      });

      return result;
    });

    return {
      success: true,
      message: 'Tenant cancelled successfully',
      data: updated,
    };
  }
}
