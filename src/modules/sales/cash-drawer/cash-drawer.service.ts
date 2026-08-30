import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { CashDrawerSessionStatus, SalePaymentMethod, SaleStatus } from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { CloseCashDrawerSessionDto, OpenCashDrawerSessionDto } from './dto/cash-drawer.dto';

const SESSION_SELECT = {
  id: true,
  locationId: true,
  cashierId: true,
  status: true,
  shiftStart: true,
  shiftEnd: true,
  openingBalance: true,
  expectedClosingBalance: true,
  actualClosingBalance: true,
  variance: true,
  note: true,
  createdAt: true,
} satisfies Prisma.CashDrawerSessionSelect;

/**
 * Per-shift cash reconciliation (design doc Section 8.5). Sale attribution
 * is a direct Sale.cashDrawerSessionId FK stamped at Sale-creation time
 * (see SaleService.create()) — not a query-time timestamp-window filter —
 * so this service never needs to reason about shift boundaries itself,
 * only sum whatever Sales already carry its id.
 */
@Injectable()
export class CashDrawerSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext) {
    const sessions = await this.prisma.cashDrawerSession.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: SESSION_SELECT,
      orderBy: { shiftStart: 'desc' },
    });
    return { success: true, count: sessions.length, data: sessions };
  }

  async findOne(context: CompanyContext, id: string) {
    const session = await this.requireSession(context, id);
    return { success: true, data: session };
  }

  /**
   * openingBalance is only ever taken from the client when this is the
   * cashier's very first session at this Location — otherwise it's always
   * derived server-side from the previous CLOSED session's
   * actualClosingBalance (design doc: "আগের session-এর closingBalance-ই
   * নতুন session-এর openingBalance হবে"), matching this codebase's
   * standing rule that a derivable financial value is never trusted from
   * the client (same as Sale.totalAmount).
   */
  async openSession(context: CompanyContext, dto: OpenCashDrawerSessionDto, actor: AuthenticatedUser) {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId: context.tenantId, companyId: context.companyId },
      select: { id: true },
    });
    if (!location) throw new BadRequestException('locationId does not belong to this company');

    const previousClosed = await this.prisma.cashDrawerSession.findFirst({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        locationId: dto.locationId,
        cashierId: actor.userId,
        status: CashDrawerSessionStatus.CLOSED,
      },
      orderBy: { shiftEnd: 'desc' },
      select: { actualClosingBalance: true },
    });

    let openingBalance: number;
    if (previousClosed) {
      openingBalance = Number(previousClosed.actualClosingBalance);
    } else {
      if (dto.openingBalance === undefined) {
        throw new BadRequestException('openingBalance is required for this cashier\'s first session at this location');
      }
      openingBalance = dto.openingBalance;
    }

    try {
      const session = await this.prisma.$transaction(async (tx) => {
        const created = await tx.cashDrawerSession.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            locationId: dto.locationId,
            cashierId: actor.userId,
            openingBalance,
          },
          select: SESSION_SELECT,
        });

        await this.createAudit(tx, context, actor.userId, 'CASH_DRAWER_SESSION_OPENED', created.id, null, created);
        return created;
      });

      return { success: true, data: session };
    } catch (error) {
      this.throwKnownConflict(error, 'An open cash drawer session already exists for this cashier');
      throw error;
    }
  }

  /**
   * Never rejects on a non-zero variance (design decision #3) — it only
   * computes and records it. Return refunds are deliberately NOT
   * subtracted from the cash total this phase (no refundMethod field
   * exists on SaleReturn) — a cash refund during an open session will
   * correctly show up as variance, which is Day-Close doing its job.
   */
  async closeSession(context: CompanyContext, id: string, dto: CloseCashDrawerSessionDto, actor: AuthenticatedUser) {
    const before = await this.requireSession(context, id);
    if (before.status !== CashDrawerSessionStatus.OPEN) {
      throw new BadRequestException(`Cannot close a session with status ${before.status}`);
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const cashTotal = await tx.salePayment.aggregate({
        where: {
          method: SalePaymentMethod.CASH,
          sale: { cashDrawerSessionId: id, status: SaleStatus.COMPLETED },
        },
        _sum: { amount: true },
      });
      const cashSalesTotal = Number(cashTotal._sum.amount ?? 0);
      const expectedClosingBalance = Number(before.openingBalance) + cashSalesTotal;
      const variance = dto.actualClosingBalance - expectedClosingBalance;

      const updated = await tx.cashDrawerSession.update({
        where: { id },
        data: {
          status: CashDrawerSessionStatus.CLOSED,
          shiftEnd: new Date(),
          expectedClosingBalance,
          actualClosingBalance: dto.actualClosingBalance,
          variance,
          note: dto.note?.trim(),
        },
        select: SESSION_SELECT,
      });

      await this.createAudit(tx, context, actor.userId, 'CASH_DRAWER_SESSION_CLOSED', updated.id, before, {
        ...updated,
        cashSalesTotal,
      });
      return updated;
    });

    return { success: true, data: session };
  }

  private async requireSession(context: CompanyContext, id: string) {
    const session = await this.prisma.cashDrawerSession.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: SESSION_SELECT,
    });
    if (!session) throw new NotFoundException('Cash drawer session was not found');
    return session;
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
        entityType: 'CashDrawerSession',
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
