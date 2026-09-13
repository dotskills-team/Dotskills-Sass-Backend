import { Injectable } from '@nestjs/common';

import { SubscriptionStatus } from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import type {
  SetupCheckItem,
  SetupCheckKey,
  SetupStatusData,
  SetupStatusResponse,
} from './setup-status.types';

const SETUP_CHECK_LABELS: Record<SetupCheckKey, string> = {
  SUBSCRIPTION: 'Subscription is active',
  RBAC: 'Owner has permissions assigned',
  LOCATION: 'At least one location added',
  UNIT: 'At least one unit added',
  PRODUCT: 'At least one product added',
};

/**
 * Read-only aggregation over existing data — no new business rule, no
 * write path. Every individual check reuses the exact same "ready" logic
 * already enforced elsewhere (SubscriptionStatusGuard's TRIALING/ACTIVE/
 * isComplimentary rule, CompanyPermissionsGuard's fail-closed "at least
 * one ALLOW permission" requirement), just expressed as a boolean instead
 * of a thrown exception — this endpoint's whole point is to report
 * readiness even when those gates would otherwise block the request, so
 * duplicating the *predicate* (not the guard itself) here is intentional,
 * not incidental.
 */
@Injectable()
export class SetupStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(context: CompanyContext): Promise<SetupStatusResponse> {
    const [
      subscriptionReady,
      rbacReady,
      locationCount,
      unitCount,
      productCount,
    ] = await Promise.all([
      this.isSubscriptionReady(context.companyId),
      this.isRbacReady(context.companyMemberId),
      this.prisma.location.count({
        where: { tenantId: context.tenantId, companyId: context.companyId },
      }),
      this.prisma.unit.count({
        where: { tenantId: context.tenantId, companyId: context.companyId },
      }),
      this.prisma.product.count({
        where: { tenantId: context.tenantId, companyId: context.companyId },
      }),
    ]);

    const checks: SetupCheckItem[] = [
      {
        key: 'SUBSCRIPTION',
        label: SETUP_CHECK_LABELS.SUBSCRIPTION,
        completed: subscriptionReady,
      },
      { key: 'RBAC', label: SETUP_CHECK_LABELS.RBAC, completed: rbacReady },
      {
        key: 'LOCATION',
        label: SETUP_CHECK_LABELS.LOCATION,
        completed: locationCount > 0,
      },
      { key: 'UNIT', label: SETUP_CHECK_LABELS.UNIT, completed: unitCount > 0 },
      {
        key: 'PRODUCT',
        label: SETUP_CHECK_LABELS.PRODUCT,
        completed: productCount > 0,
      },
    ];

    const completedCount = checks.filter((check) => check.completed).length;
    const data: SetupStatusData = {
      completedCount,
      totalCount: checks.length,
      isComplete: completedCount === checks.length,
      checks,
    };

    return { success: true, data };
  }

  /**
   * Mirrors `SubscriptionStatusGuard`'s exact readiness rule (isComplimentary
   * always ready; otherwise TRIALING/ACTIVE) — as a boolean predicate rather
   * than a thrown exception, since a NOT-ready subscription is a normal,
   * expected result to report here, not an error.
   */
  private async isSubscriptionReady(companyId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, isComplimentary: true },
    });

    if (!subscription) return false;
    if (subscription.isComplimentary) return true;
    return (
      subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.ACTIVE
    );
  }

  /**
   * Mirrors `CompanyPermissionsGuard`'s fail-closed check — a member with an
   * assigned role but zero attached ALLOW permissions (the exact gap
   * `CompanyOwnerService.create()` now prevents for new companies, but an
   * older company could still be in) is reported NOT ready. A single
   * exists-style query (`take: 1`, minimal `select`) — never fetches the
   * full permission list just to answer a yes/no question.
   */
  private async isRbacReady(companyMemberId: string): Promise<boolean> {
    const now = new Date();
    const assignment = await this.prisma.companyMemberRole.findFirst({
      where: {
        companyMemberId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        companyRole: {
          status: 'ACTIVE',
          permissions: {
            some: { effect: 'ALLOW', permission: { status: 'ACTIVE' } },
          },
        },
      },
      select: { companyMemberId: true },
    });
    return assignment !== null;
  }
}
