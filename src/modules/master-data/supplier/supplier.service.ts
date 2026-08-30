import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

const SUPPLIER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  payableBalance: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: SUPPLIER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: suppliers.length, data: suppliers };
  }

  async findOne(context: CompanyContext, id: string) {
    const supplier = await this.requireSupplier(context, id);
    return { success: true, data: supplier };
  }

  async create(context: CompanyContext, dto: CreateSupplierDto, actor: AuthenticatedUser) {
    try {
      const supplier = await this.prisma.$transaction(async (tx) => {
        const created = await tx.supplier.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            name: dto.name.trim(),
            phone: dto.phone?.trim() || undefined,
            email: dto.email?.trim(),
            address: dto.address?.trim(),
          },
          select: SUPPLIER_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'SUPPLIER_CREATED', created.id, null, created);
        return created;
      });
      return { success: true, data: supplier };
    } catch (error) {
      this.throwKnownConflict(error, 'A supplier with this phone number already exists in this company');
      throw error;
    }
  }

  async update(context: CompanyContext, id: string, dto: UpdateSupplierDto, actor: AuthenticatedUser) {
    const before = await this.requireSupplier(context, id);
    try {
      const supplier = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.supplier.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
            ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
            ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: SUPPLIER_SELECT,
        });
        await this.createAudit(tx, context, actor.userId, 'SUPPLIER_UPDATED', updated.id, before, updated);
        return updated;
      });
      return { success: true, data: supplier };
    } catch (error) {
      this.throwKnownConflict(error, 'A supplier with this phone number already exists in this company');
      throw error;
    }
  }

  private async requireSupplier(context: CompanyContext, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: SUPPLIER_SELECT,
    });
    if (!supplier) throw new NotFoundException('Supplier was not found');
    return supplier;
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
        entityType: 'Supplier',
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
