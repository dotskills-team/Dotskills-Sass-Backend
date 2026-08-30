import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { CustomerLedgerEntryType } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { RecordCustomerPaymentDto } from './dto/customer-payment.dto';

/** Mirrors SupplierPaymentService exactly. */
@Injectable()
export class CustomerPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext, customerId?: string) {
    const entries = await this.prisma.customerDueLedger.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: entries.length, data: entries };
  }

  async recordPayment(context: CompanyContext, dto: RecordCustomerPaymentDto, actor: AuthenticatedUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer was not found');

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerDueLedger.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          customerId: dto.customerId,
          entryType: CustomerLedgerEntryType.PAYMENT,
          amount: dto.amount,
          note: dto.note?.trim(),
          actorUserId: actor.userId,
        },
      });

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { dueBalance: { decrement: dto.amount } },
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          actorUserId: actor.userId,
          actorType: 'COMPANY_MEMBER',
          action: 'CUSTOMER_PAYMENT_RECORDED',
          entityType: 'CustomerDueLedger',
          entityId: created.id,
          afterData: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return { success: true, data: entry };
  }
}
