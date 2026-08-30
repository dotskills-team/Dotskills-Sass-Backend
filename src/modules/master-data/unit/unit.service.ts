import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

const UNIT_SELECT = {
  id: true,
  name: true,
  code: true,
  baseUnitId: true,
  conversionFactor: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UnitSelect;

@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const units = await this.prisma.unit.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: UNIT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: units.length, data: units };
  }

  async findOne(context: CompanyContext, id: string) {
    const unit = await this.requireUnit(context, id);
    return { success: true, data: unit };
  }

  async create(context: CompanyContext, dto: CreateUnitDto, actor: AuthenticatedUser) {
    if (dto.baseUnitId) await this.requireUnit(context, dto.baseUnitId);

    try {
      const unit = await this.prisma.$transaction(async (tx) => {
        const created = await tx.unit.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            baseUnitId: dto.baseUnitId,
            conversionFactor: dto.conversionFactor,
          },
          select: UNIT_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'UNIT_CREATED', created.id, null, created);
        return created;
      });
      return { success: true, data: unit };
    } catch (error) {
      this.throwKnownConflict(error, 'A unit with this code already exists in this company');
      throw error;
    }
  }

  async update(context: CompanyContext, id: string, dto: UpdateUnitDto, actor: AuthenticatedUser) {
    const before = await this.requireUnit(context, id);

    if (dto.baseUnitId !== undefined) {
      if (dto.baseUnitId === id) {
        throw new BadRequestException('A unit cannot be its own base unit');
      }
      if (dto.baseUnitId) await this.requireUnit(context, dto.baseUnitId);
    }

    try {
      const unit = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.unit.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.baseUnitId !== undefined ? { baseUnitId: dto.baseUnitId || null } : {}),
            ...(dto.conversionFactor !== undefined ? { conversionFactor: dto.conversionFactor } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: UNIT_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'UNIT_UPDATED', updated.id, before, updated);
        return updated;
      });
      return { success: true, data: unit };
    } catch (error) {
      this.throwKnownConflict(error, 'A unit with this code already exists in this company');
      throw error;
    }
  }

  private async requireUnit(context: CompanyContext, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: UNIT_SELECT,
    });
    if (!unit) throw new NotFoundException('Unit was not found');
    return unit;
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
        entityType: 'Unit',
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
