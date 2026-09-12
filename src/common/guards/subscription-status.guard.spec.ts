import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { SubscriptionStatus } from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatusGuard } from './subscription-status.guard';

describe('SubscriptionStatusGuard', () => {
  let guard: SubscriptionStatusGuard;

  const mockPrisma = {
    subscription: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new SubscriptionStatusGuard(mockPrisma as unknown as PrismaService);
  });

  function contextWith(method: string, companyId: string | undefined) {
    const request = {
      method,
      companyContext: companyId ? { companyId } : undefined,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('throws if CompanyContextGuard has not resolved companyId', async () => {
    await expect(
      guard.canActivate(contextWith('GET', undefined)),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('always allows when the subscription is isComplimentary, regardless of status', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: SubscriptionStatus.SUSPENDED,
      isComplimentary: true,
    });

    const result = await guard.canActivate(contextWith('POST', 'company-1'));
    expect(result).toBe(true);
  });

  it('blocks when no subscription exists at all', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextWith('GET', 'company-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE])(
    'allows full access (any HTTP method) when status is %s',
    async (status) => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        status,
        isComplimentary: false,
      });

      await expect(
        guard.canActivate(contextWith('POST', 'company-1')),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(contextWith('GET', 'company-1')),
      ).resolves.toBe(true);
    },
  );

  /**
   * PAST_DUE/GRACE are no longer reachable by any code path — nothing
   * transitions a Subscription into them any more — but the enum values
   * still exist (kept for historical SubscriptionEvent audit rows, see
   * schema.prisma). A legacy row somehow still sitting in one of these
   * states must be blocked exactly like EXPIRED/CANCELLED/SUSPENDED, not
   * given the old special-cased full/read-only access.
   */
  it.each([
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.GRACE,
  ])('blocks everything (including GET) when status is %s', async (status) => {
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status,
      isComplimentary: false,
    });

    await expect(
      guard.canActivate(contextWith('GET', 'company-1')),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard.canActivate(contextWith('POST', 'company-1')),
    ).rejects.toThrow(ForbiddenException);
  });
});
