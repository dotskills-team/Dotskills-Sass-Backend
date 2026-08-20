import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import {
  AuditActorType,
  BillingStatus,
  InvoiceStatus,
  PaymentStatus,
} from '../../generated/phase-1-prisma/enums';
import { Payment, Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { InvoiceService } from '../invoice/invoice.service';
import { BillingService } from '../billing/billing.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PAYMENT_DEFAULTS } from './constants/payment.constants';

import { PaymentGatewayAdapter } from './gateways/payment-gateway.interface';
import { PAYMENT_GATEWAY_ADAPTERS } from './gateways/payment-gateway.tokens';

type CompanyScope = {
  tenantId: string;
  companyId: string;
};

type Actor = {
  userId: string;
  email: string;
  fullName: string;
};

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
];

const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
];

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly billingService: BillingService,
    @Inject(PAYMENT_GATEWAY_ADAPTERS)
    private readonly adapters: Record<string, PaymentGatewayAdapter>,
  ) {}

  // ============================================================
  // CREATE + INITIATE
  // ============================================================

  async create(dto: CreatePaymentDto, scope: CompanyScope, actor: Actor) {
    const invoice = await this.invoiceService.findOne(dto.invoiceId, scope);

    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException(
        `Payment can only be created for an ISSUED invoice (current state: ${invoice.status})`,
      );
    }

    const existingActive = await this.prisma.payment.findFirst({
      where: { invoiceId: invoice.id, status: { in: ACTIVE_PAYMENT_STATUSES } },
    });

    if (existingActive) {
      throw new ConflictException(
        'A payment is already in progress for this invoice',
      );
    }

    const billing = invoice.billing;

    const { payment, billingId } = await this.prisma.$transaction(
      async (tx) => {
        let advancedBilling;

        if (billing.status === BillingStatus.PENDING) {
          advancedBilling = await this.billingService.process(
            billing.id,
            actor.userId,
            tx,
          );
        } else if (billing.status === BillingStatus.FAILED) {
          advancedBilling = await this.billingService.retry(
            billing.id,
            actor.userId,
            tx,
          );
        } else if (billing.status === BillingStatus.PROCESSING) {
          throw new ConflictException(
            "A settlement is already in progress for this invoice's billing period",
          );
        } else {
          throw new BadRequestException(
            `Billing is not payable from ${billing.status} state`,
          );
        }

        const tranId = this.generateTranId();

        const createdPayment = await tx.payment.create({
          data: {
            tenantId: invoice.tenantId,
            companyId: invoice.companyId,
            subscriptionId: invoice.subscriptionId,
            invoiceId: invoice.id,

            provider: 'SSLCOMMERZ',
            status: PaymentStatus.PENDING,

            currencyCode: invoice.currencyCode,
            amount: invoice.totalAmount,

            providerTransactionId: tranId,
            idempotencyKey: `payment:${invoice.id}:attempt:${advancedBilling.attemptCount}`,

            metadata: { initiatedByUserId: actor.userId },
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: createdPayment.tenantId,
            companyId: createdPayment.companyId,
            actorUserId: actor.userId,
            actorType: AuditActorType.COMPANY_MEMBER,
            action: 'PAYMENT_CREATED',
            entityType: 'Payment',
            entityId: createdPayment.id,
            afterData: { status: createdPayment.status, invoiceId: invoice.id },
          },
        });

        return { payment: createdPayment, billingId: billing.id };
      },
    );

    // Gateway call happens outside the DB transaction — never hold a
    // transaction open across a network round-trip.
    const adapter = this.getAdapter(payment.provider);

    try {
      const result = await adapter.initiate({
        tranId: payment.providerTransactionId,
        amount: payment.amount.toString(),
        currencyCode: payment.currencyCode,
        invoiceNumber: invoice.invoiceNumber,
        customerName: actor.fullName,
        customerEmail: actor.email,
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PROCESSING,
          initiatedAt: new Date(),
          rawInitiateResponse: result.rawResponse as Prisma.InputJsonValue,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: actor.userId,
          actorType: AuditActorType.COMPANY_MEMBER,
          action: 'PAYMENT_INITIATED',
          entityType: 'Payment',
          entityId: updated.id,
          afterData: { status: updated.status },
        },
      });

      return { payment: updated, gatewayPageUrl: result.gatewayPageUrl };
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Gateway initiation failed';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: new Date(),
          failureReason,
        },
      });

      // Compensating action — Billing was already advanced to PROCESSING
      // above; without this it would be stuck there with no live Payment.
      await this.billingService.markFailed(
        billingId,
        { failureCode: 'GATEWAY_INIT_FAILED', failureMessage: failureReason },
        actor.userId,
      );

      throw error;
    }
  }

  // ============================================================
  // FIND ALL / FIND ONE
  // ============================================================

  async findAll(query: QueryPaymentDto, scope?: CompanyScope) {
    const {
      tenantId,
      companyId,
      invoiceId,
      status,
      page = PAYMENT_DEFAULTS.PAGE,
      limit = PAYMENT_DEFAULTS.LIMIT,
    } = query;

    const safeLimit = Math.min(limit, PAYMENT_DEFAULTS.MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.PaymentWhereInput = {
      ...(scope && { tenantId: scope.tenantId, companyId: scope.companyId }),
      ...(!scope && tenantId && { tenantId }),
      ...(!scope && companyId && { companyId }),
      ...(invoiceId && { invoiceId }),
      ...(status && { status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where }),
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

  async findOne(id: string, scope?: CompanyScope) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      scope &&
      (payment.tenantId !== scope.tenantId ||
        payment.companyId !== scope.companyId)
    ) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  private async findByTranId(tranId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerTransactionId: tranId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this transaction');
    }

    return payment;
  }

  // ============================================================
  // VERIFY & SETTLE — the single funnel every callback/IPN/manual-verify
  // route goes through. Idempotent: already-terminal payments short-circuit.
  // ============================================================

  async verifyByTranId(tranId: string, valId: string) {
    const payment = await this.findByTranId(tranId);
    return this.verifyAndSettle(payment.id, valId);
  }

  /**
   * fail_url callback থেকে — নিজে থেকে SUCCESS কখনো এখান থেকে ধরা হয় না
   * (Phase 9-এর নিয়ম), শুধু conservative fail-closed marking। val_id
   * verify করার কিছু নেই যেহেতু gateway নিজেই failure report করছে।
   */
  async failFromGateway(tranId: string, reason: string) {
    const payment = await this.findByTranId(tranId);

    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) {
      return payment;
    }

    const actorUserId = (payment.metadata as Record<string, unknown> | null)
      ?.initiatedByUserId as string | undefined;

    return this.settleFailed(
      payment,
      { source: 'gateway_fail_redirect' },
      actorUserId,
      reason,
    );
  }

  /** cancel_url callback থেকে — user নিজে গেটওয়ে পেজে payment বাতিল করেছে। */
  async cancelFromGateway(tranId: string) {
    const payment = await this.findByTranId(tranId);

    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) {
      return payment;
    }

    return this.cancel(payment.id);
  }

  async verifyAndSettle(
    paymentId: string,
    valId: string,
    callerActorUserId?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) {
      return payment;
    }

    const actorUserId =
      callerActorUserId ??
      ((payment.metadata as Record<string, unknown> | null)
        ?.initiatedByUserId as string | undefined);

    const adapter = this.getAdapter(payment.provider);
    const verifyResult = await adapter.verifyTransaction({
      tranId: payment.providerTransactionId,
      valId,
    });

    const amountMatches =
      verifyResult.amount !== null &&
      new Prisma.Decimal(verifyResult.amount).equals(payment.amount);
    const currencyMatches =
      verifyResult.currencyCode === null ||
      verifyResult.currencyCode === payment.currencyCode;

    if (verifyResult.verified && amountMatches && currencyMatches) {
      return this.settleSucceeded(
        payment,
        verifyResult.rawResponse,
        verifyResult.gatewayReference,
        actorUserId,
      );
    }

    return this.settleFailed(
      payment,
      verifyResult.rawResponse,
      actorUserId,
      'Gateway verification failed or amount/currency mismatch',
    );
  }

  private async settleSucceeded(
    payment: Payment,
    rawResponse: Record<string, unknown>,
    gatewayReference: string,
    actorUserId?: string,
  ) {
    const invoiceRow = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      select: { billingId: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          succeededAt: now,
          gatewayReference,
          rawVerifyResponse: rawResponse as Prisma.InputJsonValue,
        },
      });

      await this.invoiceService.markPaid(payment.invoiceId, actorUserId, tx);
      await this.billingService.markSucceeded(
        invoiceRow.billingId,
        actorUserId ?? 'system',
        tx,
      );

      await tx.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.SYSTEM,
          action: 'PAYMENT_SUCCEEDED',
          entityType: 'Payment',
          entityId: updated.id,
          beforeData: { status: payment.status },
          afterData: { status: updated.status },
        },
      });

      return updated;
    });
  }

  private async settleFailed(
    payment: Payment,
    rawResponse: Record<string, unknown>,
    actorUserId: string | undefined,
    failureReason: string,
  ) {
    const invoiceRow = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      select: { billingId: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: now,
          failureReason,
          rawVerifyResponse: rawResponse as Prisma.InputJsonValue,
        },
      });

      await this.billingService.markFailed(
        invoiceRow.billingId,
        {
          failureCode: 'PAYMENT_VERIFICATION_FAILED',
          failureMessage: failureReason,
        },
        actorUserId ?? 'system',
        tx,
      );

      await tx.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.SYSTEM,
          action: 'PAYMENT_FAILED',
          entityType: 'Payment',
          entityId: updated.id,
          beforeData: { status: payment.status },
          afterData: { status: updated.status, failureReason },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // CANCEL (Platform-only, PENDING/PROCESSING only)
  // ============================================================

  async cancel(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
        throw new BadRequestException(
          `Payment cannot be cancelled from ${payment.status} state`,
        );
      }

      const updated = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.CANCELLED, cancelledAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.PLATFORM_MEMBER,
          action: 'PAYMENT_CANCELLED',
          entityType: 'Payment',
          entityId: updated.id,
          beforeData: { status: payment.status },
          afterData: { status: updated.status },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getAdapter(provider: string): PaymentGatewayAdapter {
    const adapter = this.adapters[provider];

    if (!adapter) {
      throw new BadRequestException(
        `No gateway adapter registered for provider ${provider}`,
      );
    }

    return adapter;
  }

  private generateTranId(): string {
    return `DS${Date.now().toString(36).toUpperCase()}${randomBytes(6).toString('hex')}`;
  }
}
