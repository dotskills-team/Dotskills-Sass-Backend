import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  COMPANY_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from '../../common/constants/permission.constants';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { SubscriptionStatusGuard } from '../../common/guards/subscription-status.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { CompanyContext } from '../../common/types/company-context.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocationAccessService } from '../../common/services/location-access.service';
import { CompanyRbacService } from './company-rbac.service';
import {
  BootstrapCompanyRbacDto,
  CreateCompanyMemberDto,
  CreateCompanyRoleDto,
  ReplaceCompanyMemberLocationsDto,
  ReplaceCompanyMemberRolesDto,
  ReplaceCompanyMemberScopesDto,
  ReplaceCompanyRolePermissionsDto,
  UpdateCompanyMemberStatusDto,
  UpdateCompanyRoleDto,
} from './dto/company-rbac.dto';

@Controller('platform/companies/:companyId/rbac')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class CompanyRbacBootstrapController {
  constructor(private readonly service: CompanyRbacService) {}

  @Post('bootstrap')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP)
  bootstrap(
    @Param('companyId') companyId: string,
    @Body() dto: BootstrapCompanyRbacDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.bootstrap(companyId, dto, actor);
  }
}

@Controller('companies/:companyId/rbac')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class CompanyRbacController {
  constructor(
    private readonly service: CompanyRbacService,
    private readonly locationAccessService: LocationAccessService,
  ) {}

  @Get('permissions')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.RBAC_READ)
  listPermissions() {
    return this.service.listPermissions();
  }

  /**
   * No @RequireCompanyPermissions — CompanyPermissionsGuard allows any
   * active member through when no metadata is present, matching this
   * route's own purpose: "what can I access" is safe self-information for
   * every authenticated member, the same class of route as GET
   * /auth/me/companies. Every LBAC-aware Location <Select> (POS, Cash
   * Drawer, Reports) calls this to filter its options — the real security
   * boundary is still the backend LocationAccessService calls in each
   * business-ops service, this is only the UX-quality companion.
   */
  @Get('my-location-access')
  async getMyLocationAccess(@CurrentCompany() context: CompanyContext) {
    const assigned = await this.locationAccessService.getAssignedLocationIds(context);
    return {
      success: true,
      data:
        assigned === 'ALL'
          ? { all: true as const, locationIds: [] as string[] }
          : { all: false as const, locationIds: assigned },
    };
  }

  @Get('roles')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.RBAC_READ)
  listRoles(@CurrentCompany() context: CompanyContext) {
    return this.service.listRoles(context);
  }

  @Post('roles')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.ROLE_CREATE)
  createRole(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateCompanyRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.createRole(context, dto, actor);
  }

  @Patch('roles/:roleId')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.ROLE_UPDATE)
  updateRole(
    @CurrentCompany() context: CompanyContext,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateCompanyRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateRole(context, roleId, dto, actor);
  }

  @Put('roles/:roleId/permissions')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.ROLE_PERMISSION_ASSIGN)
  replaceRolePermissions(
    @CurrentCompany() context: CompanyContext,
    @Param('roleId') roleId: string,
    @Body() dto: ReplaceCompanyRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceRolePermissions(context, roleId, dto, actor);
  }

  @Get('members')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_READ)
  listMembers(@CurrentCompany() context: CompanyContext) {
    return this.service.listMembers(context);
  }

  @Post('members')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_CREATE)
  createMember(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: CreateCompanyMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.createMember(context, dto, actor);
  }

  @Put('members/:memberId/roles')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_ROLE_ASSIGN)
  replaceMemberRoles(
    @CurrentCompany() context: CompanyContext,
    @Param('memberId') memberId: string,
    @Body() dto: ReplaceCompanyMemberRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceMemberRoles(context, memberId, dto, actor);
  }

  @Patch('members/:memberId/status')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_UPDATE)
  updateMemberStatus(
    @CurrentCompany() context: CompanyContext,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateCompanyMemberStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateMemberStatus(context, memberId, dto, actor);
  }

  @Put('members/:memberId/scopes')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN)
  replaceMemberScopes(
    @CurrentCompany() context: CompanyContext,
    @Param('memberId') memberId: string,
    @Body() dto: ReplaceCompanyMemberScopesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceMemberScopes(context, memberId, dto, actor);
  }

  @Put('members/:memberId/locations')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN)
  replaceMemberLocations(
    @CurrentCompany() context: CompanyContext,
    @Param('memberId') memberId: string,
    @Body() dto: ReplaceCompanyMemberLocationsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceMemberLocations(context, memberId, dto, actor);
  }
}
