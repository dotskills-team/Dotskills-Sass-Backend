import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/phase-1-prisma/client';
import {
  BillingCycle,
  CompanyStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { companyWithOwnerSelect } from '../../common/prisma/company-with-owner.select';
import { parseReportDateRange } from '../reporting/report-date-range.util';
import { PlatformDashboardQueryDto } from './dto/platform-dashboard-query.dto';

const RECENT_LIMIT = 5;
const ACTIVITY_LIMIT = 8;
const EXPIRING_SOON_DAYS = 7;
const UPCOMING_EXPIRY_LIMIT = 10;

interface PriceSnapshotLike {
  amount?: string;
}

function monthlyAmount(
  priceSnapshot: unknown,
  billingCycle: BillingCycle,
): Prisma.Decimal {
  const snapshot = (priceSnapshot ?? {}) as PriceSnapshotLike;
  const amount = new Prisma.Decimal(snapshot.amount ?? '0');
  return billingCycle === BillingCycle.YEARLY ? amount.dividedBy(12) : amount;
}

/**
 * Platform/Super Admin "how is the whole SaaS doing" dashboard — deliberately
 * separate from the Company Dashboard (which answers "how is THIS company's
 * business doing"). Every number here is either a genuine current snapshot
 * (Active Companies, Subscription status distribution, Upcoming Expiry,
 * Trials Expiring Soon — none of these are meaningfully "for a date range")
 * or a real period aggregate (New Companies, Revenue, Payment/Invoice/
 * Billing Health, Subscription Activity) — the two are never conflated.
 *
 * MRR/Expansion/Contraction/Reactivation/NRR/GRR/Churn-rate-by-revenue are
 * deliberately NOT computed as a full movement bridge: `SubscriptionEvent`
 * stores only status transitions, not a price snapshot *at the time of that
 * event* — so reconstructing "what MRR moved from what to what" for a past
 * period from today's `Subscription.priceSnapshot` would be a fabrication
 * for any subscription whose plan/price has since changed. What IS reliably
 * derivable — current MRR (today's active, non-complimentary subscriptions'
 * own snapshot), New MRR and Churned MRR for a period (subscriptions that
 * genuinely transitioned in/out of ACTIVE within the range, using their own
 * still-accurate-for-that-transition snapshot) — is computed; Expansion/
 * Contraction/Reactivation/NRR/GRR are omitted, documented in the
 * implementation report rather than invented.
 */
@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: PlatformDashboardQueryDto) {
    const { from, to } = parseReportDateRange(query.dateFrom, query.dateTo);

    const reportingCurrency = await this.resolveReportingCurrency();

    const [
      companySnapshot,
      companyGrowth,
      subscriptionStatusCounts,
      mrrSnapshot,
      mrrMovement,
      cashCollected,
      subscriptionActivityCounts,
      planPerformance,
      industryPerformance,
      trialOverview,
      upcomingExpiry,
      paymentHealth,
      invoiceHealth,
      billingHealth,
      actionRequired,
      recentCompanies,
      recentPayments,
      subscriptionActivity,
      platformActivity,
      databaseHealthy,
      revenueSeries,
      companyGrowthSeries,
      expiryBuckets,
    ] = await Promise.all([
      this.getCompanySnapshot(),
      this.getCompanyGrowth(from, to),
      this.getSubscriptionStatusCounts(),
      this.getMrrSnapshot(reportingCurrency.code),
      this.getMrrMovement(from, to, reportingCurrency.code),
      this.getCashCollected(from, to, reportingCurrency.code),
      this.getSubscriptionActivityCounts(from, to),
      this.getPlanPerformance(reportingCurrency.code),
      this.getIndustryPerformance(reportingCurrency.code),
      this.getTrialOverview(from, to),
      this.getUpcomingExpiry(),
      this.getPaymentHealth(from, to, reportingCurrency.code),
      this.getInvoiceHealth(from, to, reportingCurrency.code),
      this.getBillingHealth(from, to),
      this.getActionRequired(),
      this.getRecentCompanies(),
      this.getRecentPayments(),
      this.getSubscriptionActivity(),
      this.getPlatformActivity(),
      this.checkDatabaseHealth(),
      this.getRevenueSeries(from, to, reportingCurrency.code),
      this.getCompanyGrowthSeries(from, to),
      this.getExpiryBuckets(),
    ]);

    return {
      success: true,
      data: {
        currencyCode: reportingCurrency.code,
        otherCurrencyCompanyCount: reportingCurrency.otherCurrencyCompanyCount,
        companySnapshot,
        companyGrowth,
        subscriptionStatusCounts,
        mrr: {
          current: mrrSnapshot.mrr,
          arr: mrrSnapshot.mrr.times(12),
          activeSubscriptionCount: mrrSnapshot.activeSubscriptionCount,
          newMrr: mrrMovement.newMrr,
          churnedMrr: mrrMovement.churnedMrr,
        },
        cashCollected,
        subscriptionActivityCounts,
        planPerformance,
        industryPerformance,
        trialOverview,
        upcomingExpiry,
        paymentHealth,
        invoiceHealth,
        billingHealth,
        actionRequired,
        recentCompanies,
        recentPayments,
        subscriptionActivity,
        platformActivity,
        platformHealth: { database: databaseHealthy },
        revenueSeries,
        companyGrowthSeries,
        expiryBuckets,
      },
    };
  }

  /**
   * Companies can each have their own `baseCurrencyCode` — summing raw
   * amounts across currencies would silently produce a meaningless number.
   * Picks the currency used by the largest number of companies with at
   * least one subscription as "the" reporting currency for every money KPI
   * below, and reports how many companies use a different currency instead
   * of silently mixing them in.
   */
  private async resolveReportingCurrency(): Promise<{
    code: string;
    otherCurrencyCompanyCount: number;
  }> {
    const groups = await this.prisma.company.groupBy({
      by: ['baseCurrencyCode'],
      where: { subscriptions: { some: {} } },
      _count: true,
      orderBy: { _count: { baseCurrencyCode: 'desc' } },
    });

    if (groups.length === 0)
      return { code: 'BDT', otherCurrencyCompanyCount: 0 };

    const primary = groups[0];
    const otherCurrencyCompanyCount = groups
      .slice(1)
      .reduce((sum, group) => sum + group._count, 0);
    return { code: primary.baseCurrencyCode, otherCurrencyCompanyCount };
  }

  private async getCompanySnapshot() {
    const [total, active] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: CompanyStatus.LIVE } }),
    ]);
    return { total, active };
  }

  private async getCompanyGrowth(from: Date, to: Date) {
    const [newCompanies, activated, closed] = await Promise.all([
      this.prisma.company.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.company.count({
        where: { goLiveAt: { gte: from, lte: to } },
      }),
      // Snapshot, not period-scoped — Company has no `closedAt` column, so
      // "closed within this range" isn't reliably derivable; total
      // currently-closed count is.
      this.prisma.company.count({ where: { status: CompanyStatus.CLOSED } }),
    ]);
    return { newCompanies, activated, closed };
  }

  private async getSubscriptionStatusCounts() {
    const groups = await this.prisma.subscription.groupBy({
      by: ['status'],
      _count: true,
    });
    return Object.fromEntries(
      groups.map((group) => [group.status, group._count]),
    ) as Record<string, number>;
  }

  private async getMrrSnapshot(currencyCode: string) {
    const active = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        isComplimentary: false,
        company: { baseCurrencyCode: currencyCode },
      },
      select: { priceSnapshot: true, billingCycle: true },
    });

    const mrr = active.reduce(
      (sum, subscription) =>
        sum.plus(
          monthlyAmount(subscription.priceSnapshot, subscription.billingCycle),
        ),
      new Prisma.Decimal(0),
    );
    return { mrr, activeSubscriptionCount: active.length };
  }

  /** New MRR / Churned MRR for the period — see class doc-comment for why Expansion/Contraction/Reactivation aren't attempted. */
  private async getMrrMovement(from: Date, to: Date, currencyCode: string) {
    const [activated, churned] = await Promise.all([
      this.prisma.subscriptionEvent.findMany({
        where: {
          toStatus: SubscriptionStatus.ACTIVE,
          createdAt: { gte: from, lte: to },
          subscription: {
            isComplimentary: false,
            company: { baseCurrencyCode: currencyCode },
          },
        },
        select: {
          subscription: { select: { priceSnapshot: true, billingCycle: true } },
        },
      }),
      this.prisma.subscriptionEvent.findMany({
        where: {
          toStatus: {
            in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
          },
          createdAt: { gte: from, lte: to },
          subscription: {
            isComplimentary: false,
            company: { baseCurrencyCode: currencyCode },
          },
        },
        select: {
          subscription: { select: { priceSnapshot: true, billingCycle: true } },
        },
      }),
    ]);

    const sum = (
      rows: {
        subscription: { priceSnapshot: unknown; billingCycle: BillingCycle };
      }[],
    ) =>
      rows.reduce(
        (total, row) =>
          total.plus(
            monthlyAmount(
              row.subscription.priceSnapshot,
              row.subscription.billingCycle,
            ),
          ),
        new Prisma.Decimal(0),
      );

    return { newMrr: sum(activated), churnedMrr: sum(churned) };
  }

  private async getCashCollected(from: Date, to: Date, currencyCode: string) {
    const result = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED,
        succeededAt: { gte: from, lte: to },
        currencyCode,
      },
      _sum: { amount: true },
      _count: true,
    });
    return {
      total: result._sum.amount ?? new Prisma.Decimal(0),
      paymentCount: result._count,
    };
  }

  private async getSubscriptionActivityCounts(from: Date, to: Date) {
    const where = { createdAt: { gte: from, lte: to } };
    const [newSubscriptions, renewals, planChanges, expired, cancelled] =
      await Promise.all([
        this.prisma.subscriptionEvent.count({
          where: { ...where, fromStatus: null },
        }),
        this.prisma.subscriptionEvent.count({
          where: {
            ...where,
            reason: 'PAYMENT_SUCCEEDED',
            fromStatus: SubscriptionStatus.ACTIVE,
            toStatus: SubscriptionStatus.ACTIVE,
          },
        }),
        this.prisma.subscriptionEvent.count({
          where: { ...where, reason: 'PLAN_CHANGE_PAYMENT_SUCCEEDED' },
        }),
        this.prisma.subscriptionEvent.count({
          where: { ...where, toStatus: SubscriptionStatus.EXPIRED },
        }),
        this.prisma.subscriptionEvent.count({
          where: { ...where, toStatus: SubscriptionStatus.CANCELLED },
        }),
      ]);
    return { newSubscriptions, renewals, planChanges, expired, cancelled };
  }

  private async getPlanPerformance(currencyCode: string) {
    const [plans, activeSubs] = await Promise.all([
      this.prisma.plan.findMany({
        select: { id: true, code: true, name: true },
      }),
      this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          company: { baseCurrencyCode: currencyCode },
        },
        select: {
          planId: true,
          priceSnapshot: true,
          billingCycle: true,
          isComplimentary: true,
        },
      }),
    ]);

    return plans
      .map((plan) => {
        const subs = activeSubs.filter((sub) => sub.planId === plan.id);
        const mrr = subs
          .filter((sub) => !sub.isComplimentary)
          .reduce(
            (sum, sub) =>
              sum.plus(monthlyAmount(sub.priceSnapshot, sub.billingCycle)),
            new Prisma.Decimal(0),
          );
        return {
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          activeSubscriptions: subs.length,
          mrr,
        };
      })
      .filter((row) => row.activeSubscriptions > 0)
      .sort((a, b) => b.mrr.comparedTo(a.mrr));
  }

  private async getIndustryPerformance(currencyCode: string) {
    const [industries, companies] = await Promise.all([
      this.prisma.industry.findMany({ select: { id: true, name: true } }),
      this.prisma.company.findMany({
        select: {
          industryId: true,
          subscriptions: {
            where: {
              status: SubscriptionStatus.ACTIVE,
              isComplimentary: false,
            },
            select: { priceSnapshot: true, billingCycle: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        where: { baseCurrencyCode: currencyCode },
      }),
    ]);

    return industries
      .map((industry) => {
        const industryCompanies = companies.filter(
          (company) => company.industryId === industry.id,
        );
        const mrr = industryCompanies.reduce((sum, company) => {
          const sub = company.subscriptions[0];
          return sub
            ? sum.plus(monthlyAmount(sub.priceSnapshot, sub.billingCycle))
            : sum;
        }, new Prisma.Decimal(0));
        return {
          industryId: industry.id,
          industryName: industry.name,
          companyCount: industryCompanies.length,
          mrr,
        };
      })
      .filter((row) => row.companyCount > 0)
      .sort((a, b) => b.companyCount - a.companyCount);
  }

  private async getTrialOverview(from: Date, to: Date) {
    const now = new Date();
    const soon3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const soon7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const soon30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      active,
      started,
      converted,
      expired,
      expiring3,
      expiring7,
      expiring30,
    ] = await Promise.all([
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.TRIALING },
      }),
      this.prisma.subscriptionEvent.count({
        where: {
          fromStatus: null,
          toStatus: SubscriptionStatus.TRIALING,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.subscriptionEvent.count({
        where: {
          fromStatus: SubscriptionStatus.TRIALING,
          toStatus: SubscriptionStatus.ACTIVE,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.subscriptionEvent.count({
        where: {
          fromStatus: SubscriptionStatus.TRIALING,
          toStatus: SubscriptionStatus.EXPIRED,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { gte: now, lte: soon3 },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { gte: now, lte: soon7 },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { gte: now, lte: soon30 },
        },
      }),
    ]);

    const conversionRate =
      converted + expired > 0
        ? Math.round((converted / (converted + expired)) * 1000) / 10
        : null;

    return {
      active,
      started,
      converted,
      expired,
      conversionRate,
      expiringSoon: {
        in3Days: expiring3,
        in7Days: expiring7,
        in30Days: expiring30,
      },
    };
  }

  private async getUpcomingExpiry() {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gte: now, lte: soon },
      },
      select: {
        id: true,
        currentPeriodEnd: true,
        autoRenew: true,
        status: true,
        company: { select: { id: true, legalName: true, tradeName: true } },
        plan: { select: { name: true } },
      },
      orderBy: { currentPeriodEnd: 'asc' },
      take: UPCOMING_EXPIRY_LIMIT,
    });

    return rows.map((row) => ({
      subscriptionId: row.id,
      companyId: row.company?.id ?? null,
      companyName: row.company?.tradeName ?? row.company?.legalName ?? '—',
      planName: row.plan.name,
      status: row.status,
      expiresAt: row.currentPeriodEnd,
      autoRenew: row.autoRenew,
    }));
  }

  private async getPaymentHealth(from: Date, to: Date, currencyCode: string) {
    const groups = await this.prisma.payment.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to }, currencyCode },
      _count: true,
      _sum: { amount: true },
    });
    const byStatus = Object.fromEntries(
      groups.map((group) => [
        group.status,
        {
          count: group._count,
          amount: group._sum.amount ?? new Prisma.Decimal(0),
        },
      ]),
    ) as Record<string, { count: number; amount: Prisma.Decimal }>;

    const succeeded = byStatus.SUCCEEDED?.count ?? 0;
    const failed = byStatus.FAILED?.count ?? 0;
    const successRate =
      succeeded + failed > 0
        ? Math.round((succeeded / (succeeded + failed)) * 1000) / 10
        : null;

    return { byStatus, successRate };
  }

  private async getInvoiceHealth(from: Date, to: Date, currencyCode: string) {
    const groups = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to }, currencyCode },
      _count: true,
      _sum: { totalAmount: true },
    });
    const byStatus = Object.fromEntries(
      groups.map((group) => [
        group.status,
        {
          count: group._count,
          amount: group._sum.totalAmount ?? new Prisma.Decimal(0),
        },
      ]),
    ) as Record<string, { count: number; amount: Prisma.Decimal }>;

    return { byStatus };
  }

  private async getBillingHealth(from: Date, to: Date) {
    const groups = await this.prisma.billing.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
    });
    const byStatus = Object.fromEntries(
      groups.map((group) => [group.status, group._count]),
    ) as Record<string, number>;

    const succeeded = byStatus.SUCCEEDED ?? 0;
    const failed = byStatus.FAILED ?? 0;
    const failureRate =
      succeeded + failed > 0
        ? Math.round((failed / (succeeded + failed)) * 1000) / 10
        : null;

    return { byStatus, failureRate };
  }

  private async getActionRequired() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(
      now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000,
    );

    const [
      recentPaymentFailures,
      expiringSoon,
      expiredCount,
      pendingBilling,
      awaitingActivation,
    ] = await Promise.all([
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.FAILED,
          failedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gte: now, lte: sevenDaysAhead },
        },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.billing.count({ where: { status: 'PENDING' } }),
      this.prisma.company.count({
        where: {
          status: { notIn: [CompanyStatus.LIVE, CompanyStatus.CLOSED] },
        },
      }),
    ]);

    return {
      recentPaymentFailures,
      expiringSoon,
      expiredCount,
      pendingBilling,
      awaitingActivation,
    };
  }

  private async getRecentCompanies() {
    const companies = await this.prisma.company.findMany({
      select: {
        id: true,
        code: true,
        legalName: true,
        tradeName: true,
        status: true,
        createdAt: true,
        industry: { select: { name: true } },
        subscriptions: {
          select: { plan: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
    });

    return companies.map((company) => ({
      companyId: company.id,
      code: company.code,
      name: company.tradeName ?? company.legalName,
      industryName: company.industry.name,
      planName: company.subscriptions[0]?.plan.name ?? null,
      status: company.status,
      createdAt: company.createdAt,
    }));
  }

  private async getRecentPayments() {
    const payments = await this.prisma.payment.findMany({
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        provider: true,
        status: true,
        createdAt: true,
        company: { select: companyWithOwnerSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
    });

    return payments.map((payment) => ({
      paymentId: payment.id,
      companyId: payment.company?.id ?? null,
      companyName:
        payment.company?.tradeName ?? payment.company?.legalName ?? '—',
      amount: payment.amount,
      currencyCode: payment.currencyCode,
      provider: payment.provider,
      status: payment.status,
      createdAt: payment.createdAt,
    }));
  }

  private async getSubscriptionActivity() {
    const events = await this.prisma.subscriptionEvent.findMany({
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            company: { select: { id: true, legalName: true, tradeName: true } },
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_LIMIT,
    });

    return events.map((event) => ({
      eventId: event.id,
      companyId: event.subscription.company?.id ?? null,
      companyName:
        event.subscription.company?.tradeName ??
        event.subscription.company?.legalName ??
        '—',
      planName: event.subscription.plan.name,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      createdAt: event.createdAt,
    }));
  }

  private async getPlatformActivity() {
    const logs = await this.prisma.auditLog.findMany({
      where: { actorType: 'PLATFORM_MEMBER' },
      select: {
        id: true,
        action: true,
        entityType: true,
        companyId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_LIMIT,
    });
    return logs;
  }

  /**
   * Daily-bucketed successful-payment revenue for the Revenue chart —
   * same `DATE_TRUNC('day', ...)` raw-SQL pattern already used by
   * `ProfitReportService` (Prisma has no date-bucketing query-builder
   * equivalent). Days with no successful payment simply don't appear in
   * the result — the frontend renders only real points, never a
   * fabricated zero-filled series.
   */
  private async getRevenueSeries(from: Date, to: Date, currencyCode: string) {
    const rows = await this.prisma.$queryRaw<
      { day: Date; revenue: string }[]
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('day', "succeededAt") AS day,
        COALESCE(SUM("amount"), 0)::numeric(20, 4) AS revenue
      FROM payments
      WHERE "status" = 'SUCCEEDED'
        AND "currencyCode" = ${currencyCode}
        AND "succeededAt" >= ${from}
        AND "succeededAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "succeededAt")
      ORDER BY day ASC
    `);

    return rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      revenue: row.revenue,
    }));
  }

  /** Same raw-SQL day-bucketing pattern for New Companies over the period. */
  private async getCompanyGrowthSeries(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      { day: Date; new_companies: number }[]
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COUNT(*)::int AS new_companies
      FROM companies
      WHERE "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `);

    return rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      newCompanies: row.new_companies,
    }));
  }

  /**
   * Current-snapshot expiry buckets (not period-scoped, same reasoning as
   * `getUpcomingExpiry()`/`getActionRequired()`) — the 7/30/60-day windows
   * requested for the Expiry/Renewal section, plus the already-expired
   * count reused from the EXPIRED status count.
   */
  private async getExpiryBuckets() {
    const now = new Date();
    const soon7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const soon30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const soon60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [within7, within30, within60, expired] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gte: now, lte: soon7 },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gte: now, lte: soon30 },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gte: now, lte: soon60 },
        },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.EXPIRED },
      }),
    ]);

    return { within7, within30, within60, expired };
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
