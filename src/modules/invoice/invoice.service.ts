import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditActorType,
  InvoiceStatus,
} from '../../generated/phase-1-prisma/enums';
import { Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';

import {
  INVOICE_DEFAULTS,
  INVOICE_NUMBER_PREFIX,
} from './constants/invoice.constants';

type CompanyScope = {
  tenantId: string;
  companyId: string;
};

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CREATE
  // ============================================================

  async create(dto: CreateInvoiceDto, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.findUnique({
        where: { id: dto.billingId },
        include: { invoice: true },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      /**
       * Duplicate protection: একই Billing period-এর জন্য দুইটা Invoice
       * তৈরি করা যাবে না। Billing.id নিজেই একটা billing period-কে
       * uniquely identify করে (Billing-এর @@unique([subscriptionId,
       * periodStart, periodEnd]) constraint দিয়ে), তাই Invoice.billingId
       * @unique constraint-ই effectively period-level duplicate protection।
       */
      if (billing.invoice) {
        throw new ConflictException(
          'An invoice already exists for this billing period',
        );
      }

      const rawSnapshot = billing.priceSnapshot;

      if (
        typeof rawSnapshot !== 'object' ||
        rawSnapshot === null ||
        Array.isArray(rawSnapshot)
      ) {
        throw new BadRequestException(
          'Billing priceSnapshot must be a JSON object',
        );
      }

      /**
       * Financial snapshot — subtotal/currency/priceSnapshot সব server-side
       * authoritative Billing row থেকে copy করা হয়, client input কখনো
       * trust করা হয় না (CreateInvoiceDto-তে শুধু billingId, কোনো amount
       * field নেই)। এই মুহূর্তে কোনো discount/tax engine নেই, তাই দুটোই 0।
       */
      const subtotal = billing.amount;
      const discountAmount = new Prisma.Decimal(0);
      const taxAmount = new Prisma.Decimal(0);
      const totalAmount = subtotal.minus(discountAmount).plus(taxAmount);

      const invoiceNumber = await this.reserveInvoiceNumber(tx);

      try {
        const invoice = await tx.invoice.create({
          data: {
            tenantId: billing.tenantId,
            companyId: billing.companyId,
            subscriptionId: billing.subscriptionId,
            billingId: billing.id,

            invoiceNumber,

            status: InvoiceStatus.DRAFT,

            currencyCode: billing.currencyCode,
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,

            priceSnapshot: rawSnapshot,

            dueAt: billing.dueAt,

            metadata: {
              createdBy: actorUserId ?? null,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: invoice.tenantId,
            companyId: invoice.companyId,
            actorUserId: actorUserId ?? null,
            actorType: AuditActorType.PLATFORM_MEMBER,
            action: 'INVOICE_CREATED',
            entityType: 'Invoice',
            entityId: invoice.id,
            afterData: {
              status: invoice.status,
              invoiceNumber: invoice.invoiceNumber,
              billingId: invoice.billingId,
              totalAmount: invoice.totalAmount.toString(),
            },
          },
        });

        return invoice;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'An invoice already exists for this billing period',
          );
        }
        throw error;
      }
    });
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(query: QueryInvoiceDto, scope?: CompanyScope) {
    const {
      tenantId,
      companyId,
      subscriptionId,
      status,
      search,
      dateFrom,
      dateTo,
      page = INVOICE_DEFAULTS.PAGE,
      limit = INVOICE_DEFAULTS.LIMIT,
    } = query;

    const safeLimit = Math.min(limit, INVOICE_DEFAULTS.MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.InvoiceWhereInput = {
      ...(scope && { tenantId: scope.tenantId, companyId: scope.companyId }),
      ...(!scope && tenantId && { tenantId }),
      ...(!scope && companyId && { companyId }),
      ...(subscriptionId && { subscriptionId }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        issuedAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        invoiceNumber: { contains: search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          billing: {
            select: {
              id: true,
              status: true,
              periodStart: true,
              periodEnd: true,
            },
          },
          subscription: {
            select: { id: true, status: true, planId: true },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  async findOne(id: string, scope?: CompanyScope) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        billing: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    /**
     * Company-scoped access: অন্য company/tenant-এর invoice হলে 404 —
     * 403 নয়, যাতে অন্য tenant-এ invoice-এর অস্তিত্ব leak না হয়
     * (subscription.service.ts-এর scoped() pattern অনুসরণ করে)।
     */
    if (
      scope &&
      (invoice.tenantId !== scope.tenantId ||
        invoice.companyId !== scope.companyId)
    ) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  // ============================================================
  // ISSUE
  // ============================================================

  async issue(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Invoice cannot be issued from ${invoice.status} state`,
        );
      }

      const now = new Date();

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.ISSUED, issuedAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: invoice.tenantId,
          companyId: invoice.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'INVOICE_ISSUED',
          entityType: 'Invoice',
          entityId: invoice.id,
          beforeData: { status: invoice.status },
          afterData: { status: updated.status, issuedAt: now.toISOString() },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // CANCEL (pre-issue correction: DRAFT -> CANCELLED)
  // ============================================================

  async cancel(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT invoices can be cancelled (current state: ${invoice.status})`,
        );
      }

      const now = new Date();

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED, cancelledAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: invoice.tenantId,
          companyId: invoice.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'INVOICE_CANCELLED',
          entityType: 'Invoice',
          entityId: invoice.id,
          beforeData: { status: invoice.status },
          afterData: { status: updated.status, cancelledAt: now.toISOString() },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // VOID (post-issue correction: ISSUED -> VOID)
  // ============================================================

  async void(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.ISSUED) {
        throw new BadRequestException(
          `Only ISSUED invoices can be voided (current state: ${invoice.status})`,
        );
      }

      const now = new Date();

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.VOID, voidedAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: invoice.tenantId,
          companyId: invoice.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'INVOICE_VOIDED',
          entityType: 'Invoice',
          entityId: invoice.id,
          beforeData: { status: invoice.status },
          afterData: { status: updated.status, voidedAt: now.toISOString() },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // MARK PAID (ISSUED -> PAID)
  // ============================================================

  /**
   * optional trailing `tx` — ভবিষ্যতের Payment module এই মেথডটাকে
   * নিজের Billing/Subscription settlement transaction-এর ভেতরে compose
   * করতে পারবে, Invoice module নিজে Billing/Subscription-কে না ছুঁয়ে
   * (module boundary পরিষ্কার থাকে)। এই milestone-এ শুধু Platform Admin
   * manual endpoint দিয়ে trigger হয়, ঠিক Billing.markSucceeded-এর মতো।
   */
  async markPaid(
    id: string,
    actorUserId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.ISSUED) {
        throw new BadRequestException(
          `Invoice cannot be marked as paid from ${invoice.status} state`,
        );
      }

      const now = new Date();

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.PAID, paidAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: invoice.tenantId,
          companyId: invoice.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'INVOICE_PAID',
          entityType: 'Invoice',
          entityId: invoice.id,
          beforeData: { status: invoice.status },
          afterData: { status: updated.status, paidAt: now.toISOString() },
        },
      });

      return updated;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Concurrency-safe, human-readable invoice number: "INV-2026-000001".
   * একটাই atomic upsert-increment SQL (Postgres row-level lock) — দুইটা
   * concurrent request কখনো একই number পাবে না। এর উপরে
   * Invoice.invoiceNumber @unique DB constraint একটা second-layer
   * safety net (create()-এ P2002 catch করা হয়)।
   */
  private async reserveInvoiceNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const yearKey = String(new Date().getFullYear());

    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO invoice_sequences ("yearKey", "lastNumber")
      VALUES (${yearKey}, 1)
      ON CONFLICT ("yearKey")
      DO UPDATE SET "lastNumber" = invoice_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;

    const lastNumber = rows[0]?.lastNumber;

    if (typeof lastNumber !== 'number') {
      throw new BadRequestException('Failed to reserve invoice number');
    }

    return `${INVOICE_NUMBER_PREFIX}-${yearKey}-${String(lastNumber).padStart(6, '0')}`;
  }
}
