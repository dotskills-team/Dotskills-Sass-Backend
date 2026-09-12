import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import {
  AuditActorType,
  BillingCycle,
  BillingStatus,
  CompanyStatus,
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
} from '../../generated/phase-1-prisma/enums';
import { Payment, Prisma } from '../../generated/phase-1-prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { InvoiceService } from '../invoice/invoice.service';
import { BillingService } from '../billing/billing.service';
import { SubscriptionRenewalService } from '../subscription/subscription-renewal.service';
import { MailService } from '../mail/mail.service';
import {
  accountActivationEmailHtml,
  paymentReceiptEmailHtml,
} from '../mail/mail.templates';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PAYMENT_DEFAULTS } from './constants/payment.constants';

import { PaymentGatewayAdapter } from './gateways/payment-gateway.interface';
import { PAYMENT_GATEWAY_ADAPTERS } from './gateways/payment-gateway.tokens';
import { companyWithOwnerSelect } from '../../common/prisma/company-with-owner.select';

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
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly billingService: BillingService,
    private readonly subscriptionRenewalService: SubscriptionRenewalService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_GATEWAY_ADAPTERS)
    private readonly adapters: Record<string, PaymentGatewayAdapter>,
  ) {}

  // ============================================================
  // CREATE + INITIATE
  // ============================================================

  async create(
    dto: CreatePaymentDto,
    scope: CompanyScope | undefined,
    actor: Actor,
    provider: PaymentProvider = PaymentProvider.SSLCOMMERZ,
    extraMetadata?: Record<string, unknown>,
  ) {
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

            provider,
            status: PaymentStatus.PENDING,

            currencyCode: invoice.currencyCode,
            amount: invoice.totalAmount,

            providerTransactionId: tranId,
            idempotencyKey: `payment:${invoice.id}:attempt:${advancedBilling.attemptCount}`,

            metadata: { initiatedByUserId: actor.userId, ...extraMetadata },
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
      // Its own failure must never replace the real gateway error below —
      // it's logged and swallowed, not re-thrown, so the caller always
      // sees the actual reason payment initiation failed.
      try {
        await this.billingService.markFailed(
          billingId,
          { failureCode: 'GATEWAY_INIT_FAILED', failureMessage: failureReason },
          actor.userId,
        );
      } catch (compensationError) {
        this.logger.error({
          event: 'billing_compensation_failed',
          billingId,
          paymentId: payment.id,
          originalError: failureReason,
          compensationError:
            compensationError instanceof Error
              ? compensationError.message
              : compensationError,
        });
      }

      throw error;
    }
  }

  /**
   * Platform Owner-initiated payment (cash, bank transfer, etc.) for a
   * company's subscription — the manual counterpart to the online
   * checkout→pay flow, walking the same Billing/Invoice/Payment chain
   * through the exact same create()/verifyAndSettle() calls, just against
   * the MANUAL adapter and invoked in one request instead of two (no
   * gateway redirect to wait on). Never mutates Subscription/Billing
   * directly — SubscriptionRenewalService.requestSubscriptionCheckout()
   * generates the same system-owned Billing/Invoice a company would get,
   * so manual and online payment share one settlement path end to end.
   */
  async recordManualPayment(
    dto: {
      subscriptionId: string;
      planId?: string;
      billingCycle?: BillingCycle;
      note?: string;
    },
    actor: Actor,
  ) {
    const { invoice } =
      await this.subscriptionRenewalService.requestSubscriptionCheckout(
        dto.subscriptionId,
        { planId: dto.planId, billingCycle: dto.billingCycle },
        actor.userId,
      );

    const { payment } = await this.create(
      { invoiceId: invoice.id },
      undefined,
      actor,
      PaymentProvider.MANUAL,
      { method: 'MANUAL', recordedByUserId: actor.userId, note: dto.note },
    );

    return this.verifyAndSettle(payment.id, '', actor.userId);
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
          company: { select: companyWithOwnerSelect },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
          subscription: {
            select: {
              id: true,
              billingCycle: true,
              plan: { select: { id: true, name: true, code: true } },
            },
          },
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
      include: {
        invoice: true,
        company: { select: companyWithOwnerSelect },
        subscription: { include: { plan: true } },
      },
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

  // ============================================================
  // RECEIPT — read-only, no settlement logic. Only ever returns data for
  // an already-SUCCEEDED payment; everything a printable receipt needs
  // (Company/Owner, Plan/billing cycle, Invoice, amounts) is data that
  // already exists from the real settlement flow — nothing is invented
  // or recomputed here.
  // ============================================================

  async getReceipt(id: string, scope?: CompanyScope) {
    const payment = await this.findOne(id, scope);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException(
        'A receipt is only available for a successfully completed payment.',
      );
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

    // Read Company state before settlement so we can tell, after the
    // transaction commits, whether this exact payment is what just brought
    // the company LIVE for the first time (no cross-layer plumbing needed —
    // SubscriptionLifecycleService.transition() is the only writer of
    // Company.status → LIVE, always inside this same settlement tx).
    const companyBefore = payment.companyId
      ? await this.prisma.company.findUnique({
          where: { id: payment.companyId },
          select: { status: true },
        })
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updatedPayment = await tx.payment.update({
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
          tenantId: updatedPayment.tenantId,
          companyId: updatedPayment.companyId,
          actorUserId: actorUserId ?? null,
          actorType: AuditActorType.SYSTEM,
          action: 'PAYMENT_SUCCEEDED',
          entityType: 'Payment',
          entityId: updatedPayment.id,
          beforeData: { status: payment.status },
          afterData: { status: updatedPayment.status },
        },
      });

      return updatedPayment;
    });

    const companyAfter = payment.companyId
      ? await this.prisma.company.findUnique({
          where: { id: payment.companyId },
          select: { status: true },
        })
      : null;
    const companyJustWentLive =
      companyBefore?.status !== CompanyStatus.LIVE &&
      companyAfter?.status === CompanyStatus.LIVE;

    // Email delivery is a side effect of an already-committed settlement —
    // never let it fail or delay the payment response itself.
    this.sendPostSettlementEmails(updated.id, companyJustWentLive).catch(
      (error) => {
        this.logger.error({
          event: 'post_settlement_email_failed',
          paymentId: updated.id,
          error: error instanceof Error ? error.message : error,
        });
      },
    );

    return updated;
  }

  /**
   * Fired exactly once per successful settlement (online or manual — both
   * funnel through this same method). Reuses the already-enriched
   * `findOne()` read (same shape the receipt endpoint/PDF download use) so
   * the emailed receipt and the downloadable one never disagree.
   */
  private async sendPostSettlementEmails(
    paymentId: string,
    companyJustWentLive: boolean,
  ) {
    const payment = await this.findOne(paymentId);
    const owner = payment.company?.ownerships[0]?.companyMember.user;

    if (!owner?.email) {
      this.logger.warn({
        event: 'post_settlement_email_skipped_no_owner',
        paymentId,
      });
      return;
    }

    const companyName =
      payment.company?.tradeName ??
      payment.company?.legalName ??
      'your company';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const receiptNumber = `RCPT-${payment.invoice.invoiceNumber.replace(/^INV-/, '')}`;
    const receipt = paymentReceiptEmailHtml({
      companyName,
      ownerName: owner.fullName,
      invoiceNumber: payment.invoice.invoiceNumber,
      receiptNumber,
      planName: payment.subscription.plan.name,
      billingCycle: payment.subscription.billingCycle,
      amount: payment.amount.toString(),
      currencyCode: payment.currencyCode,
      paymentMethod:
        payment.provider === PaymentProvider.MANUAL
          ? 'Manual payment'
          : payment.provider,
      transactionId: payment.providerTransactionId,
      paidAt: (payment.succeededAt ?? new Date()).toLocaleString('en-US'),
      receiptUrl: `${frontendUrl}/platform/payments/${payment.id}/receipt`,
    });

    await this.mailService.send({ to: owner.email, ...receipt });

    if (companyJustWentLive) {
      const activation = accountActivationEmailHtml({
        ownerName: owner.fullName,
        companyName,
        loginUrl: `${frontendUrl}/login`,
      });

      await this.mailService.send({ to: owner.email, ...activation });
    }
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

      /**
       * A cancelled checkout is not a gateway decline — it must not be
       * left behind as a Billing stuck PROCESSING (which would permanently
       * block every future payment attempt on this invoice via create()'s
       * own duplicate-settlement guard). Release the Billing/BillingAttempt
       * back to a payable state in the same transaction. Never call
       * billingService.markFailed() here — that would incorrectly trigger
       * subscription degradation for a customer simply abandoning checkout.
       */
      const invoiceRow = await tx.invoice.findUniqueOrThrow({
        where: { id: payment.invoiceId },
        select: { billingId: true },
      });

      await this.billingService.releaseCancelledAttempt(
        invoiceRow.billingId,
        actorUserId,
        tx,
      );

      await tx.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: actorUserId ?? null,
          actorType: actorUserId
            ? AuditActorType.PLATFORM_MEMBER
            : AuditActorType.SYSTEM,
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
