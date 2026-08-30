import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  parentCategoryId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: CATEGORY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: categories.length, data: categories };
  }

  async findOne(context: CompanyContext, id: string) {
    const category = await this.requireCategory(context, id);
    return { success: true, data: category };
  }

  async create(context: CompanyContext, dto: CreateCategoryDto, actor: AuthenticatedUser) {
    if (dto.parentCategoryId) await this.requireCategory(context, dto.parentCategoryId);

    try {
      const category = await this.prisma.$transaction(async (tx) => {
        const created = await tx.category.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            name: dto.name.trim(),
            parentCategoryId: dto.parentCategoryId,
          },
          select: CATEGORY_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'CATEGORY_CREATED', created.id, null, created);
        return created;
      });
      return { success: true, data: category };
    } catch (error) {
      this.throwKnownConflict(error, 'A category with this name already exists in this company');
      throw error;
    }
  }

  async update(context: CompanyContext, id: string, dto: UpdateCategoryDto, actor: AuthenticatedUser) {
    const before = await this.requireCategory(context, id);

    if (dto.parentCategoryId !== undefined) {
      if (dto.parentCategoryId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      if (dto.parentCategoryId) await this.requireCategory(context, dto.parentCategoryId);
    }

    try {
      const category = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.parentCategoryId !== undefined ? { parentCategoryId: dto.parentCategoryId || null } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: CATEGORY_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'CATEGORY_UPDATED', updated.id, before, updated);
        return updated;
      });
      return { success: true, data: category };
    } catch (error) {
      this.throwKnownConflict(error, 'A category with this name already exists in this company');
      throw error;
    }
  }

  private async requireCategory(context: CompanyContext, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: CATEGORY_SELECT,
    });
    if (!category) throw new NotFoundException('Category was not found');
    return category;
  }

  private createAudit(
    tx: Prisma.TransactionClient,
    context: CompanyContext,
    actorUserId: string,
    action: string,
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
        entityType: 'Category',
        entityId,
        ...(beforeData === null ? {} : { beforeData: beforeData as Prisma.InputJsonValue }),
        ...(afterData === null ? {} : { afterData: afterData as Prisma.InputJsonValue }),
      },
    });
  }

  private throwKnownConflict(error: unknown, message: string): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }
}
