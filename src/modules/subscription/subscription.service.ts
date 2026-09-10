import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// import {
//   AuditActorType,
//   BillingCycle,
//   PlanStatus,
//   Prisma,
//   SubscriptionStatus,
// } from "../../generated/phase-1-prisma";
import { PrismaService } from '../../prisma/prisma.service';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateAutoRenewDto } from './dto/update-auto-renew.dto';
import { SUBSCRIPTION_CONSTANTS } from './subscription.constants';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
// import { PriceSnapshot, SubscriptionContext } from "./subscription.types";
import {
  CreateSubscriptionContext,
  PlatformSubscriptionContext,
  PriceSnapshot,
  SubscriptionContext,
} from './subscription.types';
import {
  AuditActorType,
  BillingCycle,
  PlanStatus,
  SubscriptionStatus,
} from 'src/generated/phase-1-prisma/enums';
import { Prisma } from 'src/generated/phase-1-prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
  ) {}

  // async create(dto: CreateSubscriptionDto, context: SubscriptionContext) {
  async create(dto: CreateSubscriptionDto, context: CreateSubscriptionContext) {
    if (!context.companyId) {
      throw new BadRequestException('x-company-id header is required.');
    }

    if (dto.companyId !== context.companyId) {
      throw new BadRequestException('x-company-id must match body companyId.');
    }

    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    const isSuperAdmin = context.roles.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      const membership = await this.prisma.companyMember.findFirst({
        where: {
          userId: context.userId,
          tenantId: company.tenantId,
          companyId: company.id,
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        throw new NotFoundException('Company not found.');
      }
    }

    const plan = await this.getPlan(dto.planId);
    const price = await this.getPrice(
      dto.planId,
      dto.billingCycle,
      company.baseCurrencyCode,
    );
    const existing = await this.prisma.subscription.findFirst({
      where: {
        // tenantId: context.tenantId,
        tenantId: company.tenantId,
        companyId: company.id,
        status: {
          notIn: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
        },
      },
    });
    if (existing)
      throw new ConflictException(
        'Company already has an open subscription lifecycle.',
      );

    return this.prisma.$transaction((tx) =>
      this.buildSubscription(tx, {
        company,
        plan,
        billingCycle: dto.billingCycle,
        price,
        actorUserId: context.userId,
        actorType: context.actorType ?? AuditActorType.COMPANY_MEMBER,
        reason: 'SUBSCRIPTION_CREATED',
        source: 'API',
      }),
    );
  }

  /**
   * Shared row-creation core for `create()` (self-service) and
   * `createTrialForNewCompany()` (auto-trial on Company creation) — same
   * TRIALING/ACTIVE-by-trialDays logic, same price-snapshot shape, same
   * SubscriptionEvent/AuditLog pair, just parameterized on who/why. Always
   * takes an externally-owned `tx` so the caller controls the transaction
   * boundary (Company creation needs this row created atomically with the
   * Company row itself).
   */
  private async buildSubscription(
    tx: Prisma.TransactionClient,
    params: {
      company: { id: string; tenantId: string };
      plan: { id: string; code: string; name: string; trialDays: number };
      billingCycle: BillingCycle;
      price: { currencyCode: string; amount: Prisma.Decimal };
      actorUserId?: string;
      actorType: AuditActorType;
      reason: string;
      source: string;
      isComplimentary?: boolean;
    },
  ) {
    const {
      company,
      plan,
      billingCycle,
      price,
      actorUserId,
      actorType,
      reason,
      source,
    } = params;
    const now = new Date();
    const trialEndsAt =
      plan.trialDays > 0 ? this.addDays(now, plan.trialDays) : null;
    const periodStart = trialEndsAt ?? now;
    const snapshot: PriceSnapshot = {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      billingCycle,
      currencyCode: price.currencyCode,
      amount: price.amount.toString(),
      capturedAt: now.toISOString(),
    };

    const subscription = await tx.subscription.create({
      data: {
        tenantId: company.tenantId,
        companyId: company.id,
        planId: plan.id,
        status: trialEndsAt
          ? SubscriptionStatus.TRIALING
          : SubscriptionStatus.ACTIVE,
        billingCycle,
        startsAt: now,
        trialEndsAt,
        currentPeriodStart: periodStart,
        currentPeriodEnd: this.lifecycle.calculatePeriodEnd(
          periodStart,
          billingCycle,
        ),
        autoRenew: true,
        isComplimentary: params.isComplimentary ?? false,
        priceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        companyId: subscription.companyId,
        fromStatus: null,
        toStatus: subscription.status,
        reason,
        source,
        actorUserId: actorUserId ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: company.tenantId,
        companyId: company.id,
        actorUserId: actorUserId ?? null,
        actorType,
        action: 'SUBSCRIPTION_CREATED',
        entityType: 'Subscription',
        entityId: subscription.id,
        afterData: { status: subscription.status, planId: plan.id },
      },
    });
    return subscription;
  }

  /**
   * Auto-trial on Company creation. Always uses the Plan currently marked
   * `isDefaultTrial: true` and a MONTHLY price in the company's currency —
   * if either is missing, this throws (NotFoundException), and
   * CompanyManagementService.create() lets that fail the whole Company
   * creation loudly rather than create a subscription-less company.
   */
  async createTrialForNewCompany(
    company: { id: string; tenantId: string; baseCurrencyCode: string },
    actorUserId: string,
    tx: Prisma.TransactionClient,
  ) {
    const plan = await tx.plan.findFirst({
      where: { isDefaultTrial: true, status: PlanStatus.ACTIVE },
    });
    if (!plan) {
      throw new NotFoundException(
        'No default-trial Plan is configured (Plan.isDefaultTrial) — cannot create a Company without one.',
      );
    }

    const now = new Date();
    const price = await tx.planPrice.findFirst({
      where: {
        planId: plan.id,
        billingCycle: BillingCycle.MONTHLY,
        currencyCode: company.baseCurrencyCode,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!price) {
      throw new NotFoundException(
        `Default-trial Plan "${plan.code}" has no active MONTHLY price in ${company.baseCurrencyCode} — cannot create a Company without one.`,
      );
    }

    return this.buildSubscription(tx, {
      company,
      plan,
      billingCycle: BillingCycle.MONTHLY,
      price,
      actorUserId,
      actorType: AuditActorType.SYSTEM,
      reason: 'AUTO_TRIAL_ON_COMPANY_CREATE',
      source: 'SYSTEM',
    });
  }

  getCurrent(context: SubscriptionContext) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        status: { not: SubscriptionStatus.EXPIRED },
      },
      include: {
        plan: { include: { features: { include: { feature: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll(context: SubscriptionContext) {
    return this.prisma.subscription.findMany({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: SUBSCRIPTION_CONSTANTS.MAX_HISTORY_LIMIT,
    });
  }

  /**
   * Company-safe plan catalog for the "Change Plan" flow — only ACTIVE + isPublic plans, and
   * only currently-effective ACTIVE prices in the company's own base currency (the exact same
   * eligibility rule `getPrice()` already enforces when a plan change is actually submitted, so
   * nothing shown here can be rejected later for a currency/availability reason). Plans with no
   * eligible price for this company's currency are excluded entirely — never shown as
   * "selectable" when they aren't. Read-only, reuses the existing company-scoped controller/guards;
   * no platform-only field (internal notes, subscription counts, non-public/archived plans) is exposed.
   */
  async getEligiblePlans(context: SubscriptionContext) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { baseCurrencyCode: true },
    });

    const now = new Date();
    const priceWhere: Prisma.PlanPriceWhereInput = {
      currencyCode: company.baseCurrencyCode,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    };

    return this.prisma.plan.findMany({
      where: {
        status: PlanStatus.ACTIVE,
        isPublic: true,
        prices: { some: priceWhere },
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        trialDays: true,
        prices: {
          where: priceWhere,
          select: {
            id: true,
            billingCycle: true,
            currencyCode: true,
            amount: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
          orderBy: { billingCycle: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, context: SubscriptionContext) {
    const row = await this.prisma.subscription.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
      include: {
        plan: { include: { features: { include: { feature: true } } } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!row) throw new NotFoundException('Subscription not found.');
    return row;
  }

  async updateAutoRenew(
    id: string,
    dto: UpdateAutoRenewDto,
    context: SubscriptionContext,
  ) {
    const row = await this.scoped(id, context);
    // if (
    //   [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED].includes(
    //     row.status,
    //   )
    // )
    if (
      row.status === SubscriptionStatus.CANCELLED ||
      row.status === SubscriptionStatus.EXPIRED
    )
      throw new BadRequestException(
        'Auto-renew cannot be changed in this state.',
      );
    return this.prisma.subscription.update({
      where: { id },
      data: { autoRenew: dto.autoRenew },
    });
  }

  async cancel(
    id: string,
    dto: CancelSubscriptionDto,
    context: SubscriptionContext,
  ) {
    const row = await this.scoped(id, context);
    return this.lifecycle.transition(
      row,
      SubscriptionStatus.CANCELLED,
      context,
      {
        reason: dto.reason ?? 'USER_CANCELLED',
        source: 'API',
        patch: { cancelledAt: new Date(), autoRenew: false },
      },
    );
  }

  async reactivate(id: string, context: SubscriptionContext) {
    const row = await this.scoped(id, context);
    if (row.status !== SubscriptionStatus.CANCELLED)
      throw new BadRequestException(
        'Only CANCELLED subscriptions can be reactivated.',
      );
    if (row.currentPeriodEnd <= new Date())
      throw new BadRequestException(
        'Cancellation period has ended; create or renew a subscription instead.',
      );
    return this.lifecycle.transition(row, SubscriptionStatus.ACTIVE, context, {
      reason: 'USER_REACTIVATED',
      source: 'API',
      patch: { cancelledAt: null, autoRenew: true },
    });
  }

  findAllForPlatform() {
    return this.prisma.subscription.findMany({
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: SUBSCRIPTION_CONSTANTS.MAX_HISTORY_LIMIT,
    });
  }

  async findOneForPlatform(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        id,
      },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
        events: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 100,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    return subscription;
  }
  async suspendForPlatform(
    id: string,
    reason: string | undefined,
    context: PlatformSubscriptionContext,
  ) {
    const subscription = await this.findForPlatformAction(id);

    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Subscription is already suspended.');
    }

    if (subscription.status === SubscriptionStatus.EXPIRED) {
      throw new BadRequestException(
        'Expired subscription cannot be suspended.',
      );
    }

    const now = new Date();

    return this.lifecycle.transition(
      subscription,
      SubscriptionStatus.SUSPENDED,
      context,
      {
        reason: reason ?? 'PLATFORM_ADMIN_SUSPENDED',
        source: 'API',
        patch: {
          suspendedAt: now,
          suspensionExpiresAt: this.addDays(
            now,
            SUBSCRIPTION_CONSTANTS.DEFAULT_SUSPENSION_DAYS,
          ),
        },
        metadata: {
          action: 'PLATFORM_SUSPEND',
        },
      },
    );
  }

  async reactivateForPlatform(
    id: string,
    reason: string | undefined,
    context: PlatformSubscriptionContext,
  ) {
    const subscription = await this.findForPlatformAction(id);

    if (subscription.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException(
        'Only SUSPENDED subscriptions can be reactivated.',
      );
    }

    return this.lifecycle.transition(
      subscription,
      SubscriptionStatus.ACTIVE,
      context,
      {
        reason: reason ?? 'PLATFORM_ADMIN_REACTIVATED',
        source: 'API',
        patch: {
          suspendedAt: null,
          suspensionExpiresAt: null,
          graceEndsAt: null,
          pastDueEndsAt: null,
          cancelledAt: null,
        },
        metadata: {
          action: 'PLATFORM_REACTIVATE',
        },
      },
    );
  }

  /**
   * Platform Admin override — not a `SubscriptionStatus` transition, so this
   * stays a direct field update (same shape as the company-side
   * `updateAutoRenew()`), just id-scoped via `findForPlatformAction()`
   * instead of `scoped()`. Unlike the company-side method, this writes a
   * real AuditLog entry — every other platform action already does, and
   * there's no reason this one should be the exception.
   */
  async updateAutoRenewForPlatform(
    id: string,
    dto: UpdateAutoRenewDto,
    context: PlatformSubscriptionContext,
  ) {
    const subscription = await this.findForPlatformAction(id);

    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Auto-renew cannot be changed in this state.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id },
        data: { autoRenew: dto.autoRenew },
      });

      await tx.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          actorUserId: context.userId,
          actorType: context.actorType,
          action: 'SUBSCRIPTION_AUTO_RENEW_UPDATED',
          entityType: 'Subscription',
          entityId: updated.id,
          beforeData: { autoRenew: subscription.autoRenew },
          afterData: { autoRenew: updated.autoRenew },
          metadata: { action: 'PLATFORM_AUTO_RENEW_UPDATE' },
        },
      });

      return updated;
    });
  }

  async cancelForPlatform(
    id: string,
    reason: string | undefined,
    context: PlatformSubscriptionContext,
  ) {
    const subscription = await this.findForPlatformAction(id);

    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Subscription cannot be cancelled from ${subscription.status} state.`,
      );
    }

    return this.lifecycle.transition(
      subscription,
      SubscriptionStatus.CANCELLED,
      context,
      {
        reason: reason ?? 'PLATFORM_ADMIN_CANCELLED',
        source: 'API',
        patch: {
          cancelledAt: new Date(),
          autoRenew: false,
        },
        metadata: {
          action: 'PLATFORM_CANCEL',
        },
      },
    );
  }

  async expireForPlatform(
    id: string,
    reason: string | undefined,
    context: PlatformSubscriptionContext,
  ) {
    const subscription = await this.findForPlatformAction(id);

    if (subscription.status === SubscriptionStatus.EXPIRED) {
      throw new BadRequestException('Subscription is already expired.');
    }

    return this.lifecycle.transition(
      subscription,
      SubscriptionStatus.EXPIRED,
      context,
      {
        reason: reason ?? 'PLATFORM_ADMIN_EXPIRED',
        source: 'API',
        patch: {
          autoRenew: false,
        },
        metadata: {
          action: 'PLATFORM_EXPIRE',
        },
      },
    );
  }

  private async findForPlatformAction(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    return subscription;
  }

  private async scoped(id: string, context: SubscriptionContext) {
    const row = await this.prisma.subscription.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
    });
    if (!row) throw new NotFoundException('Subscription not found.');
    return row;
  }

  /**
   * Public (not private) — reused as-is by SubscriptionRenewalService's
   * checkout orchestration for Plan-change price resolution, so the
   * eligibility rule (ACTIVE plan, currently-effective price in the
   * company's own currency) is never duplicated.
   */
  async getPlan(id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id, status: PlanStatus.ACTIVE },
    });
    if (!plan) throw new NotFoundException('Active plan not found.');
    return plan;
  }

  async getPrice(
    planId: string,
    billingCycle: BillingCycle,
    currencyCode: string,
  ) {
    const now = new Date();
    const price = await this.prisma.planPrice.findFirst({
      where: {
        planId,
        billingCycle,
        currencyCode,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!price)
      throw new NotFoundException(
        'Active plan price not found for the company currency.',
      );
    return price;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
