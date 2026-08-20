import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditActorType,
  SubscriptionStatus,
  BillingAttemptStatus,
  BillingStatus,
} from 'src/generated/phase-1-prisma/enums';

// import { Prisma } from 'src/generated/phase-1-prisma';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateBillingDto } from './dto/create-billing.dto';
import { QueryBillingDto } from './dto/query-billing.dto';
import { CancelBillingDto } from './dto/cancel-billing.dto';
import { MarkFailedBillingDto } from './dto/mark-failed-billing.dto';

import { BILLING_DEFAULTS } from './constants/billing.constants';
import { Prisma } from 'src/generated/phase-1-prisma/client';

import { SubscriptionLifecycleService } from '../subscription/subscription-lifecycle.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionLifecycleService: SubscriptionLifecycleService,
  ) {}

  // ============================================================
  // CREATE BILLING
  // ============================================================

  async create(dto: CreateBillingDto, actorUserId?: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        id: dto.subscriptionId,
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Billing cannot be created for cancelled or expired subscription',
      );
    }

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const dueAt = new Date(dto.dueAt);

    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    if (dueAt.getTime() > periodEnd.getTime()) {
      throw new BadRequestException('dueAt cannot be after periodEnd');
    }

    /**
     * Prevent duplicate billing for the same period.
     */
    // const existing =
    //   await this.prisma.billing.findUnique({
    //     where: {
    //       subscriptionId_periodStart_periodEnd: {
    //         subscriptionId:
    //           subscription.id,
    //         periodStart,
    //         periodEnd,
    //       },
    //     },
    //     select: {
    //       id: true,
    //       status: true,
    //     },
    //   });
    const existing = await this.prisma.billing.findFirst({
      where: {
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
      },
      select: {
        id: true,
        status: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        'Billing already exists for this subscription period',
      );
    }

    /**
     * Subscription priceSnapshot is the source
     * of truth for historical billing.
     */
    // const priceSnapshot =
    //   subscription.priceSnapshot as Record<
    //     string,
    //     unknown
    //   >;
    const rawSnapshot = subscription.priceSnapshot;

    if (
      typeof rawSnapshot !== 'object' ||
      rawSnapshot === null ||
      Array.isArray(rawSnapshot)
    ) {
      throw new BadRequestException(
        'Subscription priceSnapshot must be a JSON object',
      );
    }

    const priceSnapshot = rawSnapshot as Record<string, unknown>;

    const amount = this.extractAmount(priceSnapshot);

    const currencyCode = this.extractCurrency(priceSnapshot, 'BDT');

    const idempotencyKey = `billing:${subscription.id}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;

    const billing = await this.prisma.billing.create({
      data: {
        tenantId: subscription.tenantId,

        companyId: subscription.companyId,

        subscriptionId: subscription.id,

        status: BillingStatus.PENDING,

        billingCycle: subscription.billingCycle,

        currencyCode,

        amount,

        periodStart,

        periodEnd,

        dueAt,

        idempotencyKey,

        priceSnapshot: priceSnapshot as Prisma.InputJsonValue,

        metadata: {
          source: 'SUBSCRIPTION',
          actorUserId: actorUserId ?? null,
        },
      },
      include: {
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return billing;
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(query: QueryBillingDto) {
    const {
      tenantId,
      companyId,
      subscriptionId,
      status,
      billingCycle,
      search,
      page = BILLING_DEFAULTS.PAGE,
      limit = BILLING_DEFAULTS.LIMIT,
    } = query;

    const safeLimit = Math.min(limit, BILLING_DEFAULTS.MAX_LIMIT);

    const skip = (page - 1) * safeLimit;

    const where: any = {
      ...(tenantId && {
        tenantId,
      }),

      ...(companyId && {
        companyId,
      }),

      ...(subscriptionId && {
        subscriptionId,
      }),

      ...(status && {
        status,
      }),

      ...(billingCycle && {
        billingCycle,
      }),

      ...(search && {
        OR: [
          {
            id: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            currencyCode: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            idempotencyKey: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.billing.findMany({
        where,
        skip,
        take: safeLimit,

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          subscription: {
            select: {
              id: true,
              status: true,
              billingCycle: true,
              planId: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
            },
          },

          attempts: {
            orderBy: {
              attemptNumber: 'desc',
            },

            take: 1,

            select: {
              id: true,
              attemptNumber: true,
              status: true,
              attemptedAt: true,
              completedAt: true,
              failureCode: true,
              failureMessage: true,
            },
          },
        },
      }),

      this.prisma.billing.count({
        where,
      }),
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

  async findOne(id: string) {
    const billing = await this.prisma.billing.findUnique({
      where: {
        id,
      },

      include: {
        subscription: {
          include: {
            plan: true,
          },
        },

        attempts: {
          orderBy: {
            attemptNumber: 'asc',
          },
        },
      },
    });

    if (!billing) {
      throw new NotFoundException('Billing not found');
    }

    return billing;
  }

  // ============================================================
  // PROCESS
  // ============================================================

  async process(
    id: string,
    actorUserId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (billing.status !== BillingStatus.PENDING) {
        throw new BadRequestException(
          `Billing cannot be processed from ${billing.status} state`,
        );
      }

      if (billing.dueAt.getTime() > Date.now()) {
        throw new BadRequestException('Billing is not due yet');
      }

      const nextAttempt = billing.attemptCount + 1;

      if (nextAttempt > BILLING_DEFAULTS.MAX_ATTEMPTS) {
        throw new BadRequestException('Maximum billing attempts reached');
      }

      const attemptKey = `${billing.id}:attempt:${nextAttempt}`;

      const updated = await tx.billing.update({
        where: {
          id: billing.id,
        },

        data: {
          status: BillingStatus.PROCESSING,

          attemptCount: nextAttempt,

          nextAttemptAt: null,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            processingStartedBy: actorUserId ?? null,
            processingStartedAt: new Date().toISOString(),
          },
        },
      });

      await tx.billingAttempt.create({
        data: {
          billingId: billing.id,

          attemptNumber: nextAttempt,

          status: BillingAttemptStatus.STARTED,

          idempotencyKey: attemptKey,

          metadata: {
            actorUserId: actorUserId ?? null,
          },
        },
      });

      return updated;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  // ============================================================
  // RETRY
  // ============================================================

  async retry(id: string, actorUserId?: string, tx?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (billing.status !== BillingStatus.FAILED) {
        throw new BadRequestException('Only failed billing can be retried');
      }

      if (billing.attemptCount >= BILLING_DEFAULTS.MAX_ATTEMPTS) {
        throw new BadRequestException('Maximum billing retry limit reached');
      }

      const nextAttempt = billing.attemptCount + 1;

      const attemptKey = `${billing.id}:attempt:${nextAttempt}`;

      const updated = await tx.billing.update({
        where: {
          id: billing.id,
        },

        data: {
          status: BillingStatus.PROCESSING,

          attemptCount: nextAttempt,

          nextAttemptAt: null,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            retryBy: actorUserId ?? null,
            retryAt: new Date().toISOString(),
          },
        },
      });

      await tx.billingAttempt.create({
        data: {
          billingId: billing.id,

          attemptNumber: nextAttempt,

          status: BillingAttemptStatus.STARTED,

          idempotencyKey: attemptKey,

          metadata: {
            actorUserId: actorUserId ?? null,
            retry: true,
          },
        },
      });

      return updated;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  // ============================================================
  // CANCEL
  // ============================================================

  async cancel(id: string, dto: CancelBillingDto, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (
        billing.status === BillingStatus.SUCCEEDED ||
        billing.status === BillingStatus.CANCELLED ||
        billing.status === BillingStatus.SKIPPED
      ) {
        throw new BadRequestException(
          `Billing cannot be cancelled from ${billing.status} state`,
        );
      }

      const now = new Date();

      const updated = await tx.billing.update({
        where: {
          id,
        },

        data: {
          status: BillingStatus.CANCELLED,

          cancelledAt: now,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            cancelledBy: actorUserId ?? null,
            cancellationReason: dto.reason ?? null,
          },
        },
      });

      /**
       * If a processing attempt exists,
       * close the latest STARTED attempt.
       */
      await tx.billingAttempt.updateMany({
        where: {
          billingId: id,
          status: BillingAttemptStatus.STARTED,
        },

        data: {
          status: BillingAttemptStatus.CANCELLED,

          completedAt: now,
        },
      });

      return updated;
    });
  }

  // ============================================================
  // SKIP
  // ============================================================

  async skip(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (billing.status !== BillingStatus.PENDING) {
        throw new BadRequestException(`Only pending billing can be skipped`);
      }

      return tx.billing.update({
        where: {
          id,
        },

        data: {
          status: BillingStatus.SKIPPED,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            skippedBy: actorUserId ?? null,
            skippedAt: new Date().toISOString(),
          },
        },
      });
    });
  }

  // ============================================================
  // MARK SUCCEEDED
  // ============================================================

  /**
   * PROCESSING -> SUCCEEDED. actorUserId বাধ্যতামূলক (অন্য মেথডগুলোর মতো
   * optional নয়) কারণ এটা Subscription-side paymentSucceeded()-এর actor
   * context হিসেবেও ব্যবহৃত হয়, শুধু audit metadata হিসেবে নয়।
   */
  async markSucceeded(
    id: string,
    actorUserId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (billing.status !== BillingStatus.PROCESSING) {
        throw new BadRequestException(
          `Billing cannot be marked as succeeded from ${billing.status} state`,
        );
      }

      const attempt = await tx.billingAttempt.findFirst({
        where: {
          billingId: billing.id,
          attemptNumber: billing.attemptCount,
          status: BillingAttemptStatus.STARTED,
        },
      });

      if (!attempt) {
        throw new NotFoundException(
          'No active billing attempt found to settle',
        );
      }

      const now = new Date();

      /**
       * Subscription-side transition একই transaction (tx) দিয়ে
       * চালানো হয় — এটা ব্যর্থ হলে (যেমন Subscription অসামঞ্জস্যপূর্ণ
       * status-এ থাকলে) পুরো Billing/BillingAttempt update rollback
       * হয়ে যাবে, partial settlement ঘটবে না।
       */
      await this.subscriptionLifecycleService.paymentSucceeded(
        billing.subscriptionId,
        {
          userId: actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
        },
        attempt.idempotencyKey,
        tx,
      );

      const updated = await tx.billing.update({
        where: {
          id: billing.id,
        },

        data: {
          status: BillingStatus.SUCCEEDED,

          processedAt: now,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            succeededBy: actorUserId,
            succeededAt: now.toISOString(),
          },
        },
      });

      await tx.billingAttempt.update({
        where: {
          id: attempt.id,
        },

        data: {
          status: BillingAttemptStatus.SUCCEEDED,

          completedAt: now,
        },
      });

      return updated;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  // ============================================================
  // MARK FAILED
  // ============================================================

  /**
   * PROCESSING -> FAILED. একবার FAILED হলে existing retry() স্বয়ংক্রিয়ভাবে
   * reachable/কার্যকর হয়ে যায় — retry() নিজে অপরিবর্তিত।
   */
  async markFailed(
    id: string,
    dto: MarkFailedBillingDto,
    actorUserId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const billing = await tx.billing.findUnique({
        where: {
          id,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing not found');
      }

      if (billing.status !== BillingStatus.PROCESSING) {
        throw new BadRequestException(
          `Billing cannot be marked as failed from ${billing.status} state`,
        );
      }

      const attempt = await tx.billingAttempt.findFirst({
        where: {
          billingId: billing.id,
          attemptNumber: billing.attemptCount,
          status: BillingAttemptStatus.STARTED,
        },
      });

      if (!attempt) {
        throw new NotFoundException(
          'No active billing attempt found to settle',
        );
      }

      const now = new Date();

      /**
       * Subscription-side transition একই transaction (tx) দিয়ে
       * চালানো হয় — ব্যর্থ হলে পুরো operation rollback হয়ে যাবে।
       */
      await this.subscriptionLifecycleService.paymentFailed(
        billing.subscriptionId,
        {
          userId: actorUserId,
          actorType: AuditActorType.PLATFORM_MEMBER,
        },
        attempt.idempotencyKey,
        tx,
      );

      const updated = await tx.billing.update({
        where: {
          id: billing.id,
        },

        data: {
          status: BillingStatus.FAILED,

          failedAt: now,

          metadata: {
            ...((billing.metadata as object) ?? {}),
            failedBy: actorUserId,
            failedAt: now.toISOString(),
            failureCode: dto.failureCode ?? null,
            failureMessage: dto.failureMessage ?? null,
          },
        },
      });

      await tx.billingAttempt.update({
        where: {
          id: attempt.id,
        },

        data: {
          status: BillingAttemptStatus.FAILED,

          completedAt: now,

          failureCode: dto.failureCode ?? null,

          failureMessage: dto.failureMessage ?? null,
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

  private extractAmount(snapshot: Record<string, unknown>): string {
    const amount = snapshot.amount;

    if (amount === undefined || amount === null) {
      throw new BadRequestException(
        'Subscription priceSnapshot does not contain amount',
      );
    }

    if (typeof amount !== 'string' && typeof amount !== 'number') {
      throw new BadRequestException(
        'Subscription priceSnapshot amount must be a number or string',
      );
    }

    return String(amount);
  }

  private extractCurrency(
    snapshot: Record<string, unknown>,
    fallback: string,
  ): string {
    const currency = snapshot.currencyCode;

    if (typeof currency === 'string' && currency.length === 3) {
      return currency.toUpperCase();
    }

    return fallback;
  }
}
