import { ForbiddenException, Injectable } from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../constants/permission.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyPermissionResolverService } from './company-permission-resolver.service';
import type { CompanyContext } from '../types/company-context.type';

/**
 * Location-Based Access Control — the shared, reusable primitive every
 * Location-touching business-ops service calls into. Owner/Admin hold
 * LOCATION_ACCESS_ALL (auto-inherited, same mechanism as every other
 * "exempt from a restriction" permission in this codebase) and are never
 * restricted; everyone else is scoped to their real CompanyMemberLocation
 * rows — no rows means no Location access at all (fail-safe default).
 */
@Injectable()
export class LocationAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: CompanyPermissionResolverService,
  ) {}

  /** `'ALL'` for an unrestricted actor, otherwise the exact list of Location ids this actor may act on. */
  async getAssignedLocationIds(
    context: CompanyContext,
  ): Promise<string[] | 'ALL'> {
    const hasAll = await this.permissionResolver.hasPermission(
      context,
      COMPANY_PERMISSIONS.LOCATION_ACCESS_ALL,
    );
    if (hasAll) return 'ALL';

    const assignments = await this.prisma.companyMemberLocation.findMany({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        companyMemberId: context.companyMemberId,
      },
      select: { locationId: true },
    });
    return assignments.map((assignment) => assignment.locationId);
  }

  async assertHasLocationAccess(
    context: CompanyContext,
    locationId: string,
  ): Promise<void> {
    const assigned = await this.getAssignedLocationIds(context);
    if (assigned === 'ALL') return;
    if (!assigned.includes(locationId)) {
      throw new ForbiddenException('You do not have access to this location');
    }
  }
}
