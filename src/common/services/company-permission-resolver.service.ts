import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../types/company-context.type';

/**
 * The one place that resolves "does this actor's company membership hold
 * permission X" as a plain question, not a route gate. `CompanyPermissionsGuard`
 * runs the same shape of query for a *set* of required codes at route-entry
 * time; this is the single-code version for service-layer, fine-grained
 * checks (e.g. "is this actor exempt from an ownership/location
 * restriction otherwise in effect") — extracted here once a second real
 * caller needed the identical logic (Cash Drawer's own MANAGE_ALL check,
 * refactored to delegate to this), rather than duplicating it a third time
 * for LocationAccessService.
 */
@Injectable()
export class CompanyPermissionResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async hasPermission(context: CompanyContext, code: string): Promise<boolean> {
    const now = new Date();
    const assignments = await this.prisma.companyMemberRole.findMany({
      where: {
        companyMemberId: context.companyMemberId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        companyRole: {
          companyId: context.companyId,
          tenantId: context.tenantId,
          status: 'ACTIVE',
        },
      },
      select: {
        companyRole: {
          select: {
            permissions: {
              where: { permission: { code, status: 'ACTIVE' } },
              select: { effect: true },
            },
          },
        },
      },
    });

    const effects = new Set(
      assignments.flatMap((assignment) =>
        assignment.companyRole.permissions.map((item) => item.effect),
      ),
    );
    return effects.has('ALLOW') && !effects.has('DENY');
  }
}
