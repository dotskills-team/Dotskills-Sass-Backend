import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformRoleService } from './platform-role.service';
import {
  CreatePlatformRoleDto,
  ReplacePlatformRolePermissionsDto,
  UpdatePlatformRoleDto,
  UpdatePlatformRoleStatusDto,
} from './dto/platform-role.dto';

@Controller('platform/permissions')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformPermissionController {
  constructor(private readonly service: PlatformRoleService) {}

  /** Read-only catalog browse — `PLATFORM_PERMISSIONS`-এর whitelist দিয়ে scoped, company codes কখনো leak করে না। */
  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_READ)
  listPermissions() {
    return this.service.listPermissions();
  }
}

@Controller('platform/roles')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformRoleController {
  constructor(private readonly service: PlatformRoleService) {}

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_READ)
  listRoles() {
    return this.service.listRoles();
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_READ)
  getRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRole(id);
  }

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_CREATE)
  createRole(
    @Body() dto: CreatePlatformRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.createRole(dto, actor);
  }

  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_UPDATE)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateRole(id, dto, actor);
  }

  @Patch(':id/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_STATUS)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformRoleStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto, actor);
  }

  @Put(':id/permissions')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ROLE_PERMISSION_ASSIGN)
  replaceRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePlatformRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.replaceRolePermissions(id, dto, actor);
  }
}
