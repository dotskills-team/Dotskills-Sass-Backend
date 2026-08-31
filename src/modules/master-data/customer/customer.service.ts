import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  customerType: true,
  dueBalance: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: CUSTOMER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: customers.length, data: customers };
  }

  async findOne(context: CompanyContext, id: string) {
    const customer = await this.requireCustomer(context, id);
    return { success: true, data: customer };
  }

  async create(
    context: CompanyContext,
    dto: CreateCustomerDto,
    actor: AuthenticatedUser,
  ) {
    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            name: dto.name.trim(),
            phone: dto.phone?.trim() || undefined,
            email: dto.email?.trim(),
            address: dto.address?.trim(),
            customerType: dto.customerType ?? 'RETAIL',
          },
          select: CUSTOMER_SELECT,
        });
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'CUSTOMER_CREATED',
          created.id,
          null,
          created,
        );
        return created;
      });
      return { success: true, data: customer };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A customer with this phone number already exists in this company',
      );
      throw error;
    }
  }

  async update(
    context: CompanyContext,
    id: string,
    dto: UpdateCustomerDto,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireCustomer(context, id);
    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.phone !== undefined
              ? { phone: dto.phone.trim() || null }
              : {}),
            ...(dto.email !== undefined
              ? { email: dto.email.trim() || null }
              : {}),
            ...(dto.address !== undefined
              ? { address: dto.address.trim() || null }
              : {}),
            ...(dto.customerType !== undefined
              ? { customerType: dto.customerType }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
          select: CUSTOMER_SELECT,
        });
        await this.createAudit(
          tx,
          context,
          actor.userId,
          'CUSTOMER_UPDATED',
          updated.id,
          before,
          updated,
        );
        return updated;
      });
      return { success: true, data: customer };
    } catch (error) {
      this.throwKnownConflict(
        error,
        'A customer with this phone number already exists in this company',
      );
      throw error;
    }
  }

  private async requireCustomer(context: CompanyContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: CUSTOMER_SELECT,
    });
    if (!customer) throw new NotFoundException('Customer was not found');
    return customer;
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
        entityType: 'Customer',
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
