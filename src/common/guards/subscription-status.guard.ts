import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { SubscriptionStatus } from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import type { CompanyContext } from '../types/company-context.type';

type CompanyRequest = Request & {
  user: AuthenticatedUser;
  companyContext: CompanyContext;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Runs after CompanyContextGuard (needs request.companyContext.companyId
 * already resolved). Never deletes or touches any business data — this
 * only allows/blocks the current request:
 *
 *   isComplimentary        -> always allowed (VIP/demo override)
 *   TRIALING/ACTIVE/PAST_DUE -> full access
 *   GRACE                  -> read-only (safe HTTP methods only)
 *   SUSPENDED/EXPIRED/CANCELLED/no subscription -> blocked
 *
 * Payment and Invoice controllers must never be wrapped with this guard —
 * a suspended Owner still has to be able to see and pay an Invoice to
 * recover, or the whole self-service recovery loop breaks and every
 * suspension becomes a support ticket.
 */
@Injectable()
export class SubscriptionStatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    const companyId = request.companyContext?.companyId;

    if (!companyId) {
      throw new ForbiddenException(
        'Company context is required before subscription status can be checked.',
      );
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, isComplimentary: true },
    });

    if (subscription?.isComplimentary) {
      return true;
    }

    if (!subscription) {
      throw new ForbiddenException(
        'No subscription exists for this company yet.',
      );
    }

    switch (subscription.status) {
      case SubscriptionStatus.TRIALING:
      case SubscriptionStatus.ACTIVE:
      case SubscriptionStatus.PAST_DUE:
        return true;

      case SubscriptionStatus.GRACE:
        if (SAFE_METHODS.has(request.method.toUpperCase())) {
          return true;
        }
        throw new ForbiddenException(
          'Subscription is in its grace period — read-only access until payment is resolved.',
        );

      default:
        throw new ForbiddenException(
          'Subscription is suspended, expired, or cancelled — please renew to continue.',
        );
    }
  }
}
