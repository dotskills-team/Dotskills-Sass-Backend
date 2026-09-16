import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

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
  hasVariants: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

/** Mirrors `ProductVariantService`'s own `VARIANT_SELECT` exactly — kept as a separate local copy rather than a cross-service import, since this is the only variant read `ProductService` ever does. */
const VARIANT_SELECT = {
  id: true,
  productId: true,
  sku: true,
  barcode: true,
  costPrice: true,
  salePrice: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  attributeValues: {
    select: {
      attributeValue: {
        select: {
          id: true,
          value: true,
          attribute: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductVariantSelect;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext, query: ListProductsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * POS barcode-scan lookup — an EXACT match only (never the fuzzy
   * `search` used by manual typing), checked against `Product.barcode`
   * first and `ProductVariant.barcode` second (a variant-tracked product
   * can carry its own distinct barcode per variant, e.g. one per T-Shirt
   * size/color). Both checks are `tenantId+companyId+barcode` equality —
   * exactly the columns Postgres already backs with a unique index via
   * each model's own `@@unique([tenantId, companyId, barcode])`, so this
   * is a genuine indexed point lookup, not a table scan.
   *
   * Deliberately does NOT filter by status — an INACTIVE match is still
   * returned (with its real status) so the caller can show a specific
   * "this product is inactive" message instead of conflating it with
   * "no such barcode". Returns `data: null` (200, not 404) when nothing
   * matches at all — a scanned code not belonging to any product is an
   * expected, routine outcome of scanning, not a server error.
   */
  async findByBarcode(context: CompanyContext, code: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        barcode: code,
      },
      select: PRODUCT_SELECT,
    });
    if (product) {
      return { success: true, data: { product, variant: null } };
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        barcode: code,
      },
      select: VARIANT_SELECT,
    });
    if (variant) {
      const parentProduct = await this.prisma.product.findFirst({
        where: {
          id: variant.productId,
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
        select: PRODUCT_SELECT,
      });
      // The variant's own tenant/company scoping already guarantees its
      // parent Product belongs here too (both written in the same
      // transaction, never re-parented) — this null-check is just
      // defensive, not a real expected path.
      if (parentProduct) {
        return { success: true, data: { product: parentProduct, variant } };
      }
    }

    return { success: true, data: null };
  }

  async findOne(context: CompanyContext, id: string) {
    const product = await this.requireProduct(context, id);
    return { success: true, data: product };
  }

  async create(
    context: CompanyContext,
    dto: CreateProductDto,
    actor: AuthenticatedUser,
  ) {
    await this.requireUnitInScope(context, dto.baseUnitId);
    if (dto.categoryId)
      await this.requireCategoryInScope(context, dto.categoryId);

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
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'PRODUCT_CREATED',
          created.id,
          null,
          created,
        );
        return created;
      });
      return { success: true, data: product };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A product with this SKU or barcode already exists in this company',
      );
      throw error;
    }
  }

  async update(
    context: CompanyContext,
    id: string,
    dto: UpdateProductDto,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireProduct(context, id);
    if (dto.baseUnitId !== undefined)
      await this.requireUnitInScope(context, dto.baseUnitId);
    if (dto.categoryId !== undefined && dto.categoryId)
      await this.requireCategoryInScope(context, dto.categoryId);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.categoryId !== undefined
              ? { categoryId: dto.categoryId || null }
              : {}),
            ...(dto.baseUnitId !== undefined
              ? { baseUnitId: dto.baseUnitId }
              : {}),
            ...(dto.barcode !== undefined
              ? { barcode: dto.barcode.trim() || null }
              : {}),
            ...(dto.costPrice !== undefined
              ? { costPrice: dto.costPrice }
              : {}),
            ...(dto.salePrice !== undefined
              ? { salePrice: dto.salePrice }
              : {}),
            ...(dto.reorderLevel !== undefined
              ? { reorderLevel: dto.reorderLevel }
              : {}),
            ...(dto.sellByWeight !== undefined
              ? { sellByWeight: dto.sellByWeight }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: PRODUCT_SELECT,
        });
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'PRODUCT_UPDATED',
          updated.id,
          before,
          updated,
        );
        return updated;
      });
      return { success: true, data: product };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A product with this SKU or barcode already exists in this company',
      );
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
      where: {
        id: unitId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true },
    });
    if (!unit)
      throw new BadRequestException(
        'baseUnitId does not refer to a unit in this company',
      );
  }

  private async requireCategoryInScope(
    context: CompanyContext,
    categoryId: string,
  ) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true },
    });
    if (!category)
      throw new BadRequestException(
        'categoryId does not refer to a category in this company',
      );
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
