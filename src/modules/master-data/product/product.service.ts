import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  categoryId: true,
  baseUnitId: true,
  costPrice: true,
  salePrice: true,
  reorderLevel: true,
  sellByWeight: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const products = await this.prisma.product.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: PRODUCT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: products.length, data: products };
  }

  async findOne(context: CompanyContext, id: string) {
    const product = await this.requireProduct(context, id);
    return { success: true, data: product };
  }

  async create(context: CompanyContext, dto: CreateProductDto, actor: AuthenticatedUser) {
    await this.requireUnitInScope(context, dto.baseUnitId);
    if (dto.categoryId) await this.requireCategoryInScope(context, dto.categoryId);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            sku: dto.sku.trim(),
            barcode: dto.barcode?.trim() || undefined,
            name: dto.name.trim(),
            categoryId: dto.categoryId,
            baseUnitId: dto.baseUnitId,
            costPrice: dto.costPrice,
            salePrice: dto.salePrice,
            reorderLevel: dto.reorderLevel,
            sellByWeight: dto.sellByWeight ?? false,
          },
          select: PRODUCT_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'PRODUCT_CREATED', created.id, null, created);
        return created;
      });
      return { success: true, data: product };
    } catch (error) {
      this.throwKnownConflict(error, 'A product with this SKU or barcode already exists in this company');
      throw error;
    }
  }

  async update(context: CompanyContext, id: string, dto: UpdateProductDto, actor: AuthenticatedUser) {
    const before = await this.requireProduct(context, id);
    if (dto.baseUnitId !== undefined) await this.requireUnitInScope(context, dto.baseUnitId);
    if (dto.categoryId !== undefined && dto.categoryId) await this.requireCategoryInScope(context, dto.categoryId);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
            ...(dto.baseUnitId !== undefined ? { baseUnitId: dto.baseUnitId } : {}),
            ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() || null } : {}),
            ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
            ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
            ...(dto.reorderLevel !== undefined ? { reorderLevel: dto.reorderLevel } : {}),
            ...(dto.sellByWeight !== undefined ? { sellByWeight: dto.sellByWeight } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: PRODUCT_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'PRODUCT_UPDATED', updated.id, before, updated);
        return updated;
      });
      return { success: true, data: product };
    } catch (error) {
      this.throwKnownConflict(error, 'A product with this SKU or barcode already exists in this company');
      throw error;
    }
  }

  private async requireProduct(context: CompanyContext, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: PRODUCT_SELECT,
    });
    if (!product) throw new NotFoundException('Product was not found');
    return product;
  }

  private async requireUnitInScope(context: CompanyContext, unitId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true },
    });
    if (!unit) throw new BadRequestException('baseUnitId does not refer to a unit in this company');
  }

  private async requireCategoryInScope(context: CompanyContext, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('categoryId does not refer to a category in this company');
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
        entityType: 'Product',
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
