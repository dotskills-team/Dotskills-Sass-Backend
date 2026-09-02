import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import {
  PurchaseOrderStatus,
  StockMovementType,
  SupplierLedgerEntryType,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { ProductCostingService } from '../../master-data/product/product-costing.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import {
  CreatePurchaseOrderDto,
  ListPurchaseOrdersQueryDto,
  ReceiveGoodsDto,
  ReturnGoodsDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';

const PO_SELECT = {
  id: true,
  supplierId: true,
  locationId: true,
  orderNumber: true,
  status: true,
  orderDate: true,
  totalAmount: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      orderedQty: true,
      receivedQty: true,
      unitCost: true,
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly costingService: ProductCostingService,
    private readonly locationAccessService: LocationAccessService,
  ) {}

  async list(context: CompanyContext, query: ListPurchaseOrdersQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        select: PO_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      success: true,
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(context: CompanyContext, id: string) {
    const order = await this.requireOrder(context, id);
    return { success: true, data: order };
  }

  async create(
    context: CompanyContext,
    dto: CreatePurchaseOrderDto,
    actor: AuthenticatedUser,
  ) {
    await this.locationAccessService.assertHasLocationAccess(
      context,
      dto.locationId,
    );

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.orderedQty * item.unitCost,
      0,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.reserveOrderNumber(tx, context);

      const created = await tx.purchaseOrder.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          orderNumber,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          totalAmount,
          note: dto.note?.trim(),
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              orderedQty: item.orderedQty,
              unitCost: item.unitCost,
            })),
          },
        },
        select: PO_SELECT,
      });

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'PURCHASE_ORDER_CREATED',
        created.id,
        null,
        created,
      );
      return created;
    });

    return { success: true, data: order };
  }

  async update(
    context: CompanyContext,
    id: string,
    dto: UpdatePurchaseOrderDto,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireOrder(context, id);
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only a DRAFT purchase order can be edited — once any goods have been received it is immutable, correct it with a Purchase Return instead',
      );
    }

    const totalAmount = dto.items
      ? dto.items.reduce(
          (sum, item) => sum + item.orderedQty * item.unitCost,
          0,
        )
      : undefined;

    const order = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.locationId !== undefined
            ? { locationId: dto.locationId }
            : {}),
          ...(dto.orderDate !== undefined
            ? { orderDate: new Date(dto.orderDate) }
            : {}),
          ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
          ...(totalAmount !== undefined ? { totalAmount } : {}),
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item) => ({
                    productId: item.productId,
                    orderedQty: item.orderedQty,
                    unitCost: item.unitCost,
                  })),
                },
              }
            : {}),
        },
        select: PO_SELECT,
      });

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'PURCHASE_ORDER_UPDATED',
        updated.id,
        before,
        updated,
      );
      return updated;
    });

    return { success: true, data: order };
  }

  async cancel(context: CompanyContext, id: string, actor: AuthenticatedUser) {
    const before = await this.requireOrder(context, id);
    if (before.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only a DRAFT purchase order can be cancelled — once any goods have been received it cannot be undone',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CANCELLED },
        select: PO_SELECT,
      });
      await this.createAudit(
        tx,
        context,
        actor.userId,
        'PURCHASE_ORDER_CANCELLED',
        updated.id,
        before,
        updated,
      );
      return updated;
    });

    return { success: true, data: order };
  }

  /**
   * The core receiving action — for each line, increases the destination
   * Location's Inventory, recomputes the Product's weighted-average cost,
   * and adds a SupplierPayableLedger PAYABLE entry, all in one transaction
   * so Inventory/StockMovement/Product.costPrice/PurchaseOrderItem.receivedQty/
   * Supplier.payableBalance never drift apart from each other.
   */
  async receive(
    context: CompanyContext,
    id: string,
    dto: ReceiveGoodsDto,
    actor: AuthenticatedUser,
  ) {
    const order = await this.requireOrder(context, id);
    await this.locationAccessService.assertHasLocationAccess(
      context,
      order.locationId,
    );
    if (order.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot receive goods against a cancelled purchase order',
      );
    }

    const itemsById = new Map(order.items.map((item) => [item.id, item]));
    for (const line of dto.items) {
      const orderItem = itemsById.get(line.purchaseOrderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `purchaseOrderItemId ${line.purchaseOrderItemId} does not belong to this purchase order`,
        );
      }
      const wouldBeReceived = Number(orderItem.receivedQty) + line.receivedQty;
      if (wouldBeReceived > Number(orderItem.orderedQty) + 1e-9) {
        throw new BadRequestException(
          `Cannot receive more than ordered for product ${orderItem.productId} (ordered ${orderItem.orderedQty}, already received ${orderItem.receivedQty})`,
        );
      }
    }

    const receiptTotal = dto.items.reduce((sum, line) => {
      const orderItem = itemsById.get(line.purchaseOrderItemId)!;
      return sum + line.receivedQty * Number(orderItem.unitCost);
    }, 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          purchaseOrderId: id,
          receivedDate: dto.receivedDate
            ? new Date(dto.receivedDate)
            : undefined,
          billImageUrl: dto.billImageUrl,
          actorUserId: actor.userId,
        },
      });

      for (const line of dto.items) {
        const orderItem = itemsById.get(line.purchaseOrderItemId)!;

        await this.costingService.applyPurchaseCost(
          tx,
          context,
          orderItem.productId,
          line.receivedQty,
          orderItem.unitCost,
        );

        await this.inventoryService.increaseStock(tx, {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId: orderItem.productId,
          locationId: order.locationId,
          quantity: line.receivedQty,
          movementType: StockMovementType.PURCHASE,
          referenceId: receipt.id,
          actorUserId: actor.userId,
          unitCost: orderItem.unitCost,
        });

        await tx.purchaseOrderItem.update({
          where: { id: orderItem.id },
          data: { receivedQty: { increment: line.receivedQty } },
        });
      }

      if (receiptTotal > 0) {
        await tx.supplierPayableLedger.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            supplierId: order.supplierId,
            entryType: SupplierLedgerEntryType.PAYABLE,
            amount: receiptTotal,
            referenceId: receipt.id,
            actorUserId: actor.userId,
          },
        });
        await tx.supplier.update({
          where: { id: order.supplierId },
          data: { payableBalance: { increment: receiptTotal } },
        });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { orderedQty: true, receivedQty: true },
      });
      const fullyReceived = refreshedItems.every(
        (item) => Number(item.receivedQty) >= Number(item.orderedQty) - 1e-9,
      );

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: fullyReceived
            ? PurchaseOrderStatus.FULLY_RECEIVED
            : PurchaseOrderStatus.PARTIALLY_RECEIVED,
        },
        select: PO_SELECT,
      });

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'PURCHASE_ORDER_RECEIVED',
        receipt.id,
        null,
        { receiptId: receipt.id, purchaseOrderId: id, items: dto.items },
      );

      return { order: updatedOrder, receipt };
    });

    return { success: true, data: result };
  }

  /**
   * Returns goods to the supplier — decrements stock (never below zero;
   * a PurchaseReturn represents physically handing back goods you
   * currently hold, so it always requires the stock to actually be
   * there, same reasoning as StockTransfer). Does not re-run the
   * weighted-average calculation backward — matches standard accounting
   * practice of not "un-averaging" a cost after the fact.
   */
  async createReturn(
    context: CompanyContext,
    id: string,
    dto: ReturnGoodsDto,
    actor: AuthenticatedUser,
  ) {
    const order = await this.requireOrder(context, id);
    await this.locationAccessService.assertHasLocationAccess(
      context,
      order.locationId,
    );
    if (
      order.status === PurchaseOrderStatus.DRAFT ||
      order.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot return goods for a purchase order that has never been received',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          purchaseOrderId: id,
          reason: dto.reason.trim(),
          refundAmount: dto.refundAmount ?? 0,
          actorUserId: actor.userId,
        },
      });

      for (const line of dto.items) {
        try {
          await this.inventoryService.decreaseStock(tx, {
            tenantId: context.tenantId,
            companyId: context.companyId,
            productId: line.productId,
            locationId: order.locationId,
            quantity: line.quantity,
            movementType: StockMovementType.PURCHASE_RETURN_OUT,
            referenceId: purchaseReturn.id,
            actorUserId: actor.userId,
            allowNegative: false,
          });
        } catch (error) {
          if (error instanceof ConflictException) {
            throw new BadRequestException(
              `INSUFFICIENT_STOCK: not enough stock of product ${line.productId} at this location to return`,
            );
          }
          throw error;
        }
      }

      const refundAmount = dto.refundAmount ?? 0;
      if (refundAmount > 0) {
        await tx.supplierPayableLedger.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            supplierId: order.supplierId,
            entryType: SupplierLedgerEntryType.PAYMENT,
            amount: refundAmount,
            referenceId: purchaseReturn.id,
            note: 'Purchase return refund',
            actorUserId: actor.userId,
          },
        });
        await tx.supplier.update({
          where: { id: order.supplierId },
          data: { payableBalance: { decrement: refundAmount } },
        });
      }

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'PURCHASE_RETURN_CREATED',
        purchaseReturn.id,
        null,
        purchaseReturn,
      );
      return purchaseReturn;
    });

    return { success: true, data: result };
  }

  async listReturns(context: CompanyContext, purchaseOrderId?: string) {
    const returns = await this.prisma.purchaseReturn.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        ...(purchaseOrderId ? { purchaseOrderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: returns.length, data: returns };
  }

  private async requireOrder(context: CompanyContext, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: PO_SELECT,
    });
    if (!order) throw new NotFoundException('Purchase order was not found');
    return order;
  }

  /**
   * Company-scoped sequence — see PurchaseOrderSequence's own schema
   * comment for why this isn't the global InvoiceSequence pattern.
   */
  private async reserveOrderNumber(
    tx: Prisma.TransactionClient,
    context: CompanyContext,
  ): Promise<string> {
    const yearKey = String(new Date().getFullYear());

    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO purchase_order_sequences ("tenantId", "companyId", "yearKey", "lastNumber")
      VALUES (${context.tenantId}::uuid, ${context.companyId}::uuid, ${yearKey}, 1)
      ON CONFLICT ("tenantId", "companyId", "yearKey")
      DO UPDATE SET "lastNumber" = purchase_order_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;

    const lastNumber = rows[0]?.lastNumber;
    if (typeof lastNumber !== 'number') {
      throw new BadRequestException('Failed to reserve purchase order number');
    }

    return `PO-${yearKey}-${String(lastNumber).padStart(6, '0')}`;
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
        entityType: 'PurchaseOrder',
        entityId,
        ...(beforeData === null ? {} : { beforeData: beforeData }),
        ...(afterData === null ? {} : { afterData: afterData }),
      },
    });
  }
}
