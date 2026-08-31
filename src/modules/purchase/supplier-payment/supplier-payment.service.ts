import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { SupplierLedgerEntryType } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { RecordSupplierPaymentDto } from './dto/supplier-payment.dto';

@Injectable()
export class SupplierPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext, supplierId?: string) {
    const entries = await this.prisma.supplierPayableLedger.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        ...(supplierId ? { supplierId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: entries.length, data: entries };
  }

  async recordPayment(
    context: CompanyContext,
    dto: RecordSupplierPaymentDto,
    actor: AuthenticatedUser,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Supplier was not found');

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierPayableLedger.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          supplierId: dto.supplierId,
          entryType: SupplierLedgerEntryType.PAYMENT,
          amount: dto.amount,
          note: dto.note?.trim(),
          actorUserId: actor.userId,
        },
      });

      await tx.supplier.update({
        where: { id: dto.supplierId },
        data: { payableBalance: { decrement: dto.amount } },
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          actorUserId: actor.userId,
          actorType: 'COMPANY_MEMBER',
          action: 'SUPPLIER_PAYMENT_RECORDED',
          entityType: 'SupplierPayableLedger',
          entityId: created.id,
          afterData: created,
        },
      });

      return created;
    });

    return { success: true, data: entry };
  }
}
