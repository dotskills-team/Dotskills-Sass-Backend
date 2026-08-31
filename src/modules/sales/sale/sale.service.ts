import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import {
  CashDrawerSessionStatus,
  CustomerLedgerEntryType,
  SalePaymentMethod,
  SaleStatus,
  StockMovementType,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import {
  CreateSaleDto,
  CreateSaleReturnDto,
  ListSalesQueryDto,
  VoidSaleDto,
} from './dto/sale.dto';

const SALE_SELECT = {
  id: true,
  locationId: true,
  customerId: true,
  processedByUserId: true,
  saleNumber: true,
  status: true,
  saleDate: true,
  subtotal: true,
  itemDiscountTotal: true,
  saleDiscountAmount: true,
  taxAmount: true,
  totalAmount: true,
  voidedAt: true,
  voidReason: true,
  note: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      unitCost: true,
      discountAmount: true,
      subtotal: true,
    },
  },
  payments: {
    select: { id: true, method: true, amount: true },
  },
} satisfies Prisma.SaleSelect;

function roundToNearestUnit(value: number): number {
  return Math.round(value);
}

@Injectable()
export class SaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async list(context: CompanyContext, query: ListSalesQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.SaleWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
    };

    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        select: SALE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      success: true,
      data: sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(context: CompanyContext, id: string) {
    const sale = await this.requireSale(context, id);
    return { success: true, data: sale };
  }

  /**
   * The one atomic checkout action — no DRAFT state, unlike PurchaseOrder.
   * Server computes subtotal/discount/tax/total itself (never trusts a
   * client-submitted total); decreaseStock() is called per line with
   * `allowNegative` read from CompanySettings — this, not a hardcoded
   * false, is the one place that setting is actually meant to apply.
   */
  async create(
    context: CompanyContext,
    dto: CreateSaleDto,
    actor: AuthenticatedUser,
  ) {
    const settings = await this.prisma.companySettings.findUniqueOrThrow({
      where: { companyId: context.companyId },
      select: {
        allowNegativeStock: true,
        enableTax: true,
        defaultTaxRate: true,
        maxCustomerDueLimit: true,
      },
    });

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true, name: true, salePrice: true, costPrice: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      if (!productsById.has(item.productId)) {
        throw new BadRequestException(
          `productId ${item.productId} does not belong to this company`,
        );
      }
    }

    const duePayments = dto.payments.filter(
      (p) => p.method === SalePaymentMethod.DUE,
    );
    if (duePayments.length > 0 && !dto.customerId) {
      throw new BadRequestException(
        'A customerId is required when any payment uses the DUE method',
      );
    }
    let customer: { id: string; dueBalance: Prisma.Decimal } | null = null;
    if (dto.customerId) {
      const found = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
        select: { id: true, dueBalance: true },
      });
      if (!found)
        throw new BadRequestException(
          'customerId does not belong to this company',
        );
      customer = found;
    }

    // --- server-computed money math: item discount -> sale discount -> tax -> round ---
    const lineItems = dto.items.map((item) => {
      const product = productsById.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.salePrice);
      const discountAmount = item.discountAmount ?? 0;
      const lineSubtotal = item.quantity * unitPrice - discountAmount;
      return { item, product, unitPrice, discountAmount, lineSubtotal };
    });

    const subtotal = lineItems.reduce(
      (sum, l) => sum + l.item.quantity * l.unitPrice,
      0,
    );
    const itemDiscountTotal = lineItems.reduce(
      (sum, l) => sum + l.discountAmount,
      0,
    );
    const afterItemDiscounts = subtotal - itemDiscountTotal;
    const saleDiscountAmount = dto.saleDiscountAmount ?? 0;
    const afterSaleDiscount = afterItemDiscounts - saleDiscountAmount;
    const taxAmount = settings.enableTax
      ? afterSaleDiscount * (Number(settings.defaultTaxRate) / 100)
      : 0;
    const totalAmount = roundToNearestUnit(afterSaleDiscount + taxAmount);

    const paymentsTotal = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentsTotal - totalAmount) > 0.01) {
      throw new BadRequestException(
        `Sum of payments (${paymentsTotal}) must equal the computed total (${totalAmount})`,
      );
    }

    const dueAmountThisSale = duePayments.reduce((sum, p) => sum + p.amount, 0);
    const warnings: string[] = [];
    if (
      customer &&
      settings.maxCustomerDueLimit != null &&
      dueAmountThisSale > 0
    ) {
      const projectedDue = Number(customer.dueBalance) + dueAmountThisSale;
      if (projectedDue > Number(settings.maxCustomerDueLimit)) {
        warnings.push('DUE_LIMIT_EXCEEDED');
      }
    }

    let sale;
    try {
      sale = await this.prisma.$transaction(async (tx) => {
        const saleNumber = await this.reserveSaleNumber(tx, context);

        // Attribute this sale to the cashier's currently OPEN cash-drawer
        // session at this exact Location, if one exists — stamped once
        // here rather than reconstructed later from a timestamp window
        // (see Phase 5 plan). Cash-drawer tracking is purely observational:
        // no open session never blocks a sale, it's just left untracked.
        const openSession = await tx.cashDrawerSession.findFirst({
          where: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            locationId: dto.locationId,
            cashierId: actor.userId,
            status: CashDrawerSessionStatus.OPEN,
          },
          select: { id: true },
        });

        const created = await tx.sale.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            locationId: dto.locationId,
            customerId: dto.customerId,
            processedByUserId: actor.userId,
            cashDrawerSessionId: openSession?.id ?? null,
            saleNumber,
            subtotal,
            itemDiscountTotal,
            saleDiscountAmount,
            taxAmount,
            totalAmount,
            note: dto.note?.trim(),
            items: {
              create: lineItems.map((l) => ({
                productId: l.product.id,
                productName: l.product.name,
                quantity: l.item.quantity,
                unitPrice: l.unitPrice,
                unitCost: l.product.costPrice,
                discountAmount: l.discountAmount,
                subtotal: l.lineSubtotal,
              })),
            },
            payments: {
              create: dto.payments.map((p) => ({
                method: p.method,
                amount: p.amount,
              })),
            },
          },
          select: SALE_SELECT,
        });

        for (const l of lineItems) {
          await this.inventoryService.decreaseStock(tx, {
            tenantId: context.tenantId,
            companyId: context.companyId,
            productId: l.product.id,
            locationId: dto.locationId,
            quantity: l.item.quantity,
            movementType: StockMovementType.SALE,
            referenceId: created.id,
            actorUserId: actor.userId,
            unitCost: l.product.costPrice,
            allowNegative: settings.allowNegativeStock,
          });
        }

        if (dueAmountThisSale > 0 && customer) {
          await tx.customerDueLedger.create({
            data: {
              tenantId: context.tenantId,
              companyId: context.companyId,
              customerId: customer.id,
              entryType: CustomerLedgerEntryType.DUE,
              amount: dueAmountThisSale,
              referenceId: created.id,
              actorUserId: actor.userId,
            },
          });
          await tx.customer.update({
            where: { id: customer.id },
            data: { dueBalance: { increment: dueAmountThisSale } },
          });
        }

        await this.createAudit(
          tx,
          context,
          actor.userId,
          'SALE_CREATED',
          created.id,
          null,
          created,
        );
        return created;
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new BadRequestException(
          'INSUFFICIENT_STOCK: not enough stock for one or more items in this sale',
        );
      }
      throw error;
    }

    return { success: true, data: sale, warnings };
  }

  /**
   * Owner/Manager-only (SALE_VOID, kept separate from SALE_CREATE at the
   * permission layer). Restores every line's stock via SALE_VOID_IN (a
   * distinct movement type from SALE_RETURN_IN — see Phase 4 plan for
   * why) and reverses any DUE portion's Customer.dueBalance. Does not
   * model an explicit cash-refund transaction — that belongs to the
   * Cash Drawer phase.
   */
  async void(
    context: CompanyContext,
    id: string,
    dto: VoidSaleDto,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireSale(context, id);
    if (before.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        `Sale cannot be voided from ${before.status} state`,
      );
    }

    const dueAmount = before.payments
      .filter((p) => p.method === SalePaymentMethod.DUE)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const sale = await this.prisma.$transaction(async (tx) => {
      for (const item of before.items) {
        await this.inventoryService.increaseStock(tx, {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId: item.productId,
          locationId: before.locationId,
          quantity: item.quantity,
          movementType: StockMovementType.SALE_VOID_IN,
          referenceId: before.id,
          actorUserId: actor.userId,
          unitCost: item.unitCost,
        });
      }

      if (dueAmount > 0 && before.customerId) {
        await tx.customerDueLedger.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            customerId: before.customerId,
            entryType: CustomerLedgerEntryType.PAYMENT,
            amount: dueAmount,
            referenceId: before.id,
            note: 'Sale voided — due reversed',
            actorUserId: actor.userId,
          },
        });
        await tx.customer.update({
          where: { id: before.customerId },
          data: { dueBalance: { decrement: dueAmount } },
        });
      }

      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: dto.reason.trim(),
          voidedByUserId: actor.userId,
        },
        select: SALE_SELECT,
      });

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'SALE_VOIDED',
        updated.id,
        before,
        updated,
      );
      return updated;
    });

    return { success: true, data: sale };
  }

  /**
   * Mirrors PurchaseOrderService.createReturn(): restores stock
   * (SALE_RETURN_IN), and only touches Customer.dueBalance when a
   * customer is attached (same simplification already accepted for
   * Purchase Returns on cash purchases — a walk-in cash sale's return
   * doesn't touch any ledger).
   */
  async createReturn(
    context: CompanyContext,
    id: string,
    dto: CreateSaleReturnDto,
    actor: AuthenticatedUser,
  ) {
    const sale = await this.requireSale(context, id);
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot return items for a sale in ${sale.status} state`,
      );
    }

    const itemsByProductId = new Map(
      sale.items.map((item) => [item.productId, item]),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const saleReturn = await tx.saleReturn.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          saleId: id,
          reason: dto.reason.trim(),
          refundAmount: dto.refundAmount ?? 0,
          actorUserId: actor.userId,
        },
      });

      for (const line of dto.items) {
        const saleItem = itemsByProductId.get(line.productId);
        if (!saleItem) {
          throw new BadRequestException(
            `productId ${line.productId} was not part of this sale`,
          );
        }
        await this.inventoryService.increaseStock(tx, {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId: line.productId,
          locationId: sale.locationId,
          quantity: line.quantity,
          movementType: StockMovementType.SALE_RETURN_IN,
          referenceId: saleReturn.id,
          actorUserId: actor.userId,
          unitCost: saleItem.unitCost,
        });
      }

      const refundAmount = dto.refundAmount ?? 0;
      if (refundAmount > 0 && sale.customerId) {
        await tx.customerDueLedger.create({
          data: {
            tenantId: context.tenantId,
            companyId: context.companyId,
            customerId: sale.customerId,
            entryType: CustomerLedgerEntryType.PAYMENT,
            amount: refundAmount,
            referenceId: saleReturn.id,
            note: 'Sale return refund',
            actorUserId: actor.userId,
          },
        });
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { dueBalance: { decrement: refundAmount } },
        });
      }

      await this.createAudit(
        tx,
        context,
        actor.userId,
        'SALE_RETURN_CREATED',
        saleReturn.id,
        null,
        saleReturn,
      );
      return saleReturn;
    });

    return { success: true, data: result };
  }

  async listReturns(context: CompanyContext, saleId?: string) {
    const returns = await this.prisma.saleReturn.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        ...(saleId ? { saleId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, count: returns.length, data: returns };
  }

  private async requireSale(context: CompanyContext, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      select: SALE_SELECT,
    });
    if (!sale) throw new NotFoundException('Sale was not found');
    return sale;
  }

  /** Company-scoped sequence, mirrors PurchaseOrderService.reserveOrderNumber() exactly. */
  private async reserveSaleNumber(
    tx: Prisma.TransactionClient,
    context: CompanyContext,
  ): Promise<string> {
    const yearKey = String(new Date().getFullYear());

    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO sale_sequences ("tenantId", "companyId", "yearKey", "lastNumber")
      VALUES (${context.tenantId}::uuid, ${context.companyId}::uuid, ${yearKey}, 1)
      ON CONFLICT ("tenantId", "companyId", "yearKey")
      DO UPDATE SET "lastNumber" = sale_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;

    const lastNumber = rows[0]?.lastNumber;
    if (typeof lastNumber !== 'number') {
      throw new BadRequestException('Failed to reserve sale number');
    }

    return `INV-${yearKey}-${String(lastNumber).padStart(6, '0')}`;
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
        entityType: 'Sale',
        entityId,
        ...(beforeData === null ? {} : { beforeData: beforeData }),
        ...(afterData === null ? {} : { afterData: afterData }),
      },
    });
  }
}
