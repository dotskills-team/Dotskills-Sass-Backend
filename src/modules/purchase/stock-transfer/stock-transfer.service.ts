import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import {
  StockMovementType,
  StockTransferStatus,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import {
  CreateStockTransferDto,
  ListStockTransfersQueryDto,
} from './dto/stock-transfer.dto';

const TRANSFER_SELECT = {
  id: true,
  fromLocationId: true,
  toLocationId: true,
  productId: true,
  quantity: true,
  status: true,
  dispatchedAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StockTransferSelect;

/**
 * The 3-action lifecycle (create -> dispatch -> receive) mirrors real
 * "goods in transit" accounting: stock leaves the source at dispatch,
 * but doesn't land in the destination until receive — during IN_TRANSIT
 * it is deliberately counted at neither location. allowNegative is
 * always false for a transfer (never resolved from CompanySettings) —
 * an internal stock move should never claim to move stock that isn't
 * physically at the source.
 */
@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async list(context: CompanyContext, query: ListStockTransfersQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.StockTransferWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
    };

    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        select: TRANSFER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      success: true,
      data: transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(context: CompanyContext, id: string) {
    const transfer = await this.requireTransfer(context, id);
    return { success: true, data: transfer };
  }

  async create(
    context: CompanyContext,
    dto: CreateStockTransferDto,
    actor: AuthenticatedUser,
  ) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException(
        'fromLocationId and toLocationId must be different locations',
      );
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          productId: dto.productId,
          quantity: dto.quantity,
          actorUserId: actor.userId,
        },
        select: TRANSFER_SELECT,
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'STOCK_TRANSFER_CREATED',
        created.id,
        null,
        created,
      );
      return created;
    });

    return { success: true, data: transfer };
  }

  async dispatch(
    context: CompanyContext,
    id: string,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireTransfer(context, id);
    if (before.status !== StockTransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer cannot be dispatched from ${before.status} state`,
      );
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.inventoryService.decreaseStock(tx, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId: before.productId,
        locationId: before.fromLocationId,
        quantity: before.quantity,
        movementType: StockMovementType.TRANSFER_OUT,
        referenceId: id,
        actorUserId: actor.userId,
        allowNegative: false,
      });

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
          dispatchedAt: new Date(),
        },
        select: TRANSFER_SELECT,
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'STOCK_TRANSFER_DISPATCHED',
        updated.id,
        before,
        updated,
      );
      return updated;
    });

    return { success: true, data: transfer };
  }

  async receive(context: CompanyContext, id: string, actor: AuthenticatedUser) {
    const before = await this.requireTransfer(context, id);
    if (before.status !== StockTransferStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Transfer cannot be received from ${before.status} state`,
      );
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      await this.inventoryService.increaseStock(tx, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        productId: before.productId,
        locationId: before.toLocationId,
        quantity: before.quantity,
        movementType: StockMovementType.TRANSFER_IN,
        referenceId: id,
        actorUserId: actor.userId,
      });

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.RECEIVED, receivedAt: new Date() },
        select: TRANSFER_SELECT,
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'STOCK_TRANSFER_RECEIVED',
        updated.id,
        before,
        updated,
      );
      return updated;
    });

    return { success: true, data: transfer };
  }

  private async requireTransfer(context: CompanyContext, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: TRANSFER_SELECT,
    });
    if (!transfer) throw new NotFoundException('Stock transfer was not found');
    return transfer;
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
        entityType: 'StockTransfer',
        entityId,
        ...(beforeData === null ? {} : { beforeData: beforeData }),
        ...(afterData === null ? {} : { afterData: afterData }),
      },
    });
  }
}
