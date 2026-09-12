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

/**
 * Trailing legal-entity tokens stripped only from the *code* base (never
 * the slug) — matches the required example (`ABC Trading Ltd` →
 * `ABC-TRADING-001`, `LTD` dropped) while the slug keeps the full name
 * (`abc-trading-ltd`). Only trailing tokens are stripped, one at a time, so
 * a legitimate business name that merely contains one of these words mid-
 * name (not as a suffix) is never mangled.
 */
const CODE_SUFFIX_STOPWORDS = new Set([
  'LTD',
  'LIMITED',
  'INC',
  'INCORPORATED',
  'LLC',
  'LLP',
  'CORP',
  'CORPORATION',
  'CO',
  'COMPANY',
  'PLC',
  'PVT',
  'PRIVATE',
]);

const MAX_GENERATION_ATTEMPTS = 5;

@Injectable()
export class TenantManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CREATE TENANT
   *
   * `code` and `slug` are always system-generated from `name` — never
   * accepted from the client (see CreateTenantDto). Uniqueness is decided
   * from current rows (readable, sequential `-001`/`-2` suffixes) and then
   * enforced for real by the DB's own unique constraints: if a concurrent
   * request wins the same candidate, Prisma raises P2002 and this retries
   * with a freshly-computed next candidate — no duplicate can ever persist,
   * race or not.
   */
  async create(dto: CreateTenantDto, actorUserId: string) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Tenant name is required');
    }

    const codeBase = this.buildCodeBase(name);
    const slugBase = this.buildSlugBase(name);

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const [code, slug] = await Promise.all([
        this.generateUniqueCode(codeBase),
        this.generateUniqueSlug(slugBase),
      ]);

      try {
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
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Could not generate a unique tenant code/slug after several attempts, please retry.',
      { cause: lastError },
    );
  }

  /**
   * Readable, uppercase, dash-joined base for the code (e.g. "ABC TRADING
   * LTD" → "ABC-TRADING"). Trailing legal-entity words are stripped one at
   * a time so a name that's *entirely* a stopword (rare) still yields a
   * base rather than an empty string. Truncated to leave room for the
   * "-NNN" suffix within the schema's 40-char limit.
   */
  private buildCodeBase(name: string): string {
    const tokens = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(Boolean);

    while (tokens.length > 1 && CODE_SUFFIX_STOPWORDS.has(tokens[tokens.length - 1])) {
      tokens.pop();
    }

    const base = tokens.join('-').slice(0, 30);
    return base || 'TENANT';
  }

  /** Lowercase, URL-safe base for the slug — keeps the full name (no suffix stripping). */
  private buildSlugBase(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);

    return slug || 'tenant';
  }

  private async generateUniqueCode(base: string): Promise<string> {
    const rows = await this.prisma.tenant.findMany({
      where: { code: { startsWith: `${base}-` } },
      select: { code: true },
    });

    let max = 0;
    for (const row of rows) {
      const suffix = row.code.slice(base.length + 1);
      const num = Number(suffix);
      if (Number.isInteger(num) && num > max) max = num;
    }

    return `${base}-${String(max + 1).padStart(3, '0')}`;
  }

  private async generateUniqueSlug(base: string): Promise<string> {
    const [baseTaken, numberedRows] = await Promise.all([
      this.prisma.tenant.findFirst({ where: { slug: base }, select: { id: true } }),
      this.prisma.tenant.findMany({
        where: { slug: { startsWith: `${base}-` } },
        select: { slug: true },
      }),
    ]);

    if (!baseTaken && numberedRows.length === 0) {
      return base;
    }

    let max = 1;
    for (const row of numberedRows) {
      const suffix = row.slug.slice(base.length + 1);
      const num = Number(suffix);
      if (Number.isInteger(num) && num > max) max = num;
    }

    return `${base}-${max + 1}`;
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
     * Update name — `code`/`slug` are never touched here. `code` stays
     * stable for the tenant's lifetime by design; `slug` is likewise left
     * untouched on a name edit (no auto-regeneration) since it may already
     * be referenced elsewhere — only `name` itself is user-editable.
     */
    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Tenant name cannot be empty');
      }

      data.name = name;
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
