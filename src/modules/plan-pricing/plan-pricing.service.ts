import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { PlanPriceQueryDto } from './dto/plan-price-query.dto';
import { BillingCycle, Prisma } from 'src/generated/phase-1-prisma/client';

@Injectable()
export class PlanPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(planId: string, dto: CreatePlanPriceDto) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id: planId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Cannot create pricing for an archived plan',
      );
    }

    const currencyCode = dto.currencyCode ?? 'BDT';

    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : new Date();

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    this.validateEffectiveDates(effectiveFrom, effectiveTo);

    const isActive = dto.isActive ?? true;

    if (isActive) {
      await this.ensureNoOverlappingActivePrice({
        planId,
        billingCycle: dto.billingCycle,
        currencyCode,
        effectiveFrom,
        effectiveTo,
      });
    }

    try {
      return await this.prisma.planPrice.create({
        data: {
          planId,
          billingCycle: dto.billingCycle,
          currencyCode,
          amount: new Prisma.Decimal(dto.amount),
          effectiveFrom,
          effectiveTo,
          isActive,
        },
        select: this.priceSelect(),
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(planId: string, query: PlanPriceQueryDto) {
    await this.ensurePlanExists(planId);

    const where: Prisma.PlanPriceWhereInput = {
      planId,

      ...(query.billingCycle
        ? {
            billingCycle: query.billingCycle,
          }
        : {}),

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive === 'true',
          }
        : {}),
    };

    return this.prisma.planPrice.findMany({
      where,
      orderBy: [
        {
          billingCycle: 'asc',
        },
        {
          currencyCode: 'asc',
        },
        {
          effectiveFrom: 'desc',
        },
      ],
      select: this.priceSelect(),
    });
  }

  async findOne(planId: string, priceId: string) {
    const price = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
      select: this.priceSelect(),
    });

    if (!price) {
      throw new NotFoundException('Plan price not found');
    }

    return price;
  }

  async update(planId: string, priceId: string, dto: UpdatePlanPriceDto) {
    const existing = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
      select: {
        id: true,
        planId: true,
        billingCycle: true,
        currencyCode: true,
        amount: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Plan price not found');
    }

    const effectiveFrom =
      dto.effectiveFrom !== undefined
        ? new Date(dto.effectiveFrom)
        : existing.effectiveFrom;

    const effectiveTo =
      dto.effectiveTo !== undefined
        ? new Date(dto.effectiveTo)
        : existing.effectiveTo;

    this.validateEffectiveDates(effectiveFrom, effectiveTo);

    const nextIsActive = dto.isActive ?? existing.isActive;

    if (nextIsActive) {
      await this.ensureNoOverlappingActivePrice({
        planId,
        billingCycle: existing.billingCycle,
        currencyCode: existing.currencyCode,
        effectiveFrom,
        effectiveTo,
        excludePriceId: priceId,
      });
    }

    try {
      return await this.prisma.planPrice.update({
        where: {
          id: priceId,
        },
        data: {
          ...(dto.amount !== undefined
            ? {
                amount: new Prisma.Decimal(dto.amount),
              }
            : {}),

          ...(dto.effectiveFrom !== undefined
            ? {
                effectiveFrom,
              }
            : {}),

          ...(dto.effectiveTo !== undefined
            ? {
                effectiveTo,
              }
            : {}),

          ...(dto.isActive !== undefined
            ? {
                isActive: dto.isActive,
              }
            : {}),
        },
        select: this.priceSelect(),
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async activate(planId: string, priceId: string) {
    const price = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
      select: {
        id: true,
        billingCycle: true,
        currencyCode: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
      },
    });

    if (!price) {
      throw new NotFoundException('Plan price not found');
    }

    if (price.isActive) {
      return this.findOne(planId, priceId);
    }

    await this.ensureNoOverlappingActivePrice({
      planId,
      billingCycle: price.billingCycle,
      currencyCode: price.currencyCode,
      effectiveFrom: price.effectiveFrom,
      effectiveTo: price.effectiveTo,
      excludePriceId: price.id,
    });

    return this.prisma.planPrice.update({
      where: {
        id: priceId,
      },
      data: {
        isActive: true,
      },
      select: this.priceSelect(),
    });
  }

  async deactivate(planId: string, priceId: string) {
    const price = await this.prisma.planPrice.findFirst({
      where: {
        id: priceId,
        planId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!price) {
      throw new NotFoundException('Plan price not found');
    }

    if (!price.isActive) {
      return this.findOne(planId, priceId);
    }

    return this.prisma.planPrice.update({
      where: {
        id: priceId,
      },
      data: {
        isActive: false,
      },
      select: this.priceSelect(),
    });
  }

  private async ensurePlanExists(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id: planId,
      },
      select: {
        id: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  private async ensureNoOverlappingActivePrice(params: {
    planId: string;
    billingCycle: BillingCycle;
    currencyCode: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludePriceId?: string;
  }) {
    const {
      planId,
      billingCycle,
      currencyCode,
      effectiveFrom,
      effectiveTo,
      excludePriceId,
    } = params;

    const upperBound = effectiveTo ?? new Date('9999-12-31T23:59:59.999Z');

    const existing = await this.prisma.planPrice.findFirst({
      where: {
        planId,
        billingCycle,
        currencyCode,
        isActive: true,

        ...(excludePriceId
          ? {
              id: {
                not: excludePriceId,
              },
            }
          : {}),

        effectiveFrom: {
          lt: upperBound,
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gt: effectiveFrom,
            },
          },
        ],
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An active price already exists for this billing cycle and currency during the specified effective period',
      );
    }
  }

  private validateEffectiveDates(
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ) {
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effectiveFrom date');
    }

    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException('Invalid effectiveTo date');
    }

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo must be later than effectiveFrom',
      );
    }
  }

  private priceSelect() {
    return {
      id: true,
      planId: true,
      billingCycle: true,
      currencyCode: true,
      amount: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
      createdAt: true,
    } satisfies Prisma.PlanPriceSelect;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A pricing record with the same unique attributes already exists',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Plan price not found');
      }
    }

    throw error;
  }
}
