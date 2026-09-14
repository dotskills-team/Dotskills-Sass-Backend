import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import {
  AddVariantAttributeValueDto,
  CreateVariantAttributeDto,
} from './dto/variant-attribute.dto';

const ATTRIBUTE_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  values: { select: { id: true, value: true }, orderBy: { value: 'asc' } },
} satisfies Prisma.VariantAttributeSelect;

@Injectable()
export class VariantAttributeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const attributes = await this.prisma.variantAttribute.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: ATTRIBUTE_SELECT,
      orderBy: { name: 'asc' },
    });
    return { success: true, data: attributes };
  }

  async create(context: CompanyContext, dto: CreateVariantAttributeDto) {
    try {
      const attribute = await this.prisma.variantAttribute.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          name: dto.name.trim(),
          values: {
            create: dto.values.map((value) => ({ value: value.trim() })),
          },
        },
        select: ATTRIBUTE_SELECT,
      });
      return { success: true, data: attribute };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'An attribute with this name (or one of its values) already exists',
      );
      throw error;
    }
  }

  async addValue(
    context: CompanyContext,
    attributeId: string,
    dto: AddVariantAttributeValueDto,
  ) {
    await this.requireAttribute(context, attributeId);
    try {
      const value = await this.prisma.variantAttributeValue.create({
        data: { attributeId, value: dto.value.trim() },
        select: { id: true, value: true },
      });
      return { success: true, data: value };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'This value already exists for the attribute',
      );
      throw error;
    }
  }

  async removeValue(
    context: CompanyContext,
    attributeId: string,
    valueId: string,
  ) {
    await this.requireAttribute(context, attributeId);
    const value = await this.prisma.variantAttributeValue.findFirst({
      where: { id: valueId, attributeId },
      select: { id: true },
    });
    if (!value) throw new NotFoundException('Attribute value was not found');

    try {
      await this.prisma.variantAttributeValue.delete({
        where: { id: valueId },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        'This value is used by an existing product variant and cannot be removed',
      );
      throw error;
    }
    return { success: true };
  }

  async remove(context: CompanyContext, attributeId: string) {
    await this.requireAttribute(context, attributeId);
    try {
      await this.prisma.variantAttribute.delete({ where: { id: attributeId } });
    } catch (error) {
      this.throwKnownConflict(
        error,
        'This attribute has values used by an existing product variant and cannot be removed',
      );
      throw error;
    }
    return { success: true };
  }

  private async requireAttribute(context: CompanyContext, id: string) {
    const attribute = await this.prisma.variantAttribute.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true },
    });
    if (!attribute)
      throw new NotFoundException('Variant attribute was not found');
    return attribute;
  }

  private throwKnownConflict(error: unknown, message: string): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // P2003 is Prisma's classic FK-violation code; P2039 is what this
      // project's Prisma 7 driver-adapter engine actually raises for a
      // DELETE blocked by an onDelete:Restrict FK (verified live — a raw
      // Postgres 23001 "violates RESTRICT setting" wrapped as P2039, not
      // P2003). Catch both so a real restrict violation never surfaces as
      // an uncaught 500.
      (error.code === 'P2002' ||
        error.code === 'P2003' ||
        error.code === 'P2039')
    ) {
      throw new ConflictException(message);
    }
  }
}
