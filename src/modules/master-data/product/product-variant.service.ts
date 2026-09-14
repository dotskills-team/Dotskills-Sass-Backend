import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
} from './dto/product-variant.dto';

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
export class ProductVariantService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext, productId: string) {
    await this.requireProduct(context, productId);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId,
      },
      select: VARIANT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: variants };
  }

  async create(
    context: CompanyContext,
    productId: string,
    dto: CreateProductVariantDto,
  ) {
    await this.requireProduct(context, productId);
    const attributeValueIds = this.normalizeValueIds(dto.attributeValueIds);
    await this.requireAttributeValuesInScope(context, attributeValueIds);
    await this.requireUniqueCombination(context, productId, attributeValueIds);

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            productId,
            sku: dto.sku.trim(),
            barcode: dto.barcode?.trim() || undefined,
            costPrice: dto.costPrice,
            salePrice: dto.salePrice,
            attributeValues: {
              create: attributeValueIds.map((attributeValueId) => ({
                attributeValueId,
              })),
            },
          },
          select: VARIANT_SELECT,
        });
        await tx.product.update({
          where: { id: productId },
          data: { hasVariants: true },
        });
        return created;
      });
      return { success: true, data: variant };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A variant with this SKU or barcode already exists in this company',
      );
      throw error;
    }
  }

  async update(
    context: CompanyContext,
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    await this.requireProduct(context, productId);
    const existing = await this.requireVariant(context, productId, variantId);

    let attributeValueIds: string[] | undefined;
    if (dto.attributeValueIds !== undefined) {
      attributeValueIds = this.normalizeValueIds(dto.attributeValueIds);
      await this.requireAttributeValuesInScope(context, attributeValueIds);
      await this.requireUniqueCombination(
        context,
        productId,
        attributeValueIds,
        variantId,
      );
    }

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        if (attributeValueIds) {
          await tx.productVariantAttributeValue.deleteMany({
            where: { variantId },
          });
        }
        return tx.productVariant.update({
          where: { id: existing.id },
          data: {
            ...(dto.barcode !== undefined
              ? { barcode: dto.barcode.trim() || null }
              : {}),
            ...(dto.costPrice !== undefined
              ? { costPrice: dto.costPrice }
              : {}),
            ...(dto.salePrice !== undefined
              ? { salePrice: dto.salePrice }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(attributeValueIds
              ? {
                  attributeValues: {
                    create: attributeValueIds.map((attributeValueId) => ({
                      attributeValueId,
                    })),
                  },
                }
              : {}),
          },
          select: VARIANT_SELECT,
        });
      });
      return { success: true, data: variant };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A variant with this SKU or barcode already exists in this company',
      );
      throw error;
    }
  }

  async remove(context: CompanyContext, productId: string, variantId: string) {
    await this.requireProduct(context, productId);
    const existing = await this.requireVariant(context, productId, variantId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productVariant.delete({ where: { id: existing.id } });
        const remaining = await tx.productVariant.count({
          where: { productId },
        });
        if (remaining === 0) {
          await tx.product.update({
            where: { id: productId },
            data: { hasVariants: false },
          });
        }
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        'This variant has stock, sale, or purchase history and cannot be deleted',
      );
      throw error;
    }
    return { success: true };
  }

  private normalizeValueIds(ids: string[]): string[] {
    return [...new Set(ids)];
  }

  private async requireProduct(context: CompanyContext, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product was not found');
    return product;
  }

  private async requireVariant(
    context: CompanyContext,
    productId: string,
    variantId: string,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Product variant was not found');
    return variant;
  }

  private async requireAttributeValuesInScope(
    context: CompanyContext,
    attributeValueIds: string[],
  ) {
    const count = await this.prisma.variantAttributeValue.count({
      where: {
        id: { in: attributeValueIds },
        attribute: { tenantId: context.tenantId, companyId: context.companyId },
      },
    });
    if (count !== attributeValueIds.length) {
      throw new BadRequestException(
        'One or more attributeValueIds do not refer to a variant attribute value in this company',
      );
    }
  }

  /**
   * Two variants of the same product with the exact same set of attribute
   * values (e.g. two "Red / M" T-Shirts) would be indistinguishable at
   * checkout — no DB constraint can express this (a variable-length join),
   * so it's enforced here by comparing sorted id sets against every other
   * variant already on the product.
   */
  private async requireUniqueCombination(
    context: CompanyContext,
    productId: string,
    attributeValueIds: string[],
    excludeVariantId?: string,
  ) {
    const siblings = await this.prisma.productVariant.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId,
        ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      },
      select: {
        id: true,
        attributeValues: { select: { attributeValueId: true } },
      },
    });

    const target = [...attributeValueIds].sort().join(',');
    const clashes = siblings.some(
      (sibling) =>
        sibling.attributeValues
          .map((v) => v.attributeValueId)
          .sort()
          .join(',') === target,
    );
    if (clashes) {
      throw new ConflictException(
        'A variant with this exact combination of attribute values already exists for this product',
      );
    }
  }

  private throwKnownConflict(error: unknown, message: string): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // P2003 is Prisma's classic FK-violation code; P2039 is what this
      // project's Prisma 7 driver-adapter engine actually raises for a
      // DELETE blocked by an onDelete:Restrict FK (verified live against
      // VariantAttribute — same restrict pattern applies here once Sale/
      // Purchase/Stock start referencing variants in later chunks).
      (error.code === 'P2002' ||
        error.code === 'P2003' ||
        error.code === 'P2039')
    ) {
      throw new ConflictException(message);
    }
  }
}
