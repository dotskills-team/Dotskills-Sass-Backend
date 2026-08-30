import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

const LOCATION_SELECT = {
  id: true,
  name: true,
  locationType: true,
  address: true,
  isSalesEnabled: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LocationSelect;

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const locations = await this.prisma.location.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: LOCATION_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: locations.length, data: locations };
  }

  async findOne(context: CompanyContext, id: string) {
    const location = await this.requireLocation(context, id);
    return { success: true, data: location };
  }

  async create(context: CompanyContext, dto: CreateLocationDto, actor: AuthenticatedUser) {
    try {
      const location = await this.prisma.$transaction(async (tx) => {
        const created = await tx.location.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            name: dto.name.trim(),
            locationType: dto.locationType,
            address: dto.address?.trim(),
            isSalesEnabled: dto.isSalesEnabled ?? true,
          },
          select: LOCATION_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'LOCATION_CREATED', created.id, null, created);
        return created;
      });
      return { success: true, data: location };
    } catch (error) {
      this.throwKnownConflict(error, 'A location with this name already exists in this company');
      throw error;
    }
  }

  async update(context: CompanyContext, id: string, dto: UpdateLocationDto, actor: AuthenticatedUser) {
    const before = await this.requireLocation(context, id);
    try {
      const location = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.location.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
            ...(dto.isSalesEnabled !== undefined ? { isSalesEnabled: dto.isSalesEnabled } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: LOCATION_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'LOCATION_UPDATED', updated.id, before, updated);
        return updated;
      });
      return { success: true, data: location };
    } catch (error) {
      this.throwKnownConflict(error, 'A location with this name already exists in this company');
      throw error;
    }
  }

  private async requireLocation(context: CompanyContext, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: LOCATION_SELECT,
    });
    if (!location) throw new NotFoundException('Location was not found');
    return location;
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
        entityType: 'Location',
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
