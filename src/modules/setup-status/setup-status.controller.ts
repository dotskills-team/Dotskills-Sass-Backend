import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CompanyContext } from '../../common/types/company-context.type';
import { SetupStatusService } from './setup-status.service';

/**
 * Deliberately NOT guarded by `SubscriptionStatusGuard`, and no
 * `@RequireCompanyPermissions` decorator is applied — both of those are
 * exactly the things this endpoint reports on. A brand-new Owner whose
 * subscription isn't active yet, or whose role has no permissions attached,
 * must still be able to see *that* here; gating this route behind either
 * check would make it useless for the one case it exists to diagnose.
 * `CompanyPermissionsGuard` is kept in the stack for consistency with every
 * other company-scoped controller — with no required codes declared it's a
 * no-op (see `CompanyPermissionsGuard.canActivate`'s `!required?.length`
 * early return), so this stays open to any ACTIVE company member.
 */
@Controller('companies/:companyId/setup-status')
@UseGuards(JwtAuthGuard, CompanyContextGuard, CompanyPermissionsGuard)
export class SetupStatusController {
  constructor(private readonly service: SetupStatusService) {}

  @Get()
  get(@CurrentCompany() context: CompanyContext) {
    return this.service.getStatus(context);
  }
}
