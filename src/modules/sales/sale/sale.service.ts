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
  NotificationType,
  NotificationRelatedEntityType,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocationAccessService } from '../../../common/services/location-access.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { UnitConversionService } from '../../master-data/unit/unit-conversion.service';
import { NotificationService } from '../../notification/notification.service';
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
      variantId: true,
      unitId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      unitCost: true,
      discountAmount: true,
      subtotal: true,
      serialNote: true,
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
    private readonly unitConversionService: UnitConversionService,
    private readonly locationAccessService: LocationAccessService,
    private readonly notificationService: NotificationService,
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
    await this.locationAccessService.assertHasLocationAccess(
      context,
      dto.locationId,
    );

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
      select: {
        id: true,
        name: true,
        salePrice: true,
        costPrice: true,
        hasVariants: true,
        baseUnitId: true,
      },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));
    // Resolved once here (fail-fast, before any DB write) and reused
    // below when building lineItems — Decimal(1) for every pre-existing,
    // non-conversion line (unitId omitted), so this is a no-op for every
    // sale that doesn't use it.
    const unitFactors: Prisma.Decimal[] = [];
    for (const item of dto.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new BadRequestException(
          `productId ${item.productId} does not belong to this company`,
        );
      }
      if (product.hasVariants && !item.variantId) {
        throw new BadRequestException(
          `variantId is required for product ${item.productId} — it has variants`,
        );
      }
      if (!product.hasVariants && item.variantId) {
        throw new BadRequestException(
          `product ${item.productId} has no variants — omit variantId`,
        );
      }
      unitFactors.push(
        await this.unitConversionService.resolveFactor(
          context,
          product.baseUnitId,
          item.unitId,
        ),
      );
    }

    const variantIds = dto.items
      .map((item) => item.variantId)
      .filter((v): v is string => !!v);
    const variantsById = new Map<
      string,
      {
        id: string;
        productId: string;
        salePrice: Prisma.Decimal;
        costPrice: Prisma.Decimal;
      }
    >();
    if (variantIds.length > 0) {
      const variants = await this.prisma.productVariant.findMany({
        where: {
          id: { in: [...new Set(variantIds)] },
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
        select: { id: true, productId: true, salePrice: true, costPrice: true },
      });
      for (const v of variants) variantsById.set(v.id, v);
      for (const item of dto.items) {
        if (!item.variantId) continue;
        const variant = variantsById.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          throw new BadRequestException(
            `variantId ${item.variantId} does not belong to product ${item.productId} in this company`,
          );
        }
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
    let customer: {
      id: string;
      name: string;
      dueBalance: Prisma.Decimal;
    } | null = null;
    if (dto.customerId) {
      const found = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          tenantId: context.tenantId,
          companyId: context.companyId,
        },
        select: { id: true, name: true, dueBalance: true },
      });
      if (!found)
        throw new BadRequestException(
          'customerId does not belong to this company',
        );
      customer = found;
    }

    // --- server-computed money math: item discount -> sale discount -> tax -> round ---
    // `unitCost`/the default `unitPrice` are scaled to the LINE'S OWN
    // entered unit (factor 1 = unchanged from today) — quantity * unitPrice
    // must stay internally consistent for revenue/COGS math (a Carton's
    // price is the whole carton's price, not one piece's), exactly
    // mirroring how PurchaseOrderItem.unitCost stays in its own entered
    // unit rather than being pre-converted to the base unit.
    const lineItems = dto.items.map((item, index) => {
      const product = productsById.get(item.productId)!;
      const variant = item.variantId
        ? variantsById.get(item.variantId)
        : undefined;
      const factor = unitFactors[index];
      const baseSalePrice = variant ? variant.salePrice : product.salePrice;
      const baseCostPrice = variant ? variant.costPrice : product.costPrice;
      const enteredUnitCost = baseCostPrice.times(factor);
      const defaultUnitPrice = Number(baseSalePrice.times(factor));
      const unitPrice = item.unitPrice ?? defaultUnitPrice;
      const discountAmount = item.discountAmount ?? 0;
      const lineSubtotal = item.quantity * unitPrice - discountAmount;
      return {
        item,
        product,
        variantId: item.variantId,
        factor,
        baseCostPrice,
        unitCost: enteredUnitCost,
        unitPrice,
        discountAmount,
        lineSubtotal,
      };
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
                variantId: l.variantId,
                unitId: l.item.unitId,
                productName: l.product.name,
                quantity: l.item.quantity,
                unitPrice: l.unitPrice,
                unitCost: l.unitCost,
                discountAmount: l.discountAmount,
                subtotal: l.lineSubtotal,
                serialNote: l.item.serialNote?.trim() || undefined,
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
          // Conversion boundary — Inventory always operates in the
          // Product's base unit, regardless of which unit this line was
          // actually sold in. `baseCostPrice` (not `l.unitCost`, which is
          // scaled to the line's own entered unit) is the correct
          // per-base-unit cost for StockMovement.
          await this.inventoryService.decreaseStock(tx, {
            tenantId: context.tenantId,
            companyId: context.companyId,
            productId: l.product.id,
            variantId: l.variantId,
            locationId: dto.locationId,
            quantity: new Prisma.Decimal(l.item.quantity).times(l.factor),
            movementType: StockMovementType.SALE,
            referenceId: created.id,
            actorUserId: actor.userId,
            unitCost: l.baseCostPrice,
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

          // Edge-triggered, not the `warnings` field above (that fires on
          // every over-limit sale, by design, for immediate checkout
          // feedback) — this only fires the *first* time the customer
          // crosses into over-limit, never again while they stay over it,
          // per the plan's Q5 duplicate-prevention design. Resets only
          // once a payment brings them back under the limit.
          if (settings.maxCustomerDueLimit != null) {
            const beforeDue = Number(customer.dueBalance);
            const afterDue = beforeDue + dueAmountThisSale;
            const limit = Number(settings.maxCustomerDueLimit);
            if (beforeDue <= limit && afterDue > limit) {
              await this.notificationService.create(tx, context, {
                type: NotificationType.CUSTOMER_DUE_OVERDUE,
                relatedEntityType: NotificationRelatedEntityType.CUSTOMER,
                relatedEntityId: customer.id,
                metadata: {
                  customerName: customer.name,
                  dueBalance: afterDue.toString(),
                  limit: limit.toString(),
                },
              });
            }
          }
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

    // Same conversion boundary as create() — `item.quantity`/`item.unitCost`
    // are stored in each line's own entered unit, so restoring stock
    // needs that line's factor recomputed from its own `unitId`, never
    // assumed to already be in the Product's base unit.
    const productIds = [...new Set(before.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true, baseUnitId: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    const sale = await this.prisma.$transaction(async (tx) => {
      for (const item of before.items) {
        const product = productsById.get(item.productId)!;
        const factor = await this.unitConversionService.resolveFactor(
          context,
          product.baseUnitId,
          item.unitId,
        );
        await this.inventoryService.increaseStock(tx, {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          locationId: before.locationId,
          quantity: new Prisma.Decimal(item.quantity).times(factor),
          movementType: StockMovementType.SALE_VOID_IN,
          referenceId: before.id,
          actorUserId: actor.userId,
          unitCost: new Prisma.Decimal(item.unitCost).dividedBy(factor),
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

    // Keyed by productId+variantId (not productId alone) — a single sale
    // can have two separate lines for the same Product in different
    // variants (e.g. Red/S and Blue/S of the same T-Shirt), which would
    // otherwise collide on a bare productId key.
    const itemsByKey = new Map(
      sale.items.map((item) => [
        `${item.productId}:${item.variantId ?? ''}`,
        item,
      ]),
    );

    // Same conversion boundary as void() — a return quantity is entered
    // in the ORIGINAL sale line's own unit (never re-specified by the
    // caller), so its factor is recomputed from that line's `unitId`.
    const productIds = [...new Set(sale.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: context.tenantId,
        companyId: context.companyId,
      },
      select: { id: true, baseUnitId: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

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
        const saleItem = itemsByKey.get(
          `${line.productId}:${line.variantId ?? ''}`,
        );
        if (!saleItem) {
          throw new BadRequestException(
            line.variantId
              ? `variantId ${line.variantId} of product ${line.productId} was not part of this sale`
              : `productId ${line.productId} was not part of this sale`,
          );
        }
        const product = productsById.get(line.productId)!;
        const factor = await this.unitConversionService.resolveFactor(
          context,
          product.baseUnitId,
          saleItem.unitId,
        );
        await this.inventoryService.increaseStock(tx, {
          tenantId: context.tenantId,
          companyId: context.companyId,
          productId: line.productId,
          variantId: line.variantId,
          locationId: sale.locationId,
          quantity: new Prisma.Decimal(line.quantity).times(factor),
          movementType: StockMovementType.SALE_RETURN_IN,
          referenceId: saleReturn.id,
          actorUserId: actor.userId,
          unitCost: new Prisma.Decimal(saleItem.unitCost).dividedBy(factor),
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
